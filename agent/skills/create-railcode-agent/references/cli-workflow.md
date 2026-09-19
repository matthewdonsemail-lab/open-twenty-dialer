# Managed-Agent CLI Reference

## Setup

Install or update the regular npm package, verify it against npm, then log in:

```bash
npm install -g railcode@latest
railcode --version
npm view railcode version
railcode login [--api-url <url>]
```

The CLI stores its selected instance, organization, and personal token at
`${RAILCODE_HOME:-~/.railcode}/config.json`. Resolution is `--api-url`, then
`RAILCODE_API_URL`, then saved config. `RAILCODE_API_TOKEN` overrides the saved token for CI.
On a `401`, the saved token is cleared and the CLI asks for login again.

`railcode login` uses browser authorization. `railcode login --setup-token <token>` is the
one-time, non-browser onboarding path. Managed-agent commands use the selected organization
context and work from any directory; saved agents may be organization-visible or personal.

## Agents

```bash
railcode agent list
railcode agent show <agent> [--manifest]
railcode agent pull <agent> [--output agent.json]
railcode agent create --file agent.json [--visibility org|personal]
railcode agent update <agent> --file agent.json [--visibility org|personal]
railcode agent delete <agent> [--yes]
railcode agent test --file agent.json --input '{"k":"v"}' [--trace] [--visibility org|personal]
railcode agent run <agent> --input '{"k":"v"}' [--trace]
```

- `<agent>` is a name or UUID. Aliases: `list`=`ls`, `show`=`get`, `pull`=`export`,
  `update`=`edit`, `delete`=`rm`, `run`=`invoke`, and `agent`=`agents`.
- `--file` (on `create`/`update`/`test`) accepts the manifest as **JSON or YAML** in the exact
  shape stored under `agent.manifest` — the CLI picks the parser by extension (`.yaml`/`.yml`
  → YAML, otherwise JSON) and both parse to the same object. This is the agent's own manifest,
  distinct from the app *authority* manifest (`$create-railcode-app`), which is always YAML.
  `pull` and `show --manifest` **emit JSON only** — there is no YAML output flag; `pull` writes
  the current manifest, `show --manifest` prints it. To hand off the definition as YAML,
  convert that pulled JSON yourself.
- `create` and `update` print the agent name, UUID, visibility, and ratification warnings.
  `--json` prints the raw response. `update` replaces the stored manifest.
- **`--visibility <org|personal>`** sets who the agent belongs to. On `create`/`test`,
  omitting it defaults to `org`; on `update`, omitting
  it **leaves the existing visibility alone** — the CLI only sends the key when you pass the
  flag, matching the API's own "omitted = don't touch" contract. `agent show`/`list` print
  `visibility`, and `show` prints an `Owner:` line for a `personal` agent. See
  [manifest-tools.md](manifest-tools.md) for what `visibility: personal` unlocks
  (`tools.personal_connectors`) and the ownership model.
- `delete` archives the agent and keeps run history. It prompts on a TTY; `--yes` is required
  non-interactively.
- `run` and `test` accept either `--input '<json>'` or `--input-file <path>`, never both. The
  default input is `null`. `test` runs an unsaved manifest; `run` invokes a saved agent.
- Human output includes `Status:`, request ID, and output JSON. `--trace` appends a table of
  model/tool steps; `--json` prints the raw run detail.
- A runtime failure can still exit 0 when the invocation request itself succeeded. Input is
  free-form, so there is no input-schema validation `422`.
  Automation must inspect the run status, not only `$?`.

Permissions: `list`/`show`/`pull` only ever surface **org** agents plus the caller's own
**personal** agents (someone else's personal agent 404s, admins included). For an **org**
agent, `run` needs an invoke grant, and `update`/`delete`/`test`/schedule mutations are
allowed for **the agent's own creator, or any org owner/admin** — not every member; creating
one (or transitioning an existing agent to `org`) additionally needs `agent:create_org`. For
a **personal** agent, invoke and manage (including schedules) are both **owner-only with no
admin override** — even an org owner/admin can't reach someone else's; creating one needs the
broadly-grantable `agent:create` capability instead. `agent:create` and `agent:create_org` are
independent — holding one does not imply the other.

## Schedules

Each agent currently has at most one schedule. The schedule is a resource under the agent,
not part of its JSON manifest.

```bash
railcode agent schedule show <agent>
railcode agent schedule set <agent> --cron "0 9 * * *" --timezone UTC
railcode agent schedule add <agent> --cron "0 9 * * *" --timezone UTC
railcode agent schedule update <agent> --cron "30 9 * * 1-5"
railcode agent schedule pause <agent>
railcode agent schedule resume <agent>
railcode agent schedule run-now <agent> [--trace]
railcode agent schedule delete <agent> [--yes]
```

- `set` upserts: create requires `--cron`; creation defaults `--name` to `default`, timezone
  to `UTC`, and enabled to true. Updating accepts any of `--name`, `--cron`, `--timezone`,
  `--enabled`, or `--disabled`.
- `add`/`create` is create-only and errors if a schedule exists. `update` is update-only and
  errors when none exists.
- `--cron` (alias `--schedule`) takes a five-field cron expression. `--timezone` takes an IANA
  zone.
- `pause` and `resume` toggle `enabled`. `run-now` (alias `run`) executes synchronously and
  prints run detail. `delete` (alias `rm`) prompts unless `--yes` is passed.
- Every schedule mutation follows the same manage-authority rule as `update`/`delete` above:
  the agent's creator or an org owner/admin for an **org** agent; the owner alone, with no
  admin override, for a **personal** agent.

## Related Commands

```bash
railcode llm providers
railcode llm models
```

These show callable provider/model names without revealing keys. For agent run logs, use
`railcode logs agent [--agent <uuid>] [--status <value>]`, documented in
`$manage-railcode-org`.
