# Migrating a v1 app to apps v2

Two different things wear the word "migrate". Separate them before you start, because they have
different risks and only one of them is irreversible.

| | What it is | Reversible? |
|---|---|---|
| **The code rewrite** | Rebuilding the app as a static frontend + worker | Yes — it's just code |
| **The `migrate` gate** | Flipping the app row's `generation` from 1 to 2 | **No. One-way, permanent.** |

You often want both. You do not always want them on the same app.

You are usually here for one of two reasons: the user asked for a v1 app to become v2, or a v1
app was asked for something it cannot do — a secret, a signed outbound call, a cron, a rule that
must hold — and [SKILL.md](../SKILL.md#when-a-v1-app-cant-do-whats-asked) sent you. In the
second case the migration is the deliverable, not an option to float: tell the user in a
paragraph, then build. The feature that triggered it becomes the first worker route.

## Decide the path first

**Path A — a new app slug (strongly preferred).**

Build the v2 app as a *new* app, leave the v1 app running, cut over when it works.

- No downtime, no gate, nothing irreversible.
- You can rehearse the whole thing against real infrastructure.
- Cost: the new app starts with an empty store. If the old data matters, you copy it.

**Path B — migrate in place.**

Use when the app's live data must come along and the slug/URL must not change.

- Irreversible, and it has a **forced downtime window** (below).
- You cannot rehearse it. See the trap.

### The trap: you cannot rehearse Path B

A v2 worker cannot be tested against its own live v1 app before the flip:

- `railcode deploy` **422s** if you send a server module while the app is still generation 1.
- `/fn/data` (the worker data plane) **refuses** any app below generation 2.

So on Path B the order is forced, and there is a gap in the middle where the app is broken:

```
railcode migrate      # v1 data plane dies here — the browser SDK stops working
   ↓  ...app is down for its users...
railcode deploy       # the worker takes over here
```

Keep that window as short as you can: have the v2 build finished, built, and validated
(`railcode manifest validate`, a clean `railcode dev` run) **before** you type `railcode migrate`.

If you are on Path A you never enter this window at all — which is the argument for Path A.

`railcode migrate` requires **CLI 0.2.3**; on 0.2.2 the command exists but is never dispatched and
fails as unknown.

Whichever path you take, clear any stored notes about the v1 browser SDK once the app is v2 — see
[Clear Any v1 SDK Memory](../SKILL.md#clear-any-v1-sdk-memory). Notes that were accurate yesterday
describe a data plane that no longer answers, and they are what pull a half-migrated page back
toward `window.db`.

## What happens to the data

This surprises people in a good way.

**Unscoped v1 data carries over untouched.** A v2 app's flat store **is** the same app scope v1's
shared/unscoped data lived in. Same app row, same collections, same keys. Your worker's
`db.collection("notes").get(k)` reads exactly what the v1 page wrote with `db.collection("notes")`.
Nothing to copy, nothing to migrate.

**Scoped v1 data freezes.** Anything written through `db.user`, `db.role(uuid)`, `files.user`, or
`files.role(uuid)` becomes readable but permanently un-writable:

```ts
await db.scoped(userUuid).collection("drafts").query();      // read-only
await db.scopedRole(roleUuid).collection("shared").get(k);   // read-only
```

There is no write path and there will not be one. If that data must stay live, your worker has to
copy it into the flat store under keys you choose — usually on first read per user:

```ts
const flatKey = `${ctx.user!.id}:drafts`;
let mine = await db.collection("drafts").get(flatKey);
if (!mine) {                                            // one-time lift
  mine = await db.scoped(ctx.user!.id).collection("drafts").query();
  await db.collection("drafts").put(flatKey, mine);
}
```

So: **an app that only ever used the default (unscoped) store has no data problem at all.** An app
built around `db.user` has the most work.

## The code rewrite

Almost none of the app changes. Views, components, stores, and business logic are untouched. What
changes is the one place SDK calls happen.

### 1. Find the seam

A well-built v1 app funnels every SDK call through a single wrapper module. Find it, and find what
the rest of the app *actually* imports from it:

```bash
rg -n "from ['\"].*lib/railcode['\"]" src
```

Do this before building anything. A real wrapper typically *declares* far more than the app uses —
build routes only for the surface that is actually imported. Confirm each candidate is unused
before you drop it.

### 2. Rewrite the wrapper, keep its signature

Keep the exported API byte-identical, but make every function `fetch()` a worker route. Everything
downstream compiles and runs unchanged. This is the whole trick.

```ts
// before (v1): window.db.collection(name).get(key)
// after  (v2):
export function collection(name: string) {
  return {
    get: (key: string) => post("/api/rc/kv", { op: "get", name, key }),
    put: (key: string, value: unknown) => post("/api/rc/kv", { op: "put", name, key, value }),
  };
}
```

### 3. Build one worker route per capability actually used

| v1 wrapper export | v2 implementation |
|---|---|
| `me()` / `getIdentity()` | The page may fetch **`/_api/me`** directly — it survives on v2. Better: return `ctx.user` from a route of your own |
| `collection(name)` | `POST /api/rc/kv` → worker `db.collection(name)` |
| `files.*` | `POST /api/rc/files` → worker `files`; use `files.urls()` for galleries |
| `query()` / `data().runSQL()` | `POST /api/rc/query` → worker `query` / `data` |
| `connector().fetch()` | `POST /api/rc/connector` → worker `connector` |
| `personalConnections.*` | **Removed.** The account is now a connector row: `POST /api/rc/connector` → worker `connector(name)`. Get the row's name from `railcode connector list` — it may be suffixed (`gmail-jp`) |
| `llm.generate` | `POST /api/rc/llm` → worker `llm` |
| `agents.invoke` / `start` | `POST /api/rc/agent` → worker `agents.start` + a poll route |
| `roles()` | **No worker equivalent.** `ctx.user.roles` gives the caller's own roles only |
| `designSystem()` | **No worker equivalent.** Fetch at build time with `railcode design-system` |

### 4. Two rules that bite

**Relay the original status.** Wrap SDK calls and, on `ApiError`, respond with its `.status` and
body verbatim. The browser's 403/409/429 handling depends on it surviving the extra hop.

**Paginate KV `list()`.** It is first-page-only (default 100, max 500). In v1 you may have been
quietly getting away with it; in a worker loop you will silently drop a large collection's tail.

### 5. Manifest

`run_as: app` is mandatory. Declare **every** capability the worker uses.

**Personal connectors and agents are refusals, not pass-through** — declare every toolkit and
every agent name, even ones the v1 manifest never listed, or they 403 at runtime.

## The interactive LLM tool loop

This is the one genuinely hard case, and it is worth knowing before you promise a timeline.

If the v1 app runs `llm.stream({ tools })` where the tools **pause for a human approval** or
**close over live browser state** (a store, a callback), you cannot move that loop into the
worker. A worker invocation is one request: there is no inbound channel to deliver an "Approve"
click to a running invocation, and the tools' `run` closures don't exist server-side.

**Keep the loop in the browser; proxy each model turn to the worker.** The SDK's tool loop is a
pure, dependency-injected generator that takes a `wire` with `generate`/`stream` runners:

1. Vendor `tool-loop.ts` into the app.
2. Give it a browser `wire` whose `generate` POSTs to your worker's LLM route.
3. Tools (`run`, with approval and store access) execute in the page exactly as before; only each
   planning **turn** crosses to the worker.

**Relay each turn with the tool DEFINITIONS attached.** The worker route calls `llm.stream()` (or
`generate`) with the run-less defs the browser sent and passes the events back; the browser's loop
executes the `run` handlers and threads the next turn. Step events, approval, transcript threading
and stop reasons all keep working, and text still streams live.

Needs `@railcode/sdk` ≥ 0.3.0. Earlier builds refused any call carrying tools on the streaming
path, which forced the relay onto `generate` and cost the token-by-token final answer.

## Stack taxes (only if you pick TanStack)

Most of a port has nothing to do with the frontend framework. `hono+vite` and `hono+static` add
no new classes of bug. TanStack Start adds two:

**Build-time prerender ⇒ SSR-safe module init.** SPA mode prerenders the shell at build time in a
runtime with **no `window`**. Any module-level browser access that runs at import — a store
reading `window.matchMedia` / `localStorage` at *creation* — crashes the build. Guard them:

```ts
const q = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)") : null;
```

A v1 `index.html` + `main.tsx` SPA never executes app code at build time, so this whole class of
bug is *new*.

**Router reconciliation.** If the app owns its own routing (History API + `popstate`), let it keep
it: an index route plus a splat `$` route that both mount `<App/>`, with **`ssr: false`**. API
routes are more specific, so they win over the splat.

## Checklist

- [ ] Chose Path A (new slug) or Path B (in-place) **deliberately**, and told the user Path B is
      one-way with downtime.
- [ ] Grepped the wrapper's importers; built routes only for the surface actually used.
- [ ] Identity from `ctx.user` (or `/_api/me`).
- [ ] KV `list()` paginates.
- [ ] Worker routes relay `ApiError` status + body verbatim.
- [ ] `run_as: app`; **every** capability declared, including every personal-connector toolkit and
      every agent name.
- [ ] Scoped v1 data: either lifted into the flat store, or confirmed unused.
- [ ] Interactive tool loops: browser loop + worker turns, **generate-based**.
- [ ] Deployed and confirmed the manifest ratified (`railcode manifest show <app>`).
- [ ] Walked the app live and read `railcode logs app --app <slug>`.

## Budget it honestly

On a real 11k-line SPA port the split was roughly **85% investigation and authority inversion,
15% framework tax**. The expensive parts are reading the app well enough to keep the port to one
seam, and the interactive tool loop. The scaffold itself is a small, learnable cost.

Tell the user that before you start, not after.
