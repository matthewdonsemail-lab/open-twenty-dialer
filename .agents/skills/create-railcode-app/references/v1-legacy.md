# Generation 1 (legacy browser-SDK apps)

> **Read this only to maintain an app that already exists at generation 1.**
>
> **Never build anything new from this file.** Every app created today is generation 2
> (apps v2), where there is no browser SDK at all — the platform will not serve `/_api/sdk.js`
> data calls to a v2 app, so a page written from this reference cannot work there. For new
> work read [worker-sdk.md](worker-sdk.md); to move an existing app across read
> [migration.md](migration.md).

## What still works on a v1 app

Generation 1 apps keep running, and you can keep changing them indefinitely:

- **`railcode deploy` is never gated by generation or CLI version.** The minimum-CLI floor
  applies to *creating* apps, not to deploying an existing one. A current CLI deploys a v1 tree
  exactly as an old one did.
- **`railcode dev` still serves `/_api/sdk.js`** and emulates the v1 data plane, so local
  development is unchanged.
- `railcode pull`, `railcode app kv`, `railcode app files`, `railcode apps ...`, analytics, and
  deploy history all behave the same.

## What you can no longer do

- **You cannot create a new v1 app.** `railcode init` scaffolds only v2 stacks, and the server
  assigns generation 2 to every new app. There is no flag and no downgrade.
- **Never add a `"server"` key to a v1 `railcode.json`.** The deploy is refused with `422`. A
  worker requires generation 2, which requires the one-way migration gate.
- **Migration is one-way.** Once an app is generation 2 it never goes back, and its scoped
  browser data freezes. See [migration.md](migration.md).

## Keeping a v1 app healthy

