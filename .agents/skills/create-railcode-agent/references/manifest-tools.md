# Agent Manifest Tools Reference

The manifest's `tools` object is a server-validated whitelist. The CLI has no
local schema — `agent create`/`update`/`test` send the JSON straight to the API —
so this list is a snapshot of the backend's current vocabulary, not a contract.
Confirm the live shape with `railcode agent pull` on an existing agent, and treat
every "Unknown ... key" or save-time error as authoritative over this file.

Top-level manifest keys: `kind`, `name`, `description`, `model`, `system`, `tools`,
`limits`. Anything else is rejected. Agent input is free-form (`input_json` reaches the model
unvalidated and the `system` prompt is the input contract); `input_schema` is not supported
and fails as an unknown key. `triggers` (cron) is
**not** a manifest key — schedules are a separate resource, see
[cli-workflow.md](cli-workflow.md). `visibility` (`org` | `personal`) is **not** inside
the manifest either — it's a sibling field the CLI sends alongside `manifest` via
`--visibility` on `create`/`update`/`test` (see [cli-workflow.md](cli-workflow.md)).

## `tools` keys

| Key | Type | Grants (runtime tool names) | Permission gate |
|---|---|---|---|
| `saved_queries` | `string[]` (query names) | `query(name, params)` | must be a ratified saved query in the org |
| `connectors` | `{connector: endpoint[]}` | `connector(name, method, path, body)` | each `connector:endpoint` must be ratified |
| `docs` | `string[]` (connector names) | `docs(connector)` — reads that connector's stored docs | connector must exist |
| `email` | `bool \| {emails: string[], domains: string[]}` | `email(to, subject, html/text, cc, bcc)` — recipients restricted to the allowlist when one is set | `email` grant (org default: `*`) |
| `adhoc_sql` | `string[]` (connection names) | `sql(connection, text, params)` — raw SQL, no firewall | `connector` grant; also a ratification **warning** ("prefer saved queries or read-only credentials") |
| `app_data` | `string[]` (app slugs) — KV **read** | `app_kv_get`, `app_kv_query`, `app_kv_count` against the app's KV (reads default to the `shared` scope and take an optional `scope` argument — see the read-scope note below) | `can_access_app` — same bar as opening the app |
| `app_data_write` | `string[]` (app slugs) — **write** | `app_kv_set`, `app_kv_delete`, `publish_artifact_to_app(name, app)` | `can_manage_app` — the app's **owner, or an org admin, only**. Declaring it for an app you don't manage is a **hard save failure**, not a warning |
| `app_files` | `string[]` (app slugs) — file **read**; no wildcard | `search_app_files` (metadata only: name substring/prefix, exact content type, lexicographic paging; each result reports its scope) and `load_app_file(app, name)` — downloads the one object into the sandbox at `/workspace/in/apps/{app}/{name}` and returns the local path + metadata to the model, never bytes, object keys, or storage URLs. Re-loading the same path in one run is idempotent (first snapshot wins). Both take the optional `scope` argument (note below) | `can_access_app` — same bar as `app_data`, ratified normally |
| `agent_kv` | `bool` | `agent_kv_get/set/query/delete` against the agent's own private, cross-run store | none beyond holding the agent itself |
| `personal_connectors` | `string[]` — toolkit names or `toolkit:tool` pairs (e.g. `["gmail"]` or `["gmail:send_email"]`); tool slugs are lowercase and case-sensitive, so copy discovery output exactly | `personal_tools(toolkit)` (list that toolkit's callable tools + schemas) and `personal_call(toolkit, tool, arguments)` (run one) | **`visibility: personal` only** — a save with this key on an `org` agent is a hard failure. Execution uses the agent owner's connected account and 403s if it is not connected. **Bundled toolkits only**: user-added `custom_<slug>` MCP connectors work in apps but are not declarable by managed agents |

A save that adds authority you don't hold (any grant-backed row above — `saved_queries`,
`connectors`, `docs`, `email`, `adhoc_sql`, `app_data`, `app_data_write`, `app_files`)
fails with the missing operations named — grant it via the org's roles/grants first
(`$manage-railcode-org`), or drop it from the manifest. `personal_connectors` is the one
exception: it has no grant to hold or ratify (there is no resource for a third party to
be granted — the agent's owner's own connection is the whole authority), so the only save
gate is `visibility: personal`.

## Sandbox

