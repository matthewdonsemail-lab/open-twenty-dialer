# Worker SDK (`@railcode/sdk`)

The backend SDK for apps v2 workers. Typed, dependency-free ESM, **no secrets and no addresses
inside it** — power is injected per invocation by the platform.

It runs in exactly two places: a **deployed Railcode worker**, and **`railcode dev`**. Anywhere
else (a browser bundle, a plain `node` script, a test harness) the first call throws an
instructive error. There is no browser build.

```ts
import { ctx, db, files, llm, agents, query, connector, email, secrets } from "@railcode/sdk";
```

## Contents

- [`ctx` — the verified caller](#ctx--the-verified-caller)
- [`db` — the flat store](#db--the-flat-store)
- [`files`](#files)
- [SQL and saved queries](#sql-and-saved-queries)
- [`llm`](#llm) · [`toNdjson()`](#streaming-to-your-frontend--tondjson)
- [Managed agents](#managed-agents)
- [Service connectors](#service-connectors)
- [Connectors someone owns personally](#connectors-someone-owns-personally)
- [`appUsers` and `dataConnectors`](#appusers-and-dataconnectors)
- [`email`](#email)
- [`secrets`](#secrets)
- [Errors](#errors)
- [Authority: the manifest](#authority-the-manifest)

## `ctx` — the verified caller

```ts
ctx.user          // { id, email, name, is_admin, roles: [{uuid, name}] } | null
ctx.trigger       // "http" | "cron"
ctx.invocationId  // this invocation's id — your idempotency key
ctx.waitUntil(p)  // extend past the response (deployed workers only)
```

`ctx.user` is **unforgeable**. It was verified at the platform gate and embedded in the
invocation token; app code cannot fake its caller. It is `null` **only** on cron triggers.

This is the foundation of every authorization decision you write. Never take identity or
ownership from the request body.

```ts
const user = ctx.user;
if (!user) return c.json({ error: "cron cannot do this" }, 409);
if (!user.is_admin) return c.json({ error: "forbidden" }, 403);
```

`ctx.user.roles` carries the **caller's own** roles. There is no way to list the org's full role
set from a worker.

## `db` — the flat store

**One flat key/value store per app.** No scopes, no namespaces, no per-user partition built in.
Data written by earlier deploys — including a v1 app's unscoped data before migration — is simply
there.

```ts
const notes = db.collection("notes");
await notes.put("key", { title: "hi" });
await notes.get("key");                    // null when absent
await notes.delete("key");
await notes.query().where("status", "=", "open").order("created_at", "desc").page(1, 100);
```

**You own partitioning and access control.** "Per-user" is a key convention plus a check you
write:

```ts
const key = `${ctx.user!.id}:${recordId}`;          // partition
const row = await notes.get(key);
if (!row) return c.json({ error: "not found" }, 404);  // and the check
```

Do not simulate the old `db.user` / `db.role()` scopes and assume the platform enforces them. It
does not. A prefix is a convention; the check is what makes it real.

### `list()` is first-page-only

The single sharpest edge in the SDK. `query()` returns **one page** — default 100, max 500. A
large collection silently loses its tail unless you paginate:

```ts
const out = [];
for (let page = 1; ; page++) {
  const rows = await db.collection(name).query().page(page, 500);
  out.push(...rows);
  if (rows.length < 500) break;
}
```

### Frozen v1 scopes (migrated apps only)

After `railcode migrate`, the app's old user/role-scoped browser data is **frozen**: readable for
live migration, writable by nothing.

```ts
await db.scoped(userId).collection("drafts").query();      // read-only
await db.scopedRole(roleUuid).collection("shared").get(k); // read-only
```

There is no write path. Copy what you need into the flat store under your own keys.

## `files`

Server-plane: **your worker holds the bytes**, so uploads are one direct call and downloads are a
streamed `Response`. No presign negotiation.

```ts
await files.put("report.pdf", bytes, "application/pdf");  // string | ArrayBuffer | Blob | stream
const resp = await files.get("report.pdf");               // Response | null
await files.list();
await files.delete("report.pdf");
```

### Handing a file to your frontend

```ts
const one   = await files.url("report.pdf");                    // { name, url, expires_in }
const batch = await files.urls(["a.png", "b.png", "c.png"]);    // { items, missing }
```

**Use `urls()` for more than one file.** A worker invocation has a finite subrequest budget
(~100), and a loop of `url()` is exactly what exhausts it. `urls()` presigns the whole batch with
one storage client. Names with no stored file come back under `missing` rather than throwing — a
partial answer is the normal case. Cap: 100 names per call (`422` above it).

## SQL and saved queries

Prefer **saved queries** — an admin publishes them, so the app never embeds SQL:

```ts
await savedQueries();                       // [{ name, description, params }]
await query("revenue_by_month", { year: 2026 });
```

Direct SQL only when the user explicitly asks. Always bind parameters:

```ts
await data("warehouse").runSQL("select * from orders where id = $1", [id]);
await postgres("warehouse").runSQL(...);    // dialect-pinned variants
await bigquery("analytics").runSQL(...);
await turso("edge").runSQL(...);
```

Both require the manifest: `saved_queries:` for the first, `adhoc_sql:` for the second.

## `llm`

```ts
const r = await llm.generate({ messages: [{ role: "user", content: "..." }] });
const stream = await llm.stream({ messages });        // for await (const ev of stream)
await llmProviders();                                 // what the org has configured
```

Text in, text out. **No embeddings, no vector search, no multimodal input.**

### Tool loops

Tools that carry a `run` make the SDK drive the loop: it validates each call's args against the
schema, executes `run` **in your worker**, feeds `summarize(result)` back, and repeats until the
model answers. Both entry points do it.

```ts
await llm.generate({ messages, tools });                    // resolves with the finished answer
for await (const ev of llm.stream({ messages, tools })) {}  // text + step events, live
```

`llm.streamRaw()` is the exception, and deliberately: it hands you the ndjson bytes to relay
straight to a browser, so there is nobody left in the worker to execute a `run`. It refuses
run-BEARING tools and accepts run-less defs — which is exactly the relay a browser-side loop
needs (see [migration.md](migration.md#the-interactive-llm-tool-loop)).

Requires `@railcode/sdk` ≥ 0.3.0. Earlier builds routed the internal stream through `streamRaw`,
so every streamed tool loop died on its first turn with `tool_loop_error`.

Manifest: `llm: true`. Per-app daily token cap; exceeding it returns a typed `429`.

### Streaming to your frontend — `toNdjson()`

Never hand-roll the `ReadableStream`. `toNdjson(source, opts?)` turns any iterable of JSON values
into an ndjson `Response` you return straight from a route:

```ts
app.post("/api/chat", async (c) => {
  const { messages } = await c.req.json();
  return toNdjson(llm.stream(messages, { tools }));
});
```

It owns the two things that are easy to get wrong:

- **A mid-stream failure cannot be an HTTP status** — the 200 is already sent. It becomes a
  terminal `{"type":"error", error, message}` frame, and `errorFrame()` keeps the platform's
  typed code (`daily_token_limit_exceeded`, `provider_auth_error`, …) so the browser maps it to
  advice exactly as on a non-streamed call.
- **A client that hangs up must stop the work.** Cancelling closes the source generator, so an
  abandoned run stops spending tokens.

It takes ANY iterable, so a route that interleaves its own frames and persists the turn is still
one call — write an async generator and return `toNdjson(frames())`. See `apps/chat`.

The browser side is ~20 lines: read, split on `\n`, `JSON.parse` each line, and keep a buffer
because a network chunk can split a line. Copy it from `apps/chat/frontend/src/lib/api.ts`.

## Managed agents

A worker can start a managed-agent run and read its outcome. This is how a v2 app reaches file
AI, code execution, and anything that must outlive the request.

```ts
const run = await agents.start("digest", { url });   // returns QUEUED immediately
run.request_id                                        // the poll handle
const later = await agents.get(run.request_id);
```

**Runs are never awaited in-band.** A worker invocation is one request with a finite subrequest
budget and a token that expires; an agent run is minutes of work. The normal shape is:

1. `agents.start()` in a worker route.
2. Return `request_id` to your frontend (or persist it in `db`).
3. The frontend polls a route of yours that calls `agents.get()`.

**There is no `agents.invoke()` on the worker plane** — no call that waits for a run. Don't
reach for one, and don't build one out of `get()` in a loop: each poll spends a subrequest, and
the token expires before a long run finishes, so the loop loses the tail of the very run it is
waiting on. Persist the handle instead:

```ts
const run = await agents.start("digest", input);
await db.collection("jobs").put(jobId, { requestId: run.request_id });
return c.json({ status: "running", requestId: run.request_id }, 202);
```

The **browser** SDK does have `agents.invoke()`, and the asymmetry is deliberate: a page has
neither a subrequest budget nor an expiring token, so it can wait out a long run without holding
anything open server-side. Polling belongs there or in a later invocation — never in the worker
that started the run.

### Rules that bite

- **Declare the agent.** `agents: [name, ...]` in `manifest.yaml`, ratified. Like personal
  connectors, **a missing declaration is a refusal, not pass-through** — an undeclared agent is
  `403 agent "x" was not in the manifest`, even one the caller could invoke from the dashboard
  themselves. An agent that doesn't exist is `404`.
- **Cron cannot start a run — or poll one.** No caller means no run owner, and `agents.get()`
  matches the same `(app, caller)` pair, so both refuse with `409`. Give the agent **its own
  schedule** instead of driving it from an app cron. (Function crons are alpha; see
  [app-patterns.md](app-patterns.md#cron).)
- **A run is owned by `(app, caller)`.** `agents.get()` reads only runs *this app* started for
  *this caller*. A run started from the dashboard is `404` to the worker, and vice versa.
- **Prefer org agents.** An **org** agent's `app_data_write` lands in the app's shared scope,
  which **is** your flat store — so the agent's results appear in `db` with no bridge. A
  **personal** agent writes into its owner's user scope, which on a migrated app is the frozen,
  read-only area.

### The durable pattern

```ts
// 1. queue
app.post("/api/extract", async (c) => {
  const run = await agents.start("extractor", { file: name });
  await db.collection("jobs").put(run.request_id, {
    owner: ctx.user!.id, status: "running", file: name,
  });
  return c.json({ requestId: run.request_id }, 202);
});

// 2. poll — and check ownership, because db does not
app.get("/api/extract/:id", async (c) => {
  const job = await db.collection("jobs").get(c.req.param("id"));
  if (!job || job.owner !== ctx.user!.id) return c.json({ error: "not found" }, 404);
  const run = await agents.get(c.req.param("id"));
  return c.json({ status: run.status, output: run.output_json });
});
```

## Service connectors

The org's shared third-party accounts. An admin owns the credential; the backend pins the host
and injects it — your worker never sees it.

```ts
await serviceConnectors();                       // what's enabled
await serviceConnectorDocs("stripe");            // how to call it
const r = await connector("stripe").fetch("/v1/charges", { method: "GET" });
await r.json();
```

Manifest: `connectors: { stripe: ["GET /v1/charges"] }` — bound **per endpoint**, not per
connector.

## Connectors someone owns personally

**Removed in CLI 0.3.0 / `@railcode/sdk` 0.4.0: there is no separate "personal connector".**
`personalConnections` and the `personal_connectors:` manifest key are gone; calling the old
surface returns **410** with the replacement name in the body.

A connector someone links for themselves is the *same object* as a shared one — an org row with
an `owner` and an `access_mode` — so it uses the same handle:

```ts
await connector("gmail-jp").tools();                          // mcp: callable tools
await connector("gmail-jp").call("send_email", { ... });      // mcp: run one
await connector("stripe").fetch("/v1/charges");               // http: method/path proxy
await serviceConnectors();                                    // what this app may call
```

Manifest: `connectors: { "gmail-jp": ["send_email"] }` — `["*"]` for the whole row. **A missing
declaration is a refusal, not pass-through.** An app declaring `gmail-jp: ["send_email"]` can
send as that account and cannot read its inbox. Undeclared → `403`.

**Linking left the app.** There is no `connect()` and no `redirect_url` to return to a frontend:
the person runs `railcode connector link gmail` or links from the dashboard, and the row exists
before your app names it. Do not build a connect flow.

**Names are not provider ids.** The row is named by whoever linked it, and when two people in one
org hold the same provider — or the plain name is taken — it is suffixed (`gmail-jp`,
`gmail-sebastian`). Read the name from `railcode connector list`; never assume it equals the
provider.

**Crons now work.** This is the reversal from the old model: a personal connector acted as
`ctx.user` and returned `409` under cron, which has no user. A connector's credential belongs to
the **row**, so a scheduled route can call one. Access is still checked against the app's
declaration and the row's sharing.

## `appUsers` and `dataConnectors`

Read-only org discovery, for building pickers and showing names:

```ts
await appUsers();          // [{ id, email, name, is_admin }] — id matches ctx.user.id
await dataConnectors();    // [{ name, engine }] — never a DSN
```

Both require the ratified `run_as: app` manifest.

## `email`

```ts
await email.send({ to, subject, html });
```

Send-only, platform-pinned sender, appended disclaimer. **You cannot receive email or send from a
custom address.** When mail must come from a specific person's own account, use a Gmail
**connector** they own instead. Manifest: `email: true`. Per-app daily cap → typed `429`.

## `secrets`

```ts
secrets.STRIPE_KEY        // ambient, per-app
```

Set them with the CLI, never in code:

```bash
railcode secrets set STRIPE_KEY      # hidden prompt or piped stdin
railcode secrets import .env
railcode secrets ls                  # names + set-at + digest, never values
railcode secrets rm STRIPE_KEY
```

Write-only and **live app state, not part of a deploy** — every deploy, revert, and cold revert
re-applies the current set, so a revert can never resurrect a rotated value. Caps: 64 per app,
5 KB per value.

## Errors

```ts
import { ApiError, LlmRunError } from "@railcode/sdk";
```

`ApiError` carries `.status` and the body. **Relay it verbatim** from your worker routes — the
frontend's 403/409/429 handling depends on the status surviving the extra hop:

```ts
try {
  return c.json(await db.collection("notes").get(key));
} catch (err) {
  if (err instanceof ApiError) return c.json(JSON.parse(err.message), err.status);
  throw err;
}
```

Statuses worth handling by name: `403` undeclared authority, `409` not-connected or
cron-incompatible, `429` a daily cap (typed quota).

## Authority: the manifest

`manifest.yaml` sits beside `railcode.json`. **On v2 `run_as: app` is mandatory** — the worker is
the principal, and there is no caller whose personal grants could stand in.

```yaml
run_as: app
llm: true
email: true
saved_queries:
  - revenue_by_month
adhoc_sql:
  - warehouse
connectors:
  stripe:
    - GET /v1/charges
  gmail-jp:
    - send_email
agents:
  - digest
egress:
  - api.example.com
  - "*.internal.example.com"
crons:
  - schedule: "0 6 * * *"
    path: /api/refresh
```

Declare **only what the worker actually uses**. A deploy whose manifest adds operations the
deployer doesn't hold lands as a **pending diff awaiting approval** rather than silently granting
itself power.

```bash
railcode manifest validate        # strict local parse, before deploying
railcode manifest show <app>      # the ratified doc + any pending diff
```

Two keys are refusals rather than pass-through when absent — `agents` and `connectors`.
Everything else falls back to the caller's own grants when there is no manifest, which on v2 is
moot because `run_as: app` is required.
