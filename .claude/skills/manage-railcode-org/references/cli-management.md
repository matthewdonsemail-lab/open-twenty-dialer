# Railcode Organization CLI Reference

## Contents

- Setup and scope
- Apps and access
- Members and roles/grants
- Saved queries
- Data and service connectors
- Analytics and observability logs

## Setup and Scope

```bash
npm install -g railcode@latest
railcode --version
npm view railcode version
railcode login [--api-url <url>]
```

The CLI stores its selected instance, organization, and personal token at
`${RAILCODE_HOME:-~/.railcode}/config.json`. API URL resolution is `--api-url`, then
`RAILCODE_API_URL`, then saved config. `RAILCODE_API_TOKEN` overrides the saved token for CI.
On a `401`, the saved token is cleared and login must be repeated.

Management commands are org-scoped, work from any directory after login, and do not need an
app or `railcode.json`. Most references accept a human-readable name/slug/email or UUID. Use
`--json` for raw output and `railcode <command> --help` for the full current flag set.

## Apps and Access

```bash
railcode apps list [--archived|--all]
railcode apps show <app>
railcode apps access <app>
railcode apps set-access <app> --mode organization
railcode apps set-access <app> --mode private
railcode apps set-access <app> --mode restricted --members alice@example.com,bob@example.com
railcode apps transfer <app> --to <email|uuid>
railcode apps archive <app>
railcode apps unarchive <app>
railcode apps delete <app> [--yes]
```

`<app>` is a slug or UUID. Access modes are `organization` (every org member), `private`
(owners), and `restricted` (owners plus explicit members). Org admins/owners bypass per-app
access. `set-access`, `transfer`, `archive`/`unarchive`, and `delete` need app manage rights.
Delete is irreversible, removes deploys and app data, prompts on a TTY, and requires `--yes`
non-interactively.

**Archiving is inert and reversible**, so it never prompts: an archived app keeps serving at
its host, keeps its slug, keeps its data, and keeps running its agents — it only drops out of
the launcher. Reach for it instead of `delete` whenever the goal is "get this out of people's
way". `list` hides archived apps by default; `--archived` shows only those, `--all` shows both,
and an `archived` column appears in the table only when the listing actually contains one.

`apps access` includes direct policy grants and access conferred through roles/grants.

### App generation (v1 vs apps v2)

Every app carries a platform-assigned **generation**: `1` = the legacy browser-SDK line, `2` =
apps v2 (a static frontend plus a backend worker). Every app created today is `2`; existing apps
were backfilled to `1`.

```bash
railcode apps show <app> --json | grep generation      # the text output does NOT print it
```

Generation is **sticky** — deploys and reverts never change it. The only transition is the
one-way migration gate, run by the app's owner from the app directory:

```bash
railcode migrate --app <slug> --yes
```

It is irreversible. It kills the v1 browser data plane for that app immediately and freezes its
user/role-scoped browser data (readable by the new worker, writable by nothing); unscoped data is
untouched. Do not run it on someone's behalf without their explicit go-ahead — the app is down
for its users until a worker deploy lands. Direct app authors to `$create-railcode-app`.

### Worker observability (generation 2 only)

```bash
railcode logs app --app <slug> [--follow]        # invocations: path, status, duration, caller
railcode logs app <invocation_id> --app <slug>   # one trace: console, errors, ops + verdicts
```

This is per-app and available to people with edit rights on the app — distinct from the
org-wide `railcode logs <connector|service-connector|llm|email|agent>` below, which is admin-only.
Retention is about 14 days.

### Per-app worker secrets (generation 2 only)

`railcode secrets <set|import|ls|rm>` manages an app's worker secrets. Values are **write-only**
— `ls` shows names, set-at, and a digest, never values. They are live app state, so every deploy
and revert re-applies the current set and a revert can never resurrect a rotated value. Caps: 64
per app, 5 KB per value.

### App storage (owner or `app:manage_any`)

```bash
railcode app kv <collections|list|get|set|delete|drop> ... [--app <slug|uuid>]
railcode app files <list|download|upload|delete> ... [--app <slug|uuid>]
```

Singular `app` (not `apps`) reads and writes a deployed app's KV records and files — useful
for auditing what an app or its agents stored, exporting a file, or clearing a collection.
Requires an owner grant on the app or an org admin holding `app:manage_any`; a member with
mere app *access* is rejected. Without `--app` it resolves the app from `./railcode.json`,
like `deploy`.

Scope with `--scope shared|user|role` (default `shared`; `user`/`role` need `--user <uuid>` /
`--role <uuid>`). `--scope all` enumerates every scope with owner attribution, but only for
the listings — a record or file mutation must name one scope. `kv list` takes
`--query '[[field,op,value]]'`, `--limit`/`--offset` (offset a whole multiple of limit), and
`--count`; `kv set` takes inline JSON or `--file`; `kv drop` prompts on a TTY unless `--yes`.

These are writes against live tenant data, including data owned by individual members. Read
before you write, and don't mutate a store the user didn't ask you to touch. The full
command-by-command surface is in `$create-railcode-app`'s CLI workflow reference.

