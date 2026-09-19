# CLI Workflow

## Contents

- Install and login
- Create and develop an app (apps v2)
- Per-app secrets, worker logs, and the migration gate
- Use org-facing data, saved-query, connector, and LLM commands
- Deploy and set app access
- Deploy from CI with an app-scoped deploy token
- Validate the app authority manifest

Use this reference for exact Railcode CLI behavior relevant to building, testing, and
deploying an app on the **multi-tenant** Railcode platform. Written against **CLI 0.3.0**. For managed agents use
`$create-railcode-agent`; for organization administration use `$manage-railcode-org`.

The CLI ships as the npm package **`railcode`**. The app-building subset is:

```
railcode login [--api-url <url>] [--paste|--no-browser]   Sign in and mint a personal API token
railcode login --setup-token <token>          Non-interactive onboarding login (one-time setup token)
railcode init <app> [dir] [--template hono+vite|hono+static|tanstack|static]   Scaffold an app
railcode dev [--port <n>] [--reset]           Run the frontend AND the worker locally
railcode deploy [--private] [--no-source] [--force]   Build + deploy the static tree and worker
railcode pull [<deploy>] [--app <slug>] [--dir <path>] [--force]   Download a deploy's stored source
railcode secrets <set|import|ls|rm> ...       Per-app worker secrets — write-only (apps v2)
railcode logs app [<invocation_id>] [--app <slug>] [--follow]   Worker invocations + traces (apps v2)
railcode migrate [--app <slug>] [--yes]       Move a v1 app to apps v2 (ONE-WAY)
railcode manifest <validate|show> ...         Validate manifest.yaml / show the ratified authority
railcode design-system [get|set] ...          Print the org's design-system guidance
railcode db <list|query> ...                  List data connectors / run read-only SQL
railcode query <list|run|create|update|delete> ...  Invoke saved queries by name / author (admin)
railcode connector <list|catalog|link|add-mcp|tools|call|docs|fetch|access|share|...> ...
                                              Link your own accounts or custom APIs/MCP servers,
                                              call them, share them; admins manage every row
railcode llm <providers|models|default>       List models, or set the org default
railcode app kv <collections|list|get|set|delete|drop> ...   Read/write the deployed app's KV (owner)
railcode app files <list|download|upload|delete> ...   Read/write the deployed app's files (owner)
railcode apps show <app> [--json]             App details, incl. your rights and its generation
railcode apps access <app>                    Inspect the access policy
railcode apps set-access <app> ...            Set mode/members/editors (manage rights)
railcode apps add-editor|remove-editor <app> <email|uuid>   Grant/revoke co-deploy rights
railcode apps add-viewer|remove-viewer <app> <email|uuid>   Grant/revoke view rights (restricted only)
railcode ci github [--repo <owner/name>] [--branch <name>]   Deploy from GitHub Actions
railcode token <create|list|revoke> ...       App-scoped deploy tokens for CI (edit tier)
railcode --version
railcode --help
```

Organization-level commands are intentionally excluded. Load `$manage-railcode-org` when the
task is to administer apps, members, roles/grants, connections, service connectors, saved
queries, analytics, or logs.

The CLI keeps itself current. On an **interactive terminal** it checks npm at most once every
6 hours, and installs any newer release **within the current major** with whatever global
package manager it detects (npm/pnpm/yarn/bun), announcing it on stderr so `--json` output
stays clean. It never crosses a major version, never blocks a command on a registry hiccup,
and is **skipped in non-interactive/CI runs** — which is every agent-driven session, so keep
upgrading explicitly with `npm install -g railcode@latest`. Overrides: `RAILCODE_NO_UPDATE=1`
(off), `RAILCODE_UPDATE_DRY_RUN=1` (print the install command, forces the check off-TTY),
`RAILCODE_REGISTRY_URL` (alternate registry). The throttle timestamp lives in
`~/.railcode/update-check.json`.

## Install The CLI

Install the CLI globally:

```bash
npm install -g railcode@latest        # or: pnpm add -g railcode@latest
```

API-URL resolution for every command: `--api-url` flag > `RAILCODE_API_URL` env > saved
config > `https://api.railcode.app`. Set
`RAILCODE_API_TOKEN` to override the saved token in CI. On a `401`, the saved token is
cleared and you're told to `railcode login` again.