Prefer small, in-place changes. When someone asks for something v1 cannot provide — a secret the
browser must not see, a call the connector proxy can't authenticate, a scheduled job, a backend,
authorization that must actually hold — that is the signal to **migrate**, not to stretch the
browser SDK further. Tell the user why and proceed with the migration; do not build a
browser-side stand-in and offer v2 as an afterthought. In particular, never park a credential in
KV, a settings collection, or the page so the browser can call something itself: every user who
can open the app can read it. The signals and the rule are in
[SKILL.md](../SKILL.md#when-a-v1-app-cant-do-whats-asked); the procedure is in
[migration.md](migration.md).

Check which generation you are actually holding before you touch anything:

```bash
railcode apps show <app> --json | grep generation     # 1 = legacy, 2 = apps v2
```

---

The rest of this file documents the generation-1 platform as it behaves today: zero-config auth,
the browser SDK globals, access policies, KV/files scoping, SQL, service connectors, and the
in-page LLM.

## Request Routing

Railcode is multi-tenant: every app belongs to an **organization**, and apps are static apps
served from per-org subdomains. The host is two labels deep:

```text
https://<app_slug>.<org_slug>.<BASE_DOMAIN>/      e.g. https://notes.acme.railcode.app/
```

The same host also exposes the platform data plane at **`/_api/*`**. Because the browser
calls same-origin URLs, app code needs no CORS config, no API URLs, and no credentials. The
backend scopes every `/_api/*` call server-side to `(org, app)` from the request's host +
session — the app never names itself or its org in client code.

App paths resolve like Caddy's `try_files`: the exact file, then `<path>/index.html`, then the
app's root `index.html`. That last step is an unconditional SPA fallback, so client-side routes
and deep links work with no config (a mistyped asset path also returns `index.html` with a
`200`, not a `404`). `railcode dev` mirrors this, so local and deployed routing agree.

Reserved subdomains (the dashboard/login parent, `api`, `admin`, etc.) cannot be app slugs.

## Auth And App Identity

Railcode derives context from server-controlled request state, not from browser JavaScript:

- **Serving (app pages + `/_api/*`)** is gated by a **parent-scoped serving cookie**
  (`Domain=.<parent>`), the only cross-subdomain credential. The platform verifies org
  membership and per-app access before any app byte or `/_api/*` response is served. App
  identity comes from the `Host` header.
- **Dashboard/API** (the control plane) uses **bearer tokens** — `Authorization: Bearer
  <token>` — with no cookies/CSRF.
- **CLI** uses a long-lived, revocable **personal API token** and the selected organization
  context for deploys and local-development proxy calls.

The "magic": frontend code just calls same-origin `/_api/*`, and the backend already knows
both who is calling and which app/org is calling.

## SDK Surface

Every app loads the SDK with a same-origin script tag:

```html
<script src="/_api/sdk.js"></script>
```

On load it attaches a fixed set of globals to `window`. There is no `loadRailcodeSdk()`
bootstrap and no wrapper module — call the globals directly (in TypeScript, `declare` them).
Every call is same-origin against `/_api/*`, credentialed by the serving cookie:

```js
const who   = await me();          // user includes is_admin + assigned {uuid,name} custom roles
const people = await appUsers();   // [{ uuid, name, email, is_admin }] — no role memberships
const orgRoles = await roles();    // [{ uuid, name, description, is_member }] — every custom org role

await db.collection("notes").put("n1", { text: "hi", n: 3 });   // app-wide (== db.shared)
await db.user.collection("notes").get("n1");                    // the caller's private scope
await db.role(roleUuid).collection("notes").list();            // one org role's scope

await files.upload("logo.png", blob, "image/png");             // shared; files.user / files.role(uuid) too
const url = files.url("logo.png");
const resolved = await files.urls(["logo.png", "avatars/alice.png"]);

const rows = await postgres("analytics").runSQL("select * from orders where id = $1", [id]);
const bq   = await bigquery("warehouse").runSQL("select id from `ds.orders` where id = @p", []);
const any  = await data("analytics").runSQL("select 1");   // engine-generic (dispatch by kind)
const conns = await dataConnectors();             // [{ engine, name }]

const mine = await query("my_orders", { region: "emea" });  // invoke a saved query by name
const qs   = await savedQueries();                // [{ name, description, params, version }]

const resp = await connector("stripe").fetch("/v1/charges", { method: "POST", body });
const svc  = await serviceConnectors();           // [{ name, description, auth_type, allowed_methods }]

const out  = await llm.generate("Summarize this record.", { metadata: { feature: "summary" } });

const gmailTools = await connector("gmail-jp").tools();            // this app's declared subset
const sent = await connector("gmail-jp").call("send_email", { recipient_email, subject, body });
```

The globals are exactly: `me`, `appUsers`, `roles`, `designSystem`, `db`, `files`, `data`, `postgres`,
`bigquery`, `turso`, `dataConnectors`, `query`, `savedQueries`, `connector`,
`serviceConnectors`, `llm`, `llmProviders`, `email`, `agents`. (`personalConnections` still
exists as a **thrower** — see Personal Connectors below.) Notes:

- `me()` returns nested objects. Use **`me().user.uuid`** for stable ownership checks, not to
  simulate storage scoping; use `db.user` / `files.user` for private data.
  `me().user.is_admin` is true for org owners and admins, `me().user.roles` is the
  caller's assigned custom roles as `{ uuid, name }[]`, and `me().user.is_app_owner` tells
  the caller whether they hold the running app's owner grant.
  These are UI hints only; server-side authorization remains authoritative.
- SQL runs through the database namespaces: `data(name)` is engine-generic (dispatches on the
  connection's stored kind server-side); `postgres(name)` / `bigquery(name)` / `turso(name)`
  are dialect-pinned and only reach connections of that engine. `dataConnectors()` lists the
  configured connections as `{ engine, name }`, where engine is `postgres`, `bigquery`, or
  `turso`.
- `agents.invoke(name, input?)` starts a managed agent run and polls it to a terminal status
  for you (`success`/`failed`/`cancelled`/`limit_exceeded`); runs execute off the request, so a
  long agent no longer risks a gateway timeout. `agents.start(name, input?)` returns
  immediately with the `queued` run instead, and `agents.get(requestId)` reads it back — use
  the pair to show progress rather than block on `invoke()`.

The SDK provides platform navigation/logout chrome, so do not build a competing logout flow.
It also provides a live activity inspector, toggled with ``Ctrl+` ``. Do not swallow SDK
errors; surface useful error states in the app.

## Access Policies

Access governs **who, within the app's org, may open the app** — distinct from org membership
(non-members never reach an org's apps at all). A user who can't access an app gets a **404**
(existence hidden), never a bare 403.

An app's `access_mode` is one of:

- **`organization`** — every org member (the **default** for a newly created/deployed app).
- **`private`** — owners and editors only.
- **`restricted`** — owners and editors, plus explicitly-granted members.

Grants are **owner**, **editor**, or **member** (viewer). The editor tier (CLI 0.1.35 + the
matching server) is a co-deploy right, not an audience share: an editor may deploy, revert,
pull source, and read analytics, may open the app in **every** mode, and keeps that grant
across mode changes — but cannot delete, archive, transfer, or change the access mode. Editors
may add/remove individual **viewers** while the app is `restricted`.

Org admins/owners **bypass** per-app access — they see and manage every app in the org.
Access is read/set in the **admin UI** or with `railcode apps access` / `set-access` /
`add-editor` / `add-viewer`. The `AppOut` payload carries both `can_manage` and `can_edit`.

`appUsers()` returns the app's org members (`{ uuid, name, email, is_admin }`) without custom
role memberships; use it for assignee pickers, mentions, and display, not as an authorization
check. `roles()` returns every custom org role, including empty roles, as
`{ uuid, name, description, is_member }` (`is_member` flags the roles the caller belongs to);
match those UUIDs against `me().user.roles` when building role-aware UI. The server remains
authoritative for access.

## KV Store

`db.collection(name)` is a per-app JSON key/value store. Mutations: `put(key, value)`,
`get(key)`, `delete(key)`, `list()`.

**Storage scopes.** `db.collection(...)` is app-wide (an alias for `db.shared`, shared across
the app's allowed users). Use `db.user` for the caller's own private records and
`db.role(uuid)` for records shared within one org role — each scope is a separate namespace,
so the same `(collection, key)` never collides:

```js
await db.collection("messages").put(messageId, message);        // shared (app-wide)
await db.user.collection("drafts").put(draftId, draft);         // the caller's private data
await db.role(roleUuid).collection("reports").put(id, report);  // one org role's data
```

`db.role(uuid)` requires the caller to be a live member of that role (owner/admin may reach
any); discover role UUIDs with `roles()`. The server enforces scope access — the namespaces
are not a client-side convenience.

For anything that can grow past a small list, use the query builder instead of `list()`:

```js
const newest = await db.collection("messages")
  .query()
  .orderBy("updatedAt", "desc")
  .page(1, 50);

const page = await db.collection("messages")
  .where("roomId", "eq", roomId)
  .orderBy("updatedAt", "desc")
  .page(1, 50);                       // page(pageNumber, size?) — size is a number

const mine    = await db.collection("drafts").prefix(`${who.user.uuid}:`).page();
const changed = await db.collection("messages").query().updatedSince(lastSeenIso).count();
const first   = await db.collection("messages").where("pinned", "eq", true).first();
```

`where()` and `prefix()` can start a query from a collection. For pure ordering/paging
with no filter, or for updated-time filters, start with `query()` first —
`db.collection("messages").orderBy(...)` and `.updatedSince(...)` are not collection
methods.

Query semantics (the dev engine is a byte-for-byte port of the backend, so dev matches prod):

- `where(field, op, value)` operators are the **string names** `eq`, `ne`, `gt`, `gte`,
  `lt`, `lte`, `in` — not symbols. `in` takes an array.
- `field` is a virtual field — `key` (string) or `updatedAt`/`updated_at` (datetime; no `in`)
  — or a **dotted JSON path** into the stored value (`done`, `assignee.email`). The
  comparison is typed by the operand (number/boolean/string), not lexicographic. A
  missing/null field excludes the row.
- `prefix()` does a byte-range key scan; `updatedSince()` is inclusive, `updatedBefore()` is
  exclusive; `orderBy(field, "asc"|"desc")` defaults to `key`/ascending.
- Paging is 1-based; **default size 100, max 500**. `list()` returns the first page of all
  rows (shaped `{ key, value, updated_at }`); prefer `page()`/`first()`/`count()` for large
  collections.

## Files

Files are per-app objects:

```js
await files.upload("logo.png", blob, "image/png");   // upload(name, data, contentType?)
const url = files.url("logo.png");                    // GET URL (use in <img src>, fetch)
const entries = await files.list();                   // [{ name, content_type, size, updated_at }]
const resolved = await files.urls(["logo.png", "docs/report.pdf"]);
// { items: [{ name, url, expires_in }], missing: [] }
await files.delete("logo.png");
```

`data` may be a `Blob`, `ArrayBuffer`, or typed array; the content type is inferred from a
`Blob` when omitted. File names cannot start with `/`, contain `\`, use `.`/`..` traversal
segments, or begin with a `users/` or `roles/` segment (reserved — such a name is rejected
400); `/` is otherwise supported for nested paths. Use `files.urls(names)` for galleries and
other file-heavy views: it resolves up to 100 existing files with one authenticated request,
reports missing names, and caches resolved URLs in memory until shortly before expiry. Served
bytes are returned `Content-Disposition: attachment` + `nosniff`.

Files carry the **same scopes** as KV — `files.shared` (== bare `files.*`), `files.user`, and
`files.role(uuid)` — so the same file name never collides across scopes. `railcode dev`
emulates every scope (and `urls`) on local disk.

## SQL (Postgres / BigQuery / Turso)

Use saved queries for database access unless the user explicitly tells you to use direct or
ad-hoc SQL. The direct SQL APIs below exist for explicitly requested ad-hoc SQL only; normal
apps should invoke admin-published saved queries with `query(name, params)`.

An admin registers global SQL connections server-side. Browser apps query them through a
database namespace without ever seeing DSNs, passwords, or service-account keys:

```js
const rows = await postgres("analytics").runSQL(
  "select id, total from orders where customer_id = $1",
  [customerId],
);
// rows is an array of row objects, plus rows.columns / rows.rowcount / rows.truncated
```

Rules:

- `data('name').runSQL(sql, params)` runs against a connection of **any** kind — the backend
  dispatches on the connection's stored engine. The dialect-pinned `postgres('name')` /
  `bigquery('name')` / `turso('name')` only reach connections of that engine (a mismatch
  is a 404). Either form takes `.runSQL(sql, params)`, or `.runSQL(...)` with no name for the
  connection named `default`.
- **postgres**, **bigquery**, and **turso** are supported; the backend rejects other
  engines. The query is forwarded verbatim and never translated, so write in the target
  engine's SQL dialect (Postgres uses `$1` placeholders; BigQuery/Turso use `?`).
- Always use placeholders + a params array; never concatenate user
  input.
- Call `dataConnectors()` to discover configured connections as `{ engine, name }`. Expect it
  to be empty in unauthenticated local dev (and show a clean empty state).
- The server caps result rows (the envelope's `truncated` flag tells you when it did).
- On Postgres and Turso the platform opens sessions **read-only**, so writes fail regardless of
  the credential. BigQuery has no session-level read-only mode; its connection credential's
  privileges are the boundary. Treat all app SQL as read-only.
- Do not use these direct SQL APIs unless the user explicitly requested direct/ad-hoc SQL.

## Saved Queries

A **saved query** is a named, versioned SQL template an org
admin publishes against one data connection. Apps invoke it by name — the typed,
grant-gated alternative to writing ad-hoc SQL in the app:

```js
const qs   = await savedQueries();   // [{ name, description, params, version }] — never the SQL
const rows = await query("my_orders", { region: "emea" });   // limit omitted → server binds its default
```

- `query(name, params?)` returns the same rows shape as `runSQL` (array of row objects plus
  `.columns`/`.rowcount`/`.truncated`). Params are **named and typed**
  (`string|int|float|bool`, declared by the admin); a wrong type, a missing required param,
  or an undeclared param is a clean `400` naming the param. Params declared with a default
  are optional.
- **Always prefer saved queries instead of ad-hoc SQL** unless the user explicitly requested
  direct/ad-hoc SQL: admins can grant-gate invocation per query, the SQL stays server-side,
  and per-caller row scoping comes free. `savedQueries()` tells you what's callable; ask the
  org admin (or use `railcode query create`, admin-only) to publish new ones.
- Invoking an unknown query is a `404`; a query the viewer isn't granted is a `403` — show
  a clean state for both.

## Service Connectors (third-party HTTP)

A **service connector** is an admin-configured proxy to a downstream SaaS API (Stripe,
Mixpanel, …). The app names a connector and supplies only the method, path, and body; the
backend pins the host and injects the credential the app never sees:

```js
const conn = connector("stripe");
const resp = await conn.fetch("/v1/charges?limit=3");                 // GET by default
const post = await conn.fetch("/v1/charges", { method: "POST", body: "amount=500&currency=usd" });
if (resp.ok) {
  const data = await resp.json();   // also: await resp.text(), resp.status, resp.headers
}
```

`serviceConnectors()` lists what this app may call as
`{ name, description, auth_type, allowed_methods }`. The proxy rejects a method not in
`allowed_methods` (405) and strips upstream auth/`Set-Cookie` headers; the response is
truncated at a size limit (`resp.truncated`).

## Personal Connectors — REMOVED

**Personal connectors no longer exist.** As of CLI 0.3.0 / `@railcode/sdk` 0.4.0 they were folded
into ordinary connectors: an account someone links is an org row with an `owner` and an
`access_mode`, reached through the same `connector()` global a shared credential uses.

`personalConnections` is **still bound on `window`**, deliberately — a v1 bundle's call sites are
frozen and deleting the object would turn each one into `undefined is not a function`, thrown in
the browser before any request left it. Instead every method still issues its old request and the
platform answers **410**, so the developer gets an explanation and the platform gets a log line
naming the app that is still calling.

The 410 body carries what you need:

```json
{
  "error": "personal_connectors_removed",
  "message": "Your \"gmail\" is now the connector \"gmail-jp\", which you own.",
  "your_connectors": [ { "name": "gmail-jp", "provider": "gmail", "kind": "http", "tools": true } ],
  "replacement": "connector('gmail-jp').call('send_email', { ... })",
  "note": "This is a generation-1 app. connector(name) is already in the platform SDK it loads
           from /_api/sdk.js, so no migration to apps v2 is required — but the call site is in
           your bundle, so the app must be rebuilt and redeployed."
}
```

**Fixing a v1 app does not mean migrating it to apps v2.** `connector()` is already in the SDK
served from `/_api/sdk.js`. Swap the call and redeploy:

```js
const tools = await connector("gmail-jp").tools();
const sent  = await connector("gmail-jp").call("send_email", { recipient_email, subject, body });
const mine  = await serviceConnectors();     // replaces personalConnections.list()
```

Three things to know while doing it:

- **The name may not be the old toolkit id.** Where two people in one org held the same provider,
  or the plain name was taken, the row was suffixed — `gmail-jp`, `slack-harshsharma`. The 410
  body names the replacement; `railcode connector list` is the authority.
- **`connect()` has no replacement, by design.** Linking left the app entirely: the person runs
  `railcode connector link gmail` or links from the dashboard. Delete the popup-and-poll flow;
  do not rebuild it.
- **`personal_connectors:` in the manifest is a deploy error now.** Replace it with `connectors:`
  naming the row and its tools — `connectors: { "gmail-jp": ["send_email"] }`. The authority
  model is unchanged in spirit: an undeclared row or tool is a `403`, and declaring
  `["send_email"]` still cannot read the inbox.
- **Custom MCP servers** work the same way, via `railcode connector add-mcp <name> <https-url>`.
  They keep their `custom_<slug>` name and, unlike before, **can** be declared by managed agents.

An already-deployed v1 app keeps serving throughout: authorization reads the projected grant rows
rather than the manifest document, so only `personalConnections` calls and re-deploys are refused.

`railcode dev` reproduces this exact gate locally against your app's `manifest.yaml` — see
[cli-workflow.md](cli-workflow.md#local-dev).

## LLM

API keys and the org default `(provider, model)` are admin-controlled — apps never see keys.
An org can configure **many models across many providers**; an app may optionally target a
specific `(provider, model)` from that catalog, or send neither and get the org default:

```js
const result = await llm.generate("Classify this customer.", {
  output: {
    type: "json",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["healthy", "risk", "unknown"] },
        reason: { type: ["string", "null"] }
      },
      required: ["status", "reason"]
    }
  },
  metadata: { feature: "customer-health", object_type: "customer", object_id: customerId }
});
// result: { text, output, usage, cost, provider, model, finishReason, requestId }
```

- Input is a prompt string **or** a `messages: [{ role, content }]` array. Options:
  `provider`, `model`, `system`, `output`, `tools`, `limits`, `signal`, `maxOutputTokens`,
  `metadata`. `temperature` is not supported.
- `llmProviders()` lists the callable catalog as `{ provider, default, models: [{ model,
  default }] }` (the same data `railcode llm providers` prints). Pass a catalog `model` (its
  provider is implied) and/or a `provider` (alone → that provider's default model); omit both
  for the org default.
- `llm.generate()` supports `{ output: { type: "json", schema } }`. JSON schemas run in
  **strict mode**: every object must set `additionalProperties: false` and list **all** keys
  in `required` — make optional fields nullable (`{ type: ["string", "null"] }`) rather than
  omitting them.
- **Never put that nullable union on an `enum` field** — `{ type: ["string", "null"], enum:
  [...] }` is an OpenAI-only idiom. Anthropic and Bedrock validate every enum member against
  the declared type and reject it, so the schema breaks the day an admin repoints the org at
  another provider; the gateway rejects the shape itself (a `400`, not a provider error) on
  both `output.schema` and `tools[].schema`. For an optional enum, add a sentinel member —
  `{ type: "string", enum: ["new", "won", "unknown"] }` — or spell it out with
  `{ anyOf: [{ type: "string", enum: ["new", "won"] }, { type: "null" }] }`. The sentinel is
  the safer default: it's unambiguous for the model and portable everywhere.
- `llm.stream(input, opts)` is an async iterator of `{ type: "text" }` / `{ type: "step" }` /
  `{ type: "done" }` / `{ type: "error" }` events; without run-bearing tools it is
  **text-only** and rejects JSON output client-side (on a tool loop, the JSON value rides a
  final non-streaming turn and lands on the `done` event). An error
  event's `error` field is a stable failure class (`provider_auth_error`,
  `provider_model_error`, `provider_rate_limited`, `provider_timeout`, `provider_bad_request`,
  `provider_error`) and `retryable` says whether repeating the same call could ever succeed —
  `false` means an org admin has to fix the provider config first, not a transient blip.
  `llm.generate()` failures carry the same classification in the thrown error's message.
- Always send `metadata` for audit/attribution. Expect daily token caps, provider timeouts,
  and input limits enforced server-side; render those failures as normal app states and do
  not retry indefinitely — branch on `retryable` rather than guessing.

### Tool calling — `llm.generate({ tools })` / `llm.stream({ tools })`

Both LLM calls accept `tools` — plain objects the app defines, wrapping anything it can
already do. A tool is `{ name, description, schema?, run?, summarize? }`:

- `description` is the model's only manual for the tool — say what it's for AND how to use
  it well.
- `schema` is JSON Schema for the args, validated **before** `run` (a bad arg is fed back to
  the model as the tool result, never thrown into app code). It reaches the provider as the
  tool's `parameters`, so the nullable-enum rule above applies here too.
- `run(args, ctx)` executes the tool; `ctx` is `{ signal, step }` — honor `signal` in long
  tools. The return value IS the result: the raw value reaches the UI as `step.result`,
  while the model sees only `summarize(result)` (default: JSON) clipped to ~6,000 chars.

When **every** tool has `run`, the SDK executes the whole agentic loop: the model plans, the
SDK validates args, runs the tool, feeds the clipped result back, and repeats until the
model answers.

```js
const sql = {
  name: "sql",
  description:
    "Run a read-only SQL query against the warehouse. SELECT only. You only see " +
    "a short preview of results, so aggregate and LIMIT inside the query.",
  schema: {
    type: "object",
    properties: { query: { type: "string" }, params: { type: "array" } },
    required: ["query"],
  },
  run: ({ query, params }) => data("warehouse").runSQL(query, params),
  summarize: (rows) => `${rows.length} row(s): ${JSON.stringify(rows.slice(0, 25))}`,
};

