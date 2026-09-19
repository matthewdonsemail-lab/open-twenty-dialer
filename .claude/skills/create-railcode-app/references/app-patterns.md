# App Patterns (apps v2)

Implementation patterns for a Railcode v2 app: a static frontend plus a backend worker. For the
SDK surface itself see [worker-sdk.md](worker-sdk.md). For a generation-1 app see
[v1-legacy.md](v1-legacy.md) — the patterns here do not apply there.

## Contents

- [Layout by stack](#layout-by-stack)
- [The split, and why it matters](#the-split-and-why-it-matters)
- [Worker route patterns](#worker-route-patterns)
- [Authorization is your code](#authorization-is-your-code)
- [Data modeling on a flat store](#data-modeling-on-a-flat-store)
- [Frontend patterns](#frontend-patterns)
- [Files](#files)
- [LLM](#llm)
- [Delegating to a managed agent](#delegating-to-a-managed-agent)
- [Cron](#cron)
- [Common pitfalls](#common-pitfalls)

## Layout by stack

`railcode init` scaffolds four stacks and **the CLI owns the build for all of them** — the app
declares no bundler, no `wrangler`, and no Cloudflare package.

**`hono+vite`** (default) — Vite + React frontend, Hono worker:

```
frontend/          # client (Vite root)
server/index.ts    # export default app
railcode.json      # { app, type: "hono+vite", dist: "dist/client", server: "dist/server/index.js" }
manifest.yaml
```

**`hono+static`** — one `index.html`, no frontend build, Hono worker:

```
frontend/index.html
server/index.ts
railcode.json      # { app, type: "hono+static", dist: "dist/client", server: "dist/server/index.js" }
```

**`tanstack`** — TanStack Start in SPA mode; server functions (`/_serverFn/*`) and routes
(`/api/*`) run in the worker. Data routes must be `ssr: false`.

**`static`** — pure hosting. No worker and no worker manifest keys.

**Bring your own** — any bundler that emits a static `dist` plus **one self-contained ESM module**
with `export default { fetch }`. Point `"dist"` and `"server"` at them. The one rule: the module
must inline everything (esbuild `bundle: true`, Vite `inlineDynamicImports`). A code-split or CJS
worker deploys and then crashes at invocation.

## The split, and why it matters

```
browser ──fetch('/api/…')──▶ your worker ──@railcode/sdk──▶ platform
   │                              │
   no credentials            ctx.user (verified, unforgeable)
   no authority              all authority lives here
```

The frontend is static files. It holds nothing and proves nothing. Any check it makes is a UX
affordance, not a control — a user can call `/api/*` directly with `curl` from a logged-in
session, so **every rule must also exist in the worker**.

The only platform endpoints a v2 page may call are `/_api/me` and `/_api/logout` (the chrome
bar's). Prefer getting identity from your own worker route so there is one source of truth.

## Worker route patterns

### The shape

```ts
import { Hono } from "hono";
import { ApiError, ctx, db } from "@railcode/sdk";

const app = new Hono();

app.get("/api/me", (c) => c.json({ user: ctx.user }));

app.get("/api/notes", async (c) => {
  const rows = await db.collection("notes").query()
    .where("owner", "=", ctx.user!.id).order("updated_at", "desc").page(1, 100);
  return c.json({ items: rows });
});

export default app;
```

Everything hangs off `/api/*` (and `/_serverFn/*` on TanStack). Those are the paths the platform
carves to your worker; anything else is served as a static file.

### Relay platform errors verbatim

Wrap SDK calls so a `403`/`409`/`429` reaches the browser as itself. Collapsing them into a `500`
throws away every typed error the platform gives you.

```ts
async function relay<T>(c: Context, fn: () => Promise<T>) {
  try {
    return c.json(await fn());
  } catch (err) {
    if (err instanceof ApiError) {
      let body: unknown;
      try { body = JSON.parse(err.message); } catch { body = { detail: err.message }; }
      return c.json(body, err.status);
    }
    throw err;
  }
}

app.post("/api/charge", (c) => relay(c, () => connector("stripe").fetch("/v1/charges", { method: "POST" })));
```

Then the frontend can act on meaning:

```ts
if (res.status === 409) showConnectPrompt();      // connector not linked / needs re-auth
if (res.status === 429) showQuotaNotice();        // daily cap
if (res.status === 403) showNotAllowed();         // undeclared authority
```

### Cron routes must accept POST

The scheduler dispatches **POST**. A `GET`-only route 404s on every fire and looks like a broken
schedule, not a bug in your code.

```ts
app.post("/api/refresh", async (c) => { /* ... */ });
```

## Authorization is your code

There is no scoped store enforcing ownership any more. `db` is one flat store; a key prefix is a
convention, and the check is what makes it real.

```ts
// ❌ the id came from the caller — reading it proves nothing
const row = await db.collection("notes").get(c.req.param("id"));
return c.json(row);

// ✅ verify what you read against the verified caller
const row = await db.collection("notes").get(c.req.param("id"));
if (!row || row.owner !== ctx.user!.id) return c.json({ error: "not found" }, 404);
```

Prefer **404 over 403** for records the caller shouldn't know exist — a 403 confirms existence.

The product thesis lives here. Rules like "X submits, Y approves, X can't approve their own"
are worker code, in a place a user cannot reach:

```ts
app.post("/api/requests/:id/approve", async (c) => {
  const user = ctx.user;
  if (!user) return c.json({ error: "cron cannot approve" }, 409);
  const req = await db.collection("requests").get(c.req.param("id"));
  if (!req) return c.json({ error: "not found" }, 404);
  if (req.submitted_by === user.id) return c.json({ error: "cannot approve your own" }, 403);
  if (!user.is_admin) return c.json({ error: "approver role required" }, 403);
  await db.collection("requests").put(req.id, { ...req, status: "approved", approved_by: user.id });
  return c.json({ ok: true });
});
```

## Data modeling on a flat store

One store, so keys carry the structure. Pick a convention and keep it everywhere.

| Ownership | Key convention |
|---|---|
| Shared across everyone | `"<id>"` |
| Per user | `"<userId>:<id>"` |
| Per role/team | `"role:<roleUuid>:<id>"` |
| A singleton (settings) | `"settings"` |

Store the owner **inside the record too**, so a read can be verified without re-parsing the key:

```ts
await db.collection("notes").put(`${user.id}:${id}`, {
  id, owner: user.id, title, body, updated_at: new Date().toISOString(),
});
```

**Always paginate.** `query()` returns one page (default 100, max 500):

```ts
async function all(name: string) {
  const out = [];
  for (let page = 1; ; page++) {
    const rows = await db.collection(name).query().page(page, 500);
    out.push(...rows);
    if (rows.length < 500) break;
  }
  return out;
}
```

For anything genuinely large — analytics, history, joins — keep it in a warehouse and read it
through a saved query. KV filters, orders, and pages; it does not aggregate or join.

## Frontend patterns

**One small client module, and nothing else talks to the network.**

```ts
// src/lib/api.ts
async function call(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
  return res.status === 204 ? null : res.json();
}

export const api = {
  me: () => call("/api/me"),
  notes: () => call("/api/notes"),
  saveNote: (n: unknown) => call("/api/notes", { method: "POST", body: JSON.stringify(n) }),
};
```

Components and stores import `api`. They never `fetch` directly, never build URLs, and never see
a platform endpoint.

**Routing.** Give every top-level section its own path and put the open record in the path too
(`/companies`, `/companies/acme`). Never keep navigation in an in-memory `view` variable — deep
links, hard refresh, and back/forward must work, because these apps get pasted into Slack and
tickets. The platform falls back to `index.html` for unknown paths, so client-side routing needs
no config.

**State.** Keep shared/cross-component state in a store (Zustand in the scaffolds); use local
component state only for things that are genuinely local, like a form's in-progress input.

**Show real empty and error states.** An unconfigured connector, an unlinked personal account, or
an empty collection should render something honest and actionable — not a spinner forever.

## Files

Upload through your worker; the worker holds the bytes.

```ts
app.put("/api/files/:name", async (c) => {
  const body = await c.req.arrayBuffer();
  const meta = await files.put(c.req.param("name"), body, c.req.header("content-type"));
  return c.json(meta);
});
```

**Displaying many files — use the batch.** One `url()` per file is what exhausts the invocation's
subrequest budget:

```ts
// ❌ N subrequests
const urls = await Promise.all(names.map((n) => files.url(n)));

// ✅ one
const { items, missing } = await files.urls(names);
```

`missing` is data, not an error — render those names as unavailable rather than failing the page.

## LLM

`llm` runs in the worker, so the browser never holds a model call.

```ts
app.post("/api/summarize", (c) => relay(c, async () => {
  const { text } = await c.req.json();
  return llm.generate({ messages: [{ role: "user", content: `Summarize:\n${text}` }] });
}));
```

**Both entry points run a tool loop** when the tools carry `run`: `generate` resolves with the
finished answer, `stream` yields text and step events live. The one that refuses tools is
`llm.streamRaw()`, which exists to relay raw ndjson to a browser — there is nobody left in the
worker to execute a `run`. (Needs `@railcode/sdk` ≥ 0.3.0; before that, streamed loops failed on
their first turn.)

**Streaming to the page goes through `toNdjson()`.** Do not hand-roll a `ReadableStream` — the
helper turns a mid-stream failure into an error frame (the 200 is already sent, so it cannot be a
status) and stops the run when the client hangs up.

```ts
app.post("/api/chat", async (c) => toNdjson(llm.stream(await c.req.json(), { tools })));
```

**Never feed a file into the LLM.** File contents, file URLs, and file-derived payloads are a
managed agent's job, always.

## Delegating to a managed agent

The worker handles fast turns and hands off anything that must outlive the request.

```ts
app.post("/api/extract", async (c) => {
  const { file } = await c.req.json();
  const run = await agents.start("extractor", { file });          // returns QUEUED
  await db.collection("jobs").put(run.request_id, {
    owner: ctx.user!.id, file, status: "running",
  });
  return c.json({ requestId: run.request_id }, 202);
});

app.get("/api/extract/:id", async (c) => {
  const job = await db.collection("jobs").get(c.req.param("id"));
  if (!job || job.owner !== ctx.user!.id) return c.json({ error: "not found" }, 404);
  const run = await agents.get(c.req.param("id"));
  return c.json({ status: run.status, output: run.output_json });
});
```

The frontend polls `/api/extract/:id`. Do not try to hold the request open — the worker SDK
gives you no way to, and a `get()` loop drains the subrequest budget and still outlives its
token. See [worker-sdk.md](worker-sdk.md#managed-agents).

**Results can also arrive by themselves.** An **org** agent's `app_data_write` lands in the app's
shared scope, which **is** your flat store — so an agent can write straight into a collection your
worker reads, with no bridge at all.

## Cron

> **Alpha — expect this to change.** Function crons are the newest part of apps v2. The
> caller-less trigger model below is settled and the refusals are deliberate, but the limits
> it produces are under active review. `agent_runs.triggered_by_user_id` is already nullable
> precisely so that relaxing the agent restriction stays a design decision rather than a
> migration. **Do not build an app whose core loop needs a cron to do something this section
> says it cannot** — take the alternative below instead.

```yaml
crons:
  - schedule: "0 6 * * *"
    path: /api/refresh
```

**A cron invocation has no caller.** `ctx.user` is `null` and `ctx.trigger` is `"cron"`. That
one fact produces every limit here.

### What a cron cannot do

| Refused (`409`) | Why |
|---|---|
| `agents.start()` | A run is owned by `(app, caller)`. No caller, no owner |
| `agents.get()` | The same ownership pair — a cron cannot even poll a run an **http** invocation started |

All refuse up front, before any upstream call.

**The fourth limit is your own authorization code, and it is the one that bites.** A route that
reads `ctx.user.roles` or filters by `ctx.user.uuid` will throw under cron — or worse, return
everything, because the flat store enforces nothing. Branch on `ctx.trigger`, or guard early:

```ts
if (!ctx.user) return c.json({ error: "cron cannot do this" }, 409);
```

### What a cron CAN do

Everything else: `db` (including `db.scoped(kind, ownerUuid)` — the owner is an argument, not the
caller), `files`, `sql`, `query`/`savedQueries`, `llm`, `email`, `appUsers()`, `secrets`, egress,
and **org/service connectors** — those are the app's own authority, never a caller's.

That is wider than it first looks. A v2 worker's authority is its ratified `run_as: app` manifest,
so `ctx.user` is *attribution*, not permission. Cron loses only the surfaces whose authority is
intrinsically one specific person.

### Scheduled work on someone's personal account

Don't wait for the app cron — the platform already does this, on the **agent** plane, with a safer
identity:

1. Create a **personal** agent and give it the connector (Granola, Gmail, ...).
2. Give the agent its own schedule: `railcode agent schedule`.
3. The agent writes its results into its owner's USER scope.
4. Your worker reads them with `db.scoped(ownerUuid)`.

The agent's identity is fixed at `created_by_id`, and its manifest was ratified against that
field. If the owner leaves the org the run fails loudly instead of acting as somebody else — which
is exactly why this does not live on the app cron. See `agents/proposals` for the worked example.

### Operational rules

- The route must accept **POST**. A `GET`-only route 404s on every fire and looks like a broken
  schedule.
- **At-least-once, and runs may overlap.** Use `ctx.invocationId` as an idempotency key and make
  external side effects safe to repeat. Never promise "exactly once".
- Caps: 5 schedules per app, 1-minute minimum.
- A schedule pauses with a visible reason if the current deploy has no worker.

## Common pitfalls

| Pitfall | What happens | Fix |
|---|---|---|
| Checking permissions only in the frontend | Anyone can `curl` `/api/*` from a logged-in session | Re-check in the worker against `ctx.user` |
| Taking a user id from the request body | Trivially spoofed | Read `ctx.user.id` |
| Assuming a key prefix isolates data | It doesn't; `db` is flat | Verify the owner on read |
| Using `query()` without paging | Silently drops everything past the first page | Loop until a short page |
| A loop of `files.url()` | Burns the subrequest budget | `files.urls(names)` |
| `llm.streamRaw({ tools })` with `run` handlers | Throws — a relay can't execute a tool | `llm.stream()`, or drop `run` and handle the calls yourself |
| A `GET` cron route | 404s on every fire | Accept POST |
| Cron calling `agents.start()`/`get()` | `409` | Give the agent its own schedule (see [Cron](#cron)). **Connectors are fine under cron** since CLI 0.3.0 — the credential belongs to the row, not the caller |
| Swallowing `ApiError` into a 500 | The UI can't tell quota from forbidden | Relay `.status` verbatim |
| A hand-rolled `ReadableStream` for a stream | A mid-stream failure vanishes; a hang-up keeps burning tokens | `toNdjson(source)` |
| A code-split or CJS worker bundle | Deploys, then crashes at invocation | One self-contained ESM module |
| Adding `"server"` to a generation-1 app | Deploy `422` | Migrate first — one-way |