A CI runner has **no `~/.railcode/config.json` at all**, so the token alone is not
enough there — the org uuid has nowhere to come from either. Set all three:
`RAILCODE_API_TOKEN`, `RAILCODE_API_URL` and `RAILCODE_ORG_UUID`. Without the last
one the command stops at *"No organization on file"* despite a perfectly valid
token. Only the token is a secret; the other two are identifiers. **`RAILCODE_ORG_UUID`
needs CLI 0.1.36+** — an older binary ignores it and fails in exactly that way. See
[Deploy From CI](#deploy-from-ci-github-actions).

## Log In

```bash
railcode login [--api-url <url>] [--paste|--no-browser]
```

Login is **browser-based** (not an email/password prompt). The API URL resolves
non-interactively —
`--api-url` > `RAILCODE_API_URL` > saved config > the default
`https://api.railcode.app`. The CLI:

1. Starts a localhost HTTP callback, prints the authorization link, and **auto-opens your
   default browser** to it; paste the printed URL if it doesn't open.
2. The browser does normal dashboard auth and approves the CLI.
3. The CLI exchanges the one-time code for a long-lived, revocable **personal API token**,
   resolves your organization, and saves everything to `~/.railcode/config.json`.

There is also a **paste-the-code fallback**: the authorize page can
display a one-time code with a copy button, and the CLI accepts either the localhost
callback or a pasted code — whichever happens first. `--paste` (or `--no-browser`) skips
the localhost server entirely, for SSH/headless machines.

Browser login needs a TTY. In non-interactive environments set `RAILCODE_API_TOKEN`
instead — plus `RAILCODE_ORG_UUID` when there is no saved config to read the org from,
as on a CI runner. If you have no organization yet, finish onboarding in the dashboard,
then run `railcode login` again so the org is saved (deploy needs it).

`railcode login --setup-token <rc_setup_...>` is the no-TTY, no-browser onboarding path: a
**one-time, ~10-minute** setup token (minted by the dashboard's copied CLI prompt) is
exchanged once for a personal API token and writes the same `config.json`. If it's expired
or already used, generate a fresh prompt from the dashboard.

## Create An App

```bash
railcode init <app> [dir] [--template hono+vite|hono+static|tanstack|static]
```

- Validates the app slug against `^[a-z0-9][a-z0-9-]{0,62}$` (a DNS label).
- Scaffolds a **single self-contained directory** — `./<app>/` by default, or the optional
  `[dir]` (`railcode init foo .` scaffolds into the current directory). A non-empty target is
  fine, but an existing `railcode.json` is refused unless `--force`.
- **Every app created is generation 2 (apps v2).** There is no v1 template and no downgrade.

The four stacks — and **the CLI owns the build for all of them**, so the app declares no
bundler, no `wrangler`, no Cloudflare package, and no worker build script:

| Template | Frontend | Worker | Layout |
|---|---|---|---|
| **`hono+vite`** (default) | Vite + React | Hono | `frontend/` + `server/index.ts` |
| `hono+static` | one `index.html`, no build | Hono | `frontend/index.html` + `server/index.ts` |
| `tanstack` | TanStack Start (SPA mode) | server fns + `/api/*` | file routes; data routes need `ssr: false` |
| `static` | static tree | **none** | pure hosting; no server code |

Each worker template scaffolds a small **platform tour** — identity (`ctx.user` + `appUsers`), a
todo list on `db`, files, and the read-only org surfaces — over a frontend that only fetches the
worker's `/api` routes. Read it, then delete it. Treat it as functional scaffolding, not a style
guide.

`railcode.json` keys:

```json
{
  "app": "my-app",
  "type": "hono+vite",
  "dist": "dist/client",
  "server": "dist/server/index.js"
}
```

`type` drives build, dev, and deploy. `server` names the built worker module; `dist` the static
output. **Never add `"server"` to a generation-1 app** — the deploy is refused with `422`.

### A minimum-CLI floor gates NEW apps

Creating an app requires a current CLI (default floor **0.2.0**); a stale CLI would scaffold
v1-shaped bundles and is refused. **Deploys to existing apps are never gated** — a v1 app keeps
deploying from any CLI.

### `secrets` and `migrate` need CLI 0.2.3

Both commands ship in 0.2.2 but are never routed to, so any `railcode secrets ...` or
`railcode migrate ...` invocation fails as an unknown command. Fixed in 0.2.3. An unknown-command
error on either one means the CLI is stale, not that the syntax below is wrong.

## Local Dev

```bash
railcode dev [--port <n>] [--reset]
```

Run it from the directory containing `railcode.json`. It serves the frontend **and the worker**,
carving exactly the paths production carves (`/api/*`, `/_serverFn/*`).

- **`tanstack`** — the Vite preset runs the worker in embedded workerd; the CLI proxies `/api`
  and `/_serverFn` to Vite.
- **`hono+vite` / `hono+static` / bring-your-own** — the CLI bundles the worker with esbuild
  (watched), runs it **in-process**, and serves the same paths. A rebuild re-imports the worker
  on the next request.

Either way the worker calls the CLI's local data plane over HTTP with the **same wire shape as
production**, so "works in `railcode dev`" means "works deployed."

What is local vs forwarded:

| Surface | Under `railcode dev` |
|---|---|
| `db`, `files` | **Local scratch store** on disk. Flat scope. `--reset` seeds fresh. Never touches live data |
| SQL, saved queries, LLM, email, connectors, **agents** | **Forwarded to the real instance** under a CLI-minted dev token carrying your identity |
| `secrets` | Read from your local environment |
| Cron | Not scheduled — trigger the route by hand (remember: **POST**) |

Forwarded calls hit real providers, real data, and real spend — including sending email and
starting real agent runs. Authority for them is manifest-bounded exactly as in production, so
authority failures reproduce locally.

Local dev storage is separate from the deployed app's: `railcode app kv` / `railcode app files`
read and write the **live** app, never the local emulation.

## Per-App Secrets (apps v2)

```bash
railcode secrets set NAME          # hidden prompt, or piped on stdin — never inline
railcode secrets import [.env]     # every NAME=value line of an env file
railcode secrets ls                # names + set-at + value digest, never values
railcode secrets rm NAME
```

Values are **write-only**: they can be replaced or removed, never read back. The worker reads
them ambiently as `secrets.NAME`.

Secrets are **live app state, not part of a deploy**. Every activation — deploy, revert, cold
revert — re-applies the **current** set before the flip is observable, so a revert can never
resurrect a rotated value. Writes serialize with deploys.

Caps: 64 per app, 5 KB per value.

## Worker Logs (apps v2)

The v2 debugging surface. There is no generation-1 equivalent.

```bash
railcode logs app --app <slug>              # invocations: time, outcome, status, method, path, who
railcode logs app --app <slug> --follow     # tail
railcode logs app <invocation_id> --app <slug>   # ONE full trace, as JSON
```

Every invocation — http or cron — produces a record: who called, which path, which deploy,
outcome, duration. A single trace additionally carries the worker's `console` lines, any uncaught
error, and **every governed operation with its verdict**, so a refusal appears as `denied` with
the resource name instead of a silent failure.

`invocation_id` joins the gate record, the logs, and every data-plane audit row — one request
reads as one trace. Retention is short (about 14 days).

## The Migration Gate (v1 → v2)

```bash
railcode migrate [--app <slug>] [--yes]
```

**One-way and irreversible.** It flips the app's `generation` from 1 to 2. Immediately:

- the browser SDK stops working for that app — `/_api` data calls refuse;
- the app's user/role-scoped browser data **freezes** (readable by the new worker through
  `db.scoped()` / `db.scopedRole()`, writable by nothing);
- unscoped data is untouched — the v2 flat store **is** that same app scope.

Reverting a deploy never un-migrates. It prompts on a TTY; `--yes` is required
non-interactively.

**Do not run this until the v2 build is finished and validated.** Between `migrate` and the next
`deploy` the app is down for its users, and that window cannot be rehearsed — a worker deploy is
refused (`422`) while the app is still generation 1. See
[migration.md](migration.md) for the full procedure and the new-slug alternative.

## Check An App's Generation

```bash
railcode apps show <app> --json | grep generation      # 1 = legacy, 2 = apps v2
```

The plain-text output does not print it; use `--json`.

## Read The Design System

```bash
railcode design-system
```

Prints your org's configured design-system markdown straight to stdout (so it pipes/feeds
cleanly into an agent). Needs a logged-in CLI; resolves the server like every other command.
Returns empty when no admin has configured a design system for the org. `railcode
design-system get` is the explicit spelling of the same read.