## Members and System Roles

```bash
railcode members list
railcode members set-role <email|uuid> --role admin|member
railcode members remove <email|uuid>
```

Any member may list members. Mutations require admin authority. The owner tier is not
assignable through `set-role`. **There is no CLI command that creates a member** — a new
person joins through the invite flow in the web app, then `set-role` adjusts their tier.

## Custom Roles and Grants

```bash
railcode roles list
railcode roles create --name <name> [--description <text>]
railcode roles update <role> [--name <name>] [--description <text>]
railcode roles delete <role>
railcode roles add-member <role> <email|uuid>
railcode roles remove-member <role> <email|uuid>

railcode roles grants
railcode roles grant --subject <org|role:X|user:X> --resource <type> --ids <a,b>
railcode roles revoke <grant_id>
railcode roles materialize --subject <org|role:X|user:X> --resource <type>
railcode roles effective <email|uuid>
railcode roles catalog
```

`<role>` is a role name or UUID. Grant resource types are `app`, `llm`, `email`,
`sc_endpoint`, `connector`, `saved_query`, and `agent`. Grants are additive. `--ids` is a
comma-separated list and may use `*`; prefer explicit IDs. `materialize` expands wildcard
access into the resources that currently exist so future resources are not automatically
included.

Use `catalog` to discover grantable names and `effective` to verify a member's computed
access. App authority declared in `manifest.yaml` is ratified against this same grant model.

## Saved Queries

```bash
railcode query list
railcode query run my_orders --params '{"region":"emea","limit":5}'
railcode query create --name my_orders --connection analytics \
  --sql "select * from orders where region = :region limit :limit" \
  --params '[{"name":"region","type":"string"},{"name":"limit","type":"int","default":20}]'
railcode query update my_orders --sql-file my_orders.sql
railcode query delete my_orders
```

Create/update/delete are admin-only. Templates use `:name` placeholders with declared types
`string`, `int`, `float`, or `bool`. `run --params` is a JSON object; create/update `--params`
is an array of parameter declarations. SQL comes from `--sql` or `--sql-file`, never both.

`update` uses PATCH semantics: omitted fields stay unchanged; `--clear-params` declares no
params. SQL/param edits bump the version while preserving grants. Delete removes the saved
query and grants naming it.

The server injects `:_ctx_user_id`, `:_ctx_user_email`, and `:_ctx_org`; callers cannot
override `_ctx*` values. Use these binds for unforgeable caller row-scoping. `list` exposes
signatures, never SQL text.

## Data Connections

```bash
railcode connections list
railcode connections create --name <n> --kind postgres \
  --config-file connection.json --credentials-file credentials.json
railcode connections delete <name|uuid>
```

Create replaces a same-name connection and dials it before saving. Supported shapes:

- `postgres`: config `{host,database,username,port?,sslmode?}`, credentials `{password}`
- `bigquery`: config `{project_id,dataset}`, credentials `{service_account_json}`
- `turso`: config `{url}`, credentials `{auth_token}`

Inline `--config <json>` and `--credentials <json>` are supported, but file options reduce
shell-history exposure. Deleting a connection can break saved queries and apps; inspect
dependents first.

## Service Connectors

```bash
railcode connector list --admin
railcode connector native
railcode connector enable <key> --credentials-file credentials.json
railcode connector create --name <n> --base-url <url> --auth-type bearer \
  --auth-config-file auth.json --methods GET,POST --description <text>
railcode connector delete <name|uuid>
```

`list --admin` shows management fields such as base URL, credential state, enabled state, and
native key. `native` lists presets and their credential fields. `enable` creates or rotates a
native connector credential. Custom connector auth types and exact flags are shown by
`railcode connector --help`; use `--disabled` to create one disabled and restrict `--methods`
to the required HTTP verbs.

Member-facing `connector list`, `docs`, and `fetch` are invocation tools. Use them only as a
deliberate verification call because `fetch` can cause downstream side effects.

## Analytics

```bash
railcode analytics <app> [--range 7d|30d|90d]
```

The default range is `30d`. Output includes totals, uniques, daily values, top paths, and top
users. `<app>` is a slug or UUID; `--json` prints the raw object.

## Observability Logs

```bash
railcode logs <stream> [filters]
railcode logs <stream> <request_id>
```

Streams and required capabilities:

- `connector` — data-connection SQL (`connection:manage`)
- `service-connector` — proxied HTTP calls (`service-connector:manage`)
- `llm` — LLM gateway calls (`llm:manage`)
- `email` — email gateway sends (`email:manage`)
- `agent` — managed-agent runs (`agent:manage`)

Optional filters are validated per stream: `--app <slug|uuid>`, `--user <email|uuid>`,
`--connector <name>`, `--agent <uuid>`, `--source app|agent` (LLM only), `--status <value>`,
and `--limit <1..500>` (default 100). Use the request ID form for full JSON detail. Avoid
copying sensitive request/response bodies into handoffs.