const result = await llm.generate("Which product had the most refunds?", {
  system: "You are the analytics assistant.",
  tools: [sql],
  limits: { maxSteps: 6 },
});
result.text;       // the final answer
result.steps;      // every executed tool call, in order, with raw results (render these)
result.stopReason; // "end" | "max_steps" | "max_tool_calls" | "timeout" | "aborted"
result.messages;   // full transcript — pass back as the next call's input to continue

for await (const event of llm.stream("Break that down by region.", { tools: [sql] })) {
  if (event.type === "step") upsertToolCard(event.step);   // twice per call; key by step.id
  else if (event.type === "text") append(event.text);
  else if (event.type === "done") finish(event);            // event.text, .steps, .stopReason
}
```

The mechanics worth knowing:

- **No new authority.** Tools execute in the page with the app's existing SDK access; every
  LLM turn rides the same audited `/_api` calls. The model can only reach what you wire into
  a `run` function. The wire carries only `{ name, description, schema }` — `run` and
  `summarize` never leave the page.
- **The model never sees big results.** It sees `summarize(result)` (default: JSON) clipped
  to ~6,000 chars; the raw return value stays on `step.result` for the UI. Failures — bad
  args, a throwing `run`, an unknown tool — are fed back to the model as observations, never
  thrown into app code.
- **One generation per answer.** `llm.stream` plans through streaming turns: text streams
  live as the model writes it (including any preamble before a tool call); tool calls are
  reassembled server-side and arrive complete (never token-streamed). Each executed call
  emits a `{ type: "step", step }` event **twice** — status `"running"`, then `"ok"`/
  `"error"` — with the same `step.id`, so upsert by id, don't append. The turn that ends the
  loop is the turn whose text is the answer; the finished run (`text`, `output`, `steps`,
  `messages`, `stopReason`) also lands on the `done` event.
- **Bounded by default.** `limits: { maxSteps: 8, maxToolCalls: 30, timeoutMs: 120_000 }`
  (planning turns / tool executions / wall clock); a step-budget line is injected into the
  system prompt for you. `signal` cancels, and aborting resolves **normally** with
  `stopReason: "aborted"` — branch on `stopReason`, not try/catch. Check `stopReason` before
  rendering: `max_steps` and `timeout` can leave `text` empty.
- **Run-less tools stay open.** Tools *without* `run` make the call a single turn: the
  model's requested calls come back unexecuted on `result.toolCalls` (`{ id, name,
  arguments }`, arguments already parsed), for apps that drive their own loop. On the stream
  path they arrive on the `done` event's `toolCalls`. Mixing run and run-less tools throws.
- **JSON output composes with the loop.** `{ output: { type: "json", schema } }` on a tool
  loop rides a final non-streaming turn; on `llm.stream` the value lands on `done.output`.

**This loop vs a managed agent:** the loop runs in the viewer's tab with the app's SDK
authority, bounded to seconds — right for interactive analysis over data the app already
reaches. Files, code execution, outside triggers (Slack, cron, API), unattended or durable
work, viewer-independent effects, and auditable run history all belong to a **managed
agent** instead — see the decision table in `SKILL.md` ("In-Page LLM vs Managed Agents").
The planes compose: a tool's `run` may delegate to an agent — see
[app-patterns.md](app-patterns.md).

## Email

`email.send(opts)` sends transactional email through the platform mail gateway. Apps control
only recipients, subject, and body — the platform pins the **sender** (a fixed
`Railcode <…@mail-service.railcode.app>` From) and appends a disclaimer, so an app name can't
smuggle an address token into the header. Keys never reach the browser.

```js
const res = await email.send({
  to: "user@example.com",             // string or string[]
  subject: "Your report is ready",
  html: "<p>It's <b>ready</b>.</p>",  // html and/or text (at least one)
  text: "It's ready.",
  cc: ["ops@example.com"],            // optional; cc/bcc also string | string[]
  replyTo: "support@example.com",     // optional
});
// res: { id, status, requestId }
```

- **Off by default.** `email` is not seeded org-wide. A `run_as: user` app needs the
  signed-in caller to hold the `email` grant (an admin grants it); a `run_as: app` app
  declares `email: true` in its manifest and it ratifies against the deployer's grants.
  Ungranted calls return `403`.
- **Governed, not free.** Each org has a daily recipient cap (attempts count against it,
  even failed sends) → `429` when exhausted; suppressed (bounced/complained) recipients are
  rejected. An unconfigured provider returns `503 email_unavailable`. Render all of these as
  normal app states — never retry loops.
- Use the SDK's email discovery surface when the UI must show availability or remaining quota;
  send through `email.send`.

## Local Dev Bridge

`railcode dev` preserves the same SDK calling style locally (see
[cli-workflow.md](cli-workflow.md) for full behavior):

- Identity (`me`), `appUsers`, `roles` (an empty custom-role list), KV, and files are
  **emulated on local disk** under
  `~/.railcode/dev/<instance>/<app>/`. The KV query engine is a port of the backend, so
  `where`/`prefix`/`orderBy`/`page`/`first`/`count` behave exactly as in production.
- `designSystem()`, `data()/postgres()/bigquery()/turso().runSQL()`, `dataConnectors()`,
  `query()`/`savedQueries()`, `serviceConnectors()`, `connector().fetch()`, `llm`,
  `llmProviders()`, and `email.send()` **forward to the real instance** when the CLI has a
  saved token — real provider, quota, databases, connectors, and **mail delivery** (real
  spend + data — `email.send()` sends actual email).
- Not logged in: `dataConnectors()`/`serviceConnectors()`/`savedQueries()` return empty and
  `data().runSQL()`/`query()`/`llm`/`email.send()`/`connector().*` return `503`
  (never `401`). The startup banner says which mode you're in, so you don't have to fire a
  request to find out.
- `connector().*` also forwards to the real instance when logged in, as **you**, the
  signed-in developer — but it's the one proxy here that is **not** simply bound by your own
  grants. The dev server reads your app's local `manifest.yaml` `connectors:` and reproduces
  the same app-plane gate production enforces: an undeclared row or tool `403`s locally too,
  before the request ever reaches the real account.

This lets agents build most app behavior without a live server, then layer on
production-backed SQL/LLM/connectors/email once credentials and access are available.