An admin with **design-system manage** can also replace the guidance (new in CLI 0.1.31):

```bash
railcode design-system set --file brand.md          # from a file
cat brand.md | railcode design-system set           # from stdin
railcode design-system set --markdown "# Brand ..."  # inline
```

`set` reads the markdown from exactly one source, preferred in that order: `--file`, then
`--markdown`, then piped stdin. An empty file or empty pipe is **refused** rather than
silently wiping the guidance; clear it deliberately with `--markdown=""`.

Optionally record which dashboard template and brand pair produced the markdown, so the
picker can restore itself — `--template <slug> --primary <hex> --accent <hex>`. Pass all
three or none; provenance is replaced wholesale on every `set`, never merged. Omitting the
trio marks the guidance hand-written ("custom").

## Query Data Connectors

```bash
railcode db list                                   # list the org's data connectors
railcode db query "select 1"                       # read-only SQL against connection `default`
railcode db query "select * from orders where total > $1" --params '[100]'
railcode db query --file report.sql --connection analytics
```

`railcode db` inspects the org's **data connectors** (admin-configured Postgres, BigQuery, or
Turso) and runs ad-hoc read-only SQL from the terminal — the same connectors and SQL the
in-app `dataConnectors()` / `data().runSQL()` use. Data connectors are **org-scoped**, so these
one-shot commands **work straight after `railcode login`** — **no app and no `railcode.json`
required**. They use your login token and run from any directory.

- `railcode db list` (aliases `ls`, `connections`) — prints each connector's `name` +
  `engine`; `--json` prints the raw array.
- `railcode db query "<sql>"` (alias `sql`) — runs the SQL and prints a table + row count.
  `--connection <name>` (default `default`), `--engine <postgres|bigquery|turso>` (inferred
  from the connector list when omitted), `--params '<json-array>'` binds positional
  placeholders (`$1, $2, …` on Postgres; `?` on BigQuery/Turso), `--file <path>` reads SQL
  from a file (mutually exclusive with the positional arg), `--json` prints the raw
  `{ columns, rows, rowcount, truncated }` envelope.

