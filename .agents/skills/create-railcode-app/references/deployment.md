# Deployment

Use this reference when deploying a Railcode app or setting its access. Deploys are
org-scoped: `railcode deploy` publishes your app to the Railcode instance you logged into.

## App Deploy

From the app directory:

```bash
railcode deploy
```

`railcode deploy` reads `railcode.json`, runs the **CLI-owned build** for the declared `type`,
and uploads the static tree **plus the backend worker** as one unit.

**The two halves are one deploy.** The static tree and the worker module activate together and
revert together — there is no state where a page from one deploy talks to a worker from another.
Each deploy's worker is uploaded as its own immutable script, and the runtime ABI is recorded on
the deploy row, so a revert reproduces the *original* executable rather than rebuilding it.

**Secrets are not part of a deploy.** They are live app state: every activation — deploy, revert,
cold revert — re-applies the *current* secret set before the flip is observable, so a revert can
never resurrect a rotated value. Manage them with `railcode secrets`.

- **Which server** — resolved from `--api-url`, then `RAILCODE_API_URL`, then the saved CLI
  config from `railcode login`, then `https://api.railcode.app`. There is no
  `deploy.apiUrl` manifest key.
- **Auth** — the saved personal API token, or `RAILCODE_API_TOKEN` for non-interactive
  deploys. On a `401` the token is cleared and you're asked to `railcode login` again.
  With no saved config at all (a CI runner), also set `RAILCODE_ORG_UUID` — and prefer an
  app-scoped **deploy token** over a personal one. See
  [Deploy From CI](cli-workflow.md#deploy-from-ci-github-actions).
- **Where it lands** — the app is created-or-resolved by slug in your saved org. The first
  **successful** deploy is what creates the app; a failed first deploy leaves no phantom app.
- **Private on deploy** — `railcode deploy --private` is a one-shot action that sets this
  app's access to `private` for that deploy only; it is never persisted (see App Access).
- **App manifest** — always write a `manifest.yaml` in the app directory. It declares app
  authority for saved queries, connector endpoints, LLM, email, managed agents, personal
  connectors, egress hosts, crons, and (only when explicitly requested) ad-hoc SQL. It is
  uploaded and ratified as part of the deploy. **On apps v2 `run_as: app` is mandatory.** A
  manifest that adds operations the deployer doesn't hold lands as a **pending diff awaiting
  approval**, not a silent grant. See
  [cli-workflow.md](cli-workflow.md#app-manifest-authority).
- **Project source** — the deploy also uploads the project's own source, so `railcode pull`
  can bring it back later (new in CLI 0.1.32). It honors the project `.gitignore` plus a
  built-in exclude list (broadened in CLI 0.1.34 to cover tool/framework caches, editor and OS
  debris, and **env files** — `.env.example` still ships, `.claude/` ships on purpose) and the
  build-output dir; `--no-source` skips it. The source is stored where it cannot be served.
- **Version check** — the folder's `.railcode` marker makes the deploy conditional on the
  version it was based on, so a deploy cannot silently erase work the caller has not pulled.
  A stale base is a `409`; `--force` publishes over it. Deploy numbers count from 1 **per
  app** (CLI 0.1.33). See [cli-workflow.md](cli-workflow.md#the-version-marker-railcode).
- **Output resolution** — for the scaffolded stacks the `type` decides it and the CLI runs the
  build itself (esbuild for the worker, Vite or a copy for the frontend); the app carries no
  worker build script. For bring-your-own, `dist` names the static output and `server` the
  built worker module. A `dist` of `"."` is a no-build static tree.
- **Generation** — every new app is created at generation 2. A worker on a generation-1 app is
  refused with `422`; migrate first (one-way — see [migration.md](migration.md)).

After upload the CLI prints the live URL: `http://<app>.<org>.<serving-domain>/`
(e.g. `https://my-app.acme.railcode.dev/`).

## App Access

A newly created app defaults to **`organization`** access (every member of the org may open
it). The owner or an org admin sets access in the **admin UI** or with the `railcode apps`
commands (use `$manage-railcode-org` for full administration). The deploy-time exception is
the one-shot `railcode deploy --private` above.

Modes:

- `organization` — every org member (default).
- `private` — owners and editors only.
- `restricted` — owners and editors, plus explicitly-granted members.

Org admins/owners bypass per-app access (they manage every app). A user who lacks access
sees a 404, not a 403.

An app can also have **editors** (CLI 0.1.35): a co-deploy tier that may deploy, revert, pull
source, and read analytics in any mode, but may not delete, archive, transfer, or change the
mode. If you are deploying an app you did not create, check your own rights with
`railcode apps show <app>` (`can edit` / `can manage`) and read
[Working In A Shared App](cli-workflow.md#working-in-a-shared-app) — it covers pulling before
you deploy and why a `409` should not be `--force`d away.

## Post-Deploy Verification

After an app deploy, open the printed URL `https://<app>.<org>.<BASE_DOMAIN>/` and check:

- Unauthenticated visitors are sent through the platform login (the serving gate), not a
  custom app login.
- The frontend loads with no console errors and no failed `/api/*` calls.
- A worker route returns the expected `ctx.user` — identity arrives verified, not from the page.
- KV and file reads/writes succeed through your routes.
- SQL / LLM / connector / agent features show configured, empty, or disabled states cleanly —
  never a raw error or a hang.
- The app's access mode in the admin UI matches the intended audience.

**Then read the worker's own record of what happened** — this is the surface that tells you
whether an authority declaration was actually right:

```bash
railcode logs app --app <slug>                   # every invocation: path, status, duration, who
railcode logs app <invocation_id> --app <slug>   # one trace: console, errors, ops + verdicts
```

A governed call that was refused appears as an op with outcome `denied` and the resource name,
so a missing manifest entry is visible instead of looking like an app bug. Confirm the manifest
ratified as intended with `railcode manifest show <app>` — a **pending** diff means the deploy
asked for authority the deployer doesn't hold and it is waiting on approval.

To confirm a write landed rather than trusting the UI, read the live store from the terminal
with `railcode app kv list <collection>` / `railcode app files list` (CLI 0.1.28+, app owner or
org admin) — see [CLI workflow](cli-workflow.md#inspect-and-seed-app-storage). It reads the
deployed app, never `railcode dev`'s local emulation.