When sandboxing is configured for the deployment, every managed agent receives a per-run code
sandbox with shell and file tools; there is no manifest authority or per-agent switch for it.
Use the sandbox to write and run code, parse Excel/CSV files, inspect or assemble PDFs, edit
documents, unpack archives, and create output artifacts. The sandbox has no credentials or
standing org access: tenant data enters through explicit authorities such as `app_files`, and
durable outputs leave through `app_data_write` (`publish_artifact_to_app` or app KV writes).
The filesystem is ephemeral and disappears after the run.

## Read scopes

App KV and files hold three parallel scopes (`shared` / `user` / `role`). Every app READ
tool — `app_kv_get`/`app_kv_query`/`app_kv_count`, `search_app_files`, `load_app_file` —
takes an optional `scope` argument: `shared` (the default, app-wide), `user` (the
principal's own), or `role:<role_id>`; results report the scope they were read from, so a
key or filename existing in more than one scope stays unambiguous. A companion
`app_scopes_list(app)` tool discovers which scopes the agent may read. The **principal** is
a personal agent's owner; an org agent has no user principal, so it reads `shared` only.
Scope selection is authorized exactly like a human caller (`can_access_app` + scope
membership) with the admin cross-scope override **disabled** on the agent path — an agent
can never reach another user's scope or a role its principal doesn't belong to. WRITES are
unchanged and take no scope argument: one fixed scope per agent — `shared` for an org
agent, the owner's `user` scope for a personal one.

## Draft/test caveats

`railcode agent test` runs a draft with no `Agent` row, so persistent storage behaves
differently under `test` than under a saved `run`:

- **`app_data_write`'s write tools are offered and simulated, not persisted.**
  `app_kv_set`/`app_kv_delete` are
  validated exactly as a saved run would (`can_manage_app`, and the target app must
  exist), then recorded into a per-run, in-memory overlay instead of the app's real
  store. Within that **same test run**, `app_kv_get` reads the overlay first (so a
  `set` then `get` sees the write, and a `delete` reads as not-found) before falling
  back to the live store — read-your-writes, scoped to the one run.
  `app_kv_query`/`app_kv_count` still compile to SQL over the **live** store only and do
  **not** reflect this run's simulated writes; the tool result says so. Nothing here
  ever reaches the app's real KV — verify actual persistence with
  `railcode agent create` + `railcode agent run` instead of `test`.
- `publish_artifact_to_app` is likewise validated and accepted on a draft, but marks
  nothing — a draft has no run-end artifact sink to publish through.
- `agent_kv`'s tools are fully **omitted** on a draft: there is no
  `Agent` row yet to key that store on, so there's no overlay for it either.

Treat an untouched app/KV after `test` as inconclusive for `agent_kv`, but a `test` run's
own `app_kv_get`/output IS meaningful for `app_data_write` — just remember it isn't the
app's real data.

`publish_artifact_to_app` publishes a file the agent already wrote to the sandbox's
output directory, so it needs a live sandbox, present whenever the deployment has
sandboxing configured.

## `limits`

| Field | Default | Max |
|---|---|---|
| `max_steps` | 300 | 300 |
| `timeout_seconds` | 1200 | 1200 |
| `max_tool_calls` | 300 | 600 |
| `max_tokens_total` | 150000 | 6000000 |
| `max_tokens_turn` | 150000 | 200000 |

`max_tokens_total` is the cumulative run budget (input+output across all turns); `max_tokens_turn`
is the per-turn output ceiling. `max_tokens` is accepted as a **legacy alias** for
`max_tokens_total`.

### Sizing `limits`

A run that exhausts any cap dies as `limit_exceeded`, losing the work in flight — while an
unused ceiling costs nothing (limits are caps, not reservations). So **err generous**:
leave clear headroom above what a typical run should need, especially on
`max_tokens_total`.

Match the budget to the task's shape. Token burn is dominated by what flows through the
model — every turn resends the conversation, and every tool result lands in it:

- **Light tasks** (classify a record, draft a short reply, one saved-query lookup) fit the
  defaults.
- **Document editing and file-analysis tasks use far more tokens than intuition
  suggests**: loaded file content, sandbox command output, and repeated re-reads all
  count against `max_tokens_total`, and a long rewritten document pushes
  `max_tokens_turn`. Raise `max_tokens_total` into the millions when needed (the ceiling is
  6M) rather than leaving the 150k default, and raise `max_tokens_turn`
  when the agent must emit a long output. `max_steps`/`timeout_seconds` already default
  to their maxima — tokens are the knob that needs sizing.
- If a test run ends `limit_exceeded` (or stops at `max_steps`), raise the ceiling first —
  don't start by trimming the task.