Treat SQL as read-only — always use placeholders + `--params`, never string interpolation.
(On Postgres and Turso the platform enforces this with read-only sessions. BigQuery has no
session-level read-only mode, so its connection credential's privileges are the boundary.)

Note the two different `--params` shapes: `railcode db query` takes a positional **array**
(`'[100]'` binds `$1`); `railcode query run` takes a named **object** (see below).

## Saved Queries

A **saved query** is a named, versioned SQL template an org admin
publishes against one data connection. Members and apps invoke it **by name** with typed,
named params — the grant-gated alternative to ad-hoc SQL, and the same queries the in-app
`query('name', params)` / `savedQueries()` SDK globals use. Like `railcode db`, these are
org-scoped: they work straight after `railcode login`, no app required.

```bash
railcode query list                                # signatures: name, params, version, description
railcode query run my_orders --params '{"region":"emea","limit":5}'
```

- **Templates use `:name` placeholders** (not `$1`) matched to declared params, each typed
  `string | int | float | bool`. A param declared with a `"default"` is optional at invoke
  time — the server binds the default when the caller omits it.
- **`--params` for `run` is one JSON object**, exactly matching the SDK/API call.
- **Context binds**: templates may reference `:_ctx_user_id`, `:_ctx_user_email` and
  `:_ctx_org` — the server injects those from whoever invokes, and a caller-supplied
  `_ctx*` param is rejected with a 400. `where rep_email = :_ctx_user_email` is per-caller
  row scoping the caller cannot forge.
- `list`/`run` are member operations (invocation can be grant-gated per query by admins).
  `list` returns signatures only, never SQL text. Aliases: `query` = `queries`, `list` =
  `ls`, `run` = `invoke`; `--json` on `run` prints the raw
  `{ columns, rows, rowcount, truncated }` envelope.

Publishing or changing a saved query is organization administration. Use
`$manage-railcode-org` for `query create`/`update`/`delete` rather than expanding the app
builder's scope.

## Call Service Connectors

```bash
railcode connector list                                          # list service connectors
railcode connector docs stripe                                   # how to call one connector's API
railcode connector docs stripe --openapi                         # just its OpenAPI spec (inline text, else URL)
railcode connector fetch "/v1/charges?limit=3" --connector stripe
railcode connector fetch "/v1/charges" --connector stripe --method POST --body "amount=500&currency=usd"
```

`railcode connector` lists, documents, and calls the org's **service connectors**
(admin-configured HTTP proxies to SaaS APIs) — the same surface the in-app
`serviceConnectors()` / `connector().fetch()` use. The connector holds the credential; you
control only method/path/body. Service connectors are **org-scoped**, so — like `railcode db` —
these commands **work straight after `railcode login`** with **no app or `railcode.json`
required**.

- `railcode connector list` (aliases `ls`, `connectors`) — prints `name`, `auth_type`, and
  `allowed_methods` (plus a `description` column, and a `docs` column reading `api` /
  `openapi` for the connectors that expose documentation); `--json` for the raw array.
- `railcode connector docs <name>` (alias `doc`) — prints one connector's documentation
  bundle so you know how to call it: usage instructions, the API-docs link (or inline text),
  and the OpenAPI spec (link or inline) when the admin configured them. `--openapi` prints
  only the spec (inline text if present, else its URL; exits non-zero when there is none);
  `--json` for the raw docs object. Use the `docs` column from `connector list` to see which
  connectors have anything to show.
- `railcode connector fetch <path>` (alias `request`) — proxies one HTTP call.
  `--connector <name>` (required), `--method <verb>` (default `GET`; must be allowed by the
  connector or the server returns 405), `--body <string>` / `--file <path>` (mutually
  exclusive), `--json` prints the raw `{ status, ok, headers, body, truncated }` envelope. A
  non-2xx upstream status is still printed, but the command exits non-zero.

## Link A Connector You Own

**`railcode personal-connectors` (and its `pc` alias) was removed in CLI 0.3.0** — it exits
"Unknown command". Personal connectors were folded into `railcode connector`: one command for a
shared team credential and for an account you link yourself.

```bash
railcode connector catalog                     # providers you can link + their connect methods
railcode connector link gmail                  # link your own account; you own the row
railcode connector add-mcp notion https://mcp.notion.com/mcp   # any remote MCP server
railcode connector list                        # what you can see: owned, shared, org-mode
railcode connector tools gmail-jp              # callable tools + input schemas
railcode connector call gmail-jp send_email --args '{"to":"a@b.com","subject":"hi"}'
```

- **You own what you link, and it starts `restricted`** — visible to you, admins, and anyone you
  `share` it with. `railcode connector access <name> organization` opens it to the org;
  `railcode connector share <name> --user <email>` or `--role <name>` grants it narrowly.
- **The name is not the provider id.** Two people linking the same provider, or a name already
  taken, produces a suffix (`gmail-jp`, `slack-harshsharma`). Always read the name from
  `connector list` before writing it into a manifest.
- `link` waits for the OAuth round trip by default; `--no-wait` prints the URL and returns.
  `relink <name>` re-authorizes an expired row without disturbing what names it.
- `call` runs a tool **as you, under your grants** — an identity op with no app manifest bound,
  the same thing you could do by hand. The app-plane equivalent, `connector(name).call()` in the
  SDK, **is** bound by the calling app's ratified manifest — see
  [App Manifest](#app-manifest-authority) below.
- Two kinds behave differently: **http** rows are a method/path proxy (`connector fetch`), **mcp**
  rows are tools called by name (`connector tools` / `call`). Linked providers such as Gmail
  expose tools as well.

## LLM Gateway

```bash
railcode llm providers            # configured providers, each with its models
railcode llm models               # flat list of every callable model
railcode llm providers --json     # raw provider array
```

`railcode llm` shows the org's LLM gateway exactly as apps see it — the same catalog the
in-app `llmProviders()` SDK global returns. Like `railcode db`/`connector`, it works after
`railcode login`, with no app or `railcode.json` required.

- `railcode llm providers` (alias `provider`) — one row per provider (`provider`, whether it's
  the org default, and its models joined in a cell with the default model marked).
- `railcode llm models` (alias `model`) — one row per `(model, provider)` with the org default
  marked.
- Keys, LiteLLM strings, and cost rates are never shown.

An org can configure **many models across many providers**. In app code, calls route by
`(provider, model)`: pass `opts.model` (a catalog model name — its provider is implied) and/or
`opts.provider` (a provider name alone → that provider's default model) to `llm.generate()` /
`llm.stream()`, or pass neither to use the org default marked in the listing.

LLM **tool calling** (`opts.tools`) rides this same plane: the wire
carries only each tool's `{ name, description, schema }` — `run`/`summarize` execute in the
page — and under `railcode dev` the calls forward to the real instance like every other LLM
call.

## Deploy An App With The CLI

```bash
railcode deploy [--private] [--no-source] [--force]
```

Deploy behavior:

- Requires a `railcode.json` with an `"app"` slug in the current directory.
- Resolves the output directory, then runs a build command when needed (see resolution
  below), and uploads every file in the output dir (which must contain a root `index.html`)
  to the selected organization.
- Skips `.git`, `node_modules`, `.DS_Store`, and (at the app root) `railcode.json`,
  `package.json`, lockfiles (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` /
  `bun.lockb`), `manifest.yaml`.
- The app is **created-or-resolved by slug in your saved org**. On the **first successful**
  deploy for a slug the server creates the app (default **`organization`** access); a failed
  first deploy leaves no phantom not-deployed app behind.
- `--private` is a **one-shot** flag that sets this app's access to `private` as part of this
  deploy only — it is never persisted (see [App Access](#app-access)). `railcode init` no
  longer accepts `--private`.
- The app directory should have a `manifest.yaml`; deploy sends it and prints the
  ratification outcome (see [App Manifest](#app-manifest-authority)).
- Uses the saved API token (or `RAILCODE_API_TOKEN`); clears the token and asks you to log in
  again on `401`.
- Also uploads the **project source** alongside the built files, so a later `railcode pull`
  can bring it back (new in CLI 0.1.32). The source respects the project's `.gitignore`, plus
  a built-in exclude list (broadened in **CLI 0.1.34**, matched by exact name at any depth)
  and the resolved build-output dir. `--no-source` skips it. The CLI
  mirrors the server's default caps — 20 MB of source in total, 25 MB per file, 1000 files —
  so an oversized tree fails **before** the upload starts. An instance may configure lower
  values, in which case the server rejects what the CLI allowed.
  - The exclude list covers vendored deps and build output (`node_modules`, `.venv`, `venv`,
    `dist`, `build`), VCS internals (`.git`, `.hg`, `.svn`), framework/tool caches (`.vite`,
    `.next`, `.nuxt`, `.svelte-kit`, `.astro`, `.turbo`, `.parcel-cache`, `.cache`, `.output`,
    `.wrangler`, `.vercel`, `.netlify`, `__pycache__`, `.pytest_cache`, `.mypy_cache`,
    `.ruff_cache`, `.tox`, `.eggs`, `.ipynb_checkpoints`, `coverage`, `.nyc_output`),
    agent/local tool state (`.gstack`, `.playwright-mcp`), editor and OS debris (`.vscode`,
    `.idea`, `.DS_Store`, `Thumbs.db`, `desktop.ini`), package-manager debug logs, and the
    `.railcode` marker.
  - **Env files never ship** — `.env`, `.env.local`, `.env.development.local`,
    `.env.production.local` are excluded even when `.gitignore` misses them. Exact names only,
    so `.env.example` still ships.
  - **`.claude/` ships on purpose**: its skills and instructions are useful to whoever pulls
    the source and continues the work.
- Sends the folder's recorded base version so the deploy is **conditional** — see
  [The Version Marker](#the-version-marker-railcode). `--force` deploys over a version
  someone else has moved past.
- Prints the live URL after upload. From CLI 0.1.36 this comes from the deploy
  **response** rather than being assembled locally, so it is right even on a CI runner
  that has no saved config to derive an org slug from. The shape is
  `<app>.<org>.<serving-domain>`. Against a server too old to return it the CLI falls
  back to deriving it, and prints no URL at all rather than a wrong one.

Deploy output resolution order:

1. `railcode.json` `"dist"` wins (use `"."` for a no-build static app). `"build"` still runs
   first if also set.
2. Otherwise `railcode.json` `"build"` runs and `dist/` is uploaded.
3. Otherwise a `package.json` with a `build` script runs `<pm> run build` — where `<pm>` is
   your app's package manager (pnpm/yarn/bun by lockfile, else `npm`) — and uploads `dist/`.
4. Otherwise a root `index.html` can be deployed interactively (a `y/N` prompt); for CI set
   `"dist": "."`.

The `railcode.json` schema is `{ app, build?, dist?, dev?: { root?, command?, port? } }`.

## Deploy From CI (GitHub Actions)

New in CLI **0.1.36**. Don't hand a pipeline your personal token — it carries every
power you hold, on every route, and never expires. Use a **deploy token**: an
app-scoped credential that can `POST` that one app's deploy route and nothing else on
the API. It cannot read data, list apps, revert a deploy, or mint another token. It is
a capability, not a login.

```bash
railcode ci github [--app <slug>] [--repo <owner/name>] [--branch <name>]
                   [--no-secret] [--force]
```

Run it inside the project. It resolves the app from `railcode.json` (or `--app`) and
the repository from the `origin` remote, mints a deploy token, hands the plaintext to
GitHub as the repository secret `RAILCODE_API_TOKEN` **via the `gh` CLI over stdin** —
so it never reaches your screen, your shell history, or an argv another process can
read — and writes `.github/workflows/railcode-deploy.yml`. With `--no-secret`, without
`gh`, or when it can't tell which repo this is, it prints the token once plus the exact
`gh secret set` command instead. `--force` overwrites an existing workflow file.
**Nothing is added to `railcode.json`** — a file inside the repo can't prove where it
runs, so trust stays server-side.

Manage the tokens directly with:

```bash
railcode token create [--app <slug>] [--name <label>] [--expires-in-days <n>] [--json]
railcode token list   [--app <slug>] [--json]
railcode token revoke [--app <slug>] <token-prefix>
```

The plaintext is shown **once**, at mint time. Creating one is **EDIT**-tier — it hands
out exactly the power the minter already has — and every owner/editor/admin of the app
can see and revoke every token on it, whoever minted it. A deploy token dies with its
creator's edit rights on the app, and deleting the app revokes its tokens. Long-lived by
default: an expiring CI credential breaks a pipeline with no warning, so `--expires-in-days`
is opt-in. Deploy tokens never appear in the personal-token list — they belong to the
app, and the dashboard manages them on the app's **CI** tab.

The generated workflow carries all three values the runner needs, because a runner has
no `~/.railcode/config.json`:

```yaml
      - run: npx --yes railcode@latest deploy
        env:
          RAILCODE_API_URL: https://api.railcode.app
          RAILCODE_ORG_UUID: <org uuid>          # an identifier, not a secret
          RAILCODE_API_TOKEN: ${{ secrets.RAILCODE_API_TOKEN }}
```

**The runner must resolve a CLI new enough to read `RAILCODE_ORG_UUID` (0.1.36+).**
`npx railcode@latest` does that once 0.1.36 is on npm; a pinned older version fails with
*"No organization on file. Finish onboarding, then run `railcode login` again."* even
though the token is valid — the binary simply doesn't know the variable exists.

What a stolen deploy token can do: replace the served code of that one app — complete
control of what its visitors see, and full use of the authority the app already holds.
It **cannot raise** that authority: a deployed `manifest.yaml` lands as `pending` and a
person still has to ratify it.

`railcode deploy --private` does not work from CI: setting access is a separate call the
deploy token is refused on (`403`), so the deploy lands and the command then exits `1`.
Set access from the dashboard or an authenticated session instead.

## The Version Marker (`.railcode`)

Every successful deploy and every `railcode pull` writes a small JSON file, `.railcode`, into
the project folder (new in CLI 0.1.32). It records which deploy the folder currently matches:

```json
{ "api_url": "…", "org_uuid": "…", "app": "demo", "app_uuid": "…", "deploy": 3 }
```

The next deploy sends that number back, and the server refuses to publish over work the
caller has not seen — an `If-Match` for deploys. Without it, two people who both pull the
same tree and both deploy would have the second silently erase the first.

- **Deploy numbers count from 1 per app** (new in CLI 0.1.33 + the matching server). An app's
  history starts at `#1` no matter what else the instance has deployed, and `#3` in one app
  says nothing about any other app.
- The marker is **scoped**. The CLI sends the base version only when the instance, org and
  app slug all match the deploy target, so a copied or re-pointed folder deploys
  unconditionally instead of claiming a base in another app's history. It also sends the
  recorded app uuid, and the server refuses a mismatch.
- A stale base gives a **409** that names the live version, who moved it, and when. Run
  `railcode pull`, then deploy again — or `railcode deploy --force` to publish over it. See
  [Working In A Shared App](#working-in-a-shared-app) before forcing: that 409 is a colleague.
- A base the app does not have gives a **422** naming the app's real range.
- `railcode init` adds `.railcode` to `.gitignore`. It is local state about one folder, so a
  colleague's `git clone` must not receive a stale one. Deleting it is always safe: the next
  deploy is simply unconditional.
- It is never uploaded as a servable file and never packed into the source bundle it helps
  build.

## Pull A Deploy's Source

```bash
railcode pull [<deploy>] [--app <slug>] [--dir <path>] [--force]
```

Downloads the source tree stored with a deploy — the live one by default, or the deploy
number you name. Behavior:

- `--app <slug>` picks the app (default: the `"app"` in `./railcode.json`); `--dir <path>`
  picks where to write (default: the current directory).
- Existing local files are **only** overwritten with `--force`, and the command lists which
  ones differ before it refuses. Files the deploy does not contain are left alone; nothing is
  ever deleted.
- Afterwards the folder records the deploy it now matches, so the next deploy is checked
  against it.
- A deploy made with `--no-source`, or one whose files have aged out of the retention window,
  answers that there is nothing to pull.
- Requires a server with deploy source-history endpoints. Older servers keep accepting
  deploys but cannot answer pull requests.

## App Access

A new app defaults to **`organization`** access — every member of your org may open it.
Access is otherwise managed in the **admin UI**, the `railcode apps` CLI commands, or the
access API. The owner or an org admin changes it; use `$manage-railcode-org` for broader app
ownership and organization administration:

```bash
railcode apps access <app>                          # show the current mode + per-user grants
railcode apps set-access <app> --mode private       # or: organization | restricted
railcode apps set-access <app> --mode restricted --members alice@x.io,bob@x.io
railcode apps set-access <app> --mode organization --editors dana@x.io   # editors: any mode
```
Modes: `organization` (every org member, the default), `private` (owners + editors),
`restricted` (owners + editors, plus explicitly-granted members). Org admins/owners bypass
per-app access entirely.
See [v1-legacy.md](v1-legacy.md) for the access model.

Grants come in **three tiers** — owner, **editor**, member (viewer):

| Tier | Can | Cannot |
| --- | --- | --- |
| owner | everything below, plus delete/archive/transfer/set-access, and `app kv`/`app files` | — |
| **editor** (new in CLI 0.1.35) | deploy, read/revert deploy history, `pull` source, read analytics, read the access policy, add/remove **viewers** | delete, archive, transfer, change the mode, change the editor list, `app kv`/`app files` |
| member (viewer) | open the app while it is `restricted` | anything else |

Editors are **working rights, not an audience share**: an editor can open the app in *every*
mode, and their grant survives mode changes. `railcode apps access` prints the grants grouped
by tier for exactly this reason — do not read the editor list as "who can view this".

```bash
railcode apps add-editor <app> dana@x.io       # atomic; never rewrites the rest of the policy
railcode apps remove-editor <app> dana@x.io
railcode apps add-viewer <app> sam@x.io        # restricted mode only — a 400 otherwise
railcode apps remove-viewer <app> sam@x.io
```

Prefer the atomic `add-editor`/`remove-editor` over `set-access --editors` when you are
granting one person: `set-access` rewrites the whole policy and can race a concurrent edit.

- **`--editors` absent vs empty is a real distinction.** Omitting `--editors` leaves the
  server's editor list **alone**; `--editors ""` **clears** it. Same for `--members`.
  (Empty-string flag values only parse correctly on **CLI 0.1.35+** — an earlier CLI rejects
  `--editors ""` with "requires a value".)
- **`add-viewer`/`remove-viewer` are edit-gated**, so an editor can choose who else may view
  the app they work on — but only while the app is `restricted`, since a viewer grant is inert
  in any other mode.
- Transferring ownership **demotes the previous owner to editor** rather than cutting them off.

The only deploy-time control is `railcode deploy --private`: a **one-shot** action that sets
`mode: private` on that deploy and nothing more (it doesn't persist a flag anywhere, so a
later plain `railcode deploy` won't re-assert it — flip access back in the dashboard and it
stays flipped). There is no persisted `private` key in `railcode.json`.

## Working In A Shared App

Since the editor tier (CLI 0.1.35) an app can have **several people deploying it**, so do not
assume the app you are working on is yours alone. When you did not create the app in this
session, establish your rights before you act:

```bash
railcode apps show <app>      # prints `your role`, `can manage`, `can edit`
```

`can edit` is what governs `deploy` / history / `revert` / `pull`; `can manage` governs
delete, archive, transfer, and the access mode. Treat a `403` on one of those as a **real
authority boundary** — report it and ask, rather than routing around it (there is no
route around it) or retrying with different flags.

Working rules in a shared app:

- **Pull before you deploy.** Your folder may be behind. A `409` on deploy is not a
  malfunction — it means a colleague published after your last sync, and the message names
  the live version, who moved it, and when. The correct response is `railcode pull` then
  `railcode deploy`.
- **`--force` overwrites a teammate's deploy.** It is the "I know, publish anyway" escape
  hatch, and it marks the history row as knowingly deploying over a conflict. Never reach for
  it to clear a 409 on your own initiative — pull, look at what changed, and ask the user
  before forcing. (A `422` is different: the folder's marker names a deploy the app does not
  have, e.g. a copied folder. `railcode pull` resyncs it; deleting `.railcode` makes the next
  deploy unconditional.)
- **Don't merge blind.** `railcode pull` will not overwrite differing local files without
  `--force`; it lists them instead. That list is a genuine divergence between your work and
  what is live — read it before deciding, and never blanket-`--force` a pull that reports
  conflicts in files you edited.
- **Editors cannot administer app storage.** `railcode app kv` / `railcode app files` stay
  **owner-or-admin**; an editor gets a `403`. To verify a write as an editor, use the app's
  own UI.
- **The manifest is ratified against *your* authority, on the diff.** Being an editor does not
  confer the app's declared authority. Deploying an **unchanged** manifest always works, no
  matter what you personally hold, and a diff that only *removes* operations auto-applies. But
  a deploy whose diff **adds** an operation you don't hold is rejected up front with a `403`:
  *"This deploy adds authority you don't hold: …"*. Nothing is published — get the grant, or
  drop the operation from `manifest.yaml`. Also note `railcode deploy` needs the org-level
  `app:deploy` capability in your role; an editor grant on its own is not enough.
- **Never deploy from a tree that is missing `manifest.yaml`.** A manifest absent from the
  uploaded tree reads as *removed*, and removal only sheds authority, so it **auto-applies** —
  no permission required, no block. The app silently drops to pass-through (`run_as: user`)
  and every declared grant is shed. The only signal is one deploy line: `Manifest removed —
  the app is back to pass-through`. This is the likeliest way to break a shared app, so
  confirm the manifest is present (and current) before you deploy someone else's app — another
  reason to `railcode pull` first.
- **Never commit `.railcode`.** It is per-folder sync state, and a stale one handed to a
  colleague makes their next deploy claim a base that isn't theirs. `railcode init` gitignores
  it; if you scaffolded some other way, add it yourself.
- **Source you push is read by whoever pulls next.** The deploy ships `.claude/` on purpose so
  the next person (or agent) inherits the app's skills and instructions — worth keeping
  accurate. It never ships `.env`, `.env.local`, `.env.development.local`, or
  `.env.production.local`, even when `.gitignore` misses them; `.env.example` does ship.

## Inspect And Seed App Storage

`railcode app kv` and `railcode app files` read and write **the deployed app's** KV and file
store from the terminal — the fastest way to confirm what an app (or an agent writing through
`app_data_write`) actually persisted, to seed demo records, or to clear a collection between
tests.

```bash
railcode app kv collections                      # every collection + record count
railcode app kv list <collection> [--query '[["stage","eq","won"]]'] [--limit 20] [--count]
railcode app kv get <collection> <key>
railcode app kv set <collection> <key> '{"n":1}'        # or --file value.json
railcode app kv delete <collection> <key>
railcode app kv drop <collection> [--yes]               # every record in the collection

railcode app files list
railcode app files download <name> [--out <path>]       # default: ./<name>
railcode app files upload <path> [--name <remote-name>]
railcode app files delete <name>
```

**These talk to the deployed instance, not `railcode dev`.** Local dev KV/files live on disk
under `~/.railcode/dev/<instance>/<app>/` and are only cleared with `railcode dev --reset`; a
`railcode app kv list` never shows them.

- **App resolution** — `--app <slug|uuid>`, else the `railcode.json` in the current directory,
  exactly like `deploy`.
- **Ownership required** — an app owner grant, or an org admin holding `app:manage_any`. A
  plain member with app *access* is rejected, and so is an **editor**: the editor tier confers
  deploy rights, not storage administration. That's an authority boundary, not a bug.
- **Scope** — `--scope shared|user|role` (default `shared`), with `--user <member-uuid>` or
  `--role <role-uuid>` required for those two. `--scope all` enumerates every scope with owner
  attribution but **only for the listings** (`kv collections`, `kv list`, `files list`); any
  record or file mutation must name a single scope.
- **`kv list` paging** — `--limit <n>` with `--offset <n>` as a whole multiple of `--limit`
  (the API pages rather than offsets). `--count` prints the match count instead of rows.
- **`kv set` values** — inline JSON or `--file <path>`, never both. Any JSON shape is valid:
  object, array, string, number, or bool.
- **`--query`** — the same `[[field, op, value], ...]` where-clause the data plane takes.
- `--json` prints raw JSON on the read commands; `drop` prompts on a TTY and needs `--yes`
  otherwise.

### Seeding

`kv set` is the practical way to fill a fresh app so its tables, filters, sorting, paging, and
charts can actually be reviewed:

```bash
railcode app kv set companies acme '{"name":"Acme","stage":"won","value":48000}'
railcode app kv set companies globex --file globex.json
railcode app files upload ./sample-proposal.docx --name proposal.docx
railcode app kv list companies                 # confirm the shape that landed
```

Match the shape the app itself writes — create one record through the UI and read it back with
`railcode app kv get <collection> <key>` rather than inventing fields. Seed into the scope the
app reads (`--scope user --user <uuid>` for a `db.user` collection; the default `shared` for
`db.shared`), or the UI will look empty despite the records existing. Clean up throwaway rows
with `kv delete`, or `kv drop <collection> --yes` when the whole collection was scratch.

Treat `set`, `delete`, `drop`, `upload`, and `files delete` as writes to real tenant data:
they hit the live app the same way a user's click does. Confirm before running one that the
user didn't ask for, and never seed on top of an app that already holds real records without
asking.

## App Manifest (Authority)

Always write a `manifest.yaml` beside
`railcode.json` for every app you build or materially change. It declares **which privileged
operations an app performs and whose authority they run under**. It's separate from
`railcode.json` (which stays `{ app, build?, dist?, dev? }`) and is uploaded on deploy.

**On apps v2, `run_as: app` is mandatory.** The worker *is* the app principal — there is no
browser caller whose personal grants could stand in — so a v2 deploy declaring `run_as: user`
is refused. (`run_as: user` remains the pass-through mode for generation-1 apps.)

`run_as: app` makes the app run privileged operations under its own **ratified** authority, so
callers who lack those grants can still use the feature through the app. Shape:

```yaml
run_as: app                 # or: user for pass-through apps
saved_queries: [my_orders]  # saved queries the app may invoke
connectors:                 # service-connector endpoints, per connector
  stripe: ["POST /v1/charges", "GET /v1/charges"]
llm: true                   # LLM gateway access (incl. tool-calling loops; the SDK calls a
                            # tool's run() makes still need their own declarations here)
email: true                 # transactional email gateway access (email.send)
adhoc_sql: [analytics]      # only when the user explicitly requested direct/ad-hoc SQL
agents: [sales-digest]      # managed agents this app may start (agents.start/invoke).
                            # MISSING = REFUSAL, not pass-through — an undeclared agent 403s
                            # even for a caller who could invoke it from the dashboard.
                            # (personal_connectors: was REMOVED in CLI 0.3.0 — an account
                            # someone linked is just a connector row, declared under
                            # connectors: above by its name, e.g. "gmail-jp": [send_email])
```

Commands:

```bash
railcode manifest validate [path]   # strict local parse (default ./manifest.yaml)
railcode manifest show <app>        # the app's ratified doc (by slug); --json for raw
```

- `manifest validate` parses the file with the **same strict YAML grammar the server uses**
  (spaces not tabs; PyYAML 1.1 scalar rules — e.g. a bare `yes`/`no`/`on`/`off`/`null`/number
  resolves to a non-string and is rejected where a name is expected). It prints a summary of
  the declared operations; resource **names** (queries, connectors, connections, agents) are
  only checked against your org at deploy.
- **On deploy**, the manifest is ratified against the deployer's own grants — and the unit is
  the **diff** against what is already ratified, not the whole document:
  - *unchanged* (the content hash matches) → deploys as ordinary code, whatever you hold.
  - diff **adds** operations you hold, and/or only **removes** operations → **auto-ratifies**
    on the spot.
  - diff adds an operation you **don't** hold → the deploy is **rejected up front** with a
    `403`: *"This deploy adds authority you don't hold: `<ops>`."* Nothing is published — get
    the grant, or drop the operation from `manifest.yaml`. There is **no** pending-approval
    queue for this; blocking replaced it.

  Deploy prints the outcome (`Manifest unchanged.` / `Manifest ratified (you hold: …)` /
  `Manifest removed — …`). Deleting the file reverts the app to pass-through, but agents
  should keep an explicit `run_as: user` manifest unless the user asks to remove it.
- Only a `run_as: app` manifest grants anything, so a `run_as: user` manifest never needs
  ratification. Flipping `user` → `app` is therefore a **full** grant-add (you must hold
  everything declared); flipping `app` → `user` sheds it all and auto-applies.
- `manifest show` needs login and app access (403 otherwise); it prints who ratified the
  current doc and its content hash.
- `adhoc_sql` grants raw SQL authority and is intentionally scarce. Do not add it unless the
  user explicitly requested direct/ad-hoc SQL; otherwise use `saved_queries`.
- `connectors` covers accounts someone linked personally as well as shared org credentials —
  since CLI 0.3.0 they are the same kind of row, told apart by the row's `owner` and
  `access_mode`, not by a separate manifest key. It ratifies like every other key: the
  deployer must be able to reach the row (own it, be an admin, or have it shared with them).
  Declaring `gmail-jp: [send_email]` never lets the app read that inbox; an undeclared row or
  tool is a `403` no matter who deployed the app.
