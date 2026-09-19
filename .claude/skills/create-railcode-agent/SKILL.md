---
name: create-railcode-agent
description: Build, test, publish, invoke, schedule, and update Railcode managed agents with the Railcode CLI. Use when creating an organization or personal managed agent, editing an agent manifest (JSON or YAML), running a draft or saved agent, investigating a run, managing its cron schedule, running it from Slack (@Railcode $agent), pairing it with a companion app, processing files in its sandbox, or using personal connectors (Gmail, Slack, ...) on behalf of one owner. Do not use for static Railcode apps, in-app LLM tool loops (llm.generate({ tools }) — see create-railcode-app), or general organization administration.
version: 0.1.25
---

# Create Railcode Agent

## Update First

Before answering a Railcode agent or CLI question or running a `railcode` command, update
the installed Railcode skills and CLI, then confirm npm's published version:

```bash
npx skills add Railcode-HQ/railcode-skills
npm install -g railcode@latest
railcode --version
npm view railcode version
```

If the skill changes, re-read this file from the top. If npm is unreachable, state that the
latest version could not be verified and do not claim this guidance is current. This version
was checked against published **Railcode CLI 0.1.28**. Agent input is free-form; the `system`
prompt defines its contract. The backend validates manifest tools and limits, so save-time
validation is authoritative over this snapshot.

Since 0.1.28 the CLI self-updates within its major version — but only on an **interactive
terminal**, and agent-driven sessions are non-interactive, so keep running the explicit
`npm install -g railcode@latest` above rather than assuming you're on the latest.

## Report Railcode feedback

After meaningful Railcode work, use the hidden `railcode agent-feedback` command
when you have concrete product feedback: a bug, friction, a suggestion, or something
that worked especially well. Submit once per distinct finding. Describe the task,
expected and actual behavior, and any workaround; keep the report concise and omit
credentials, private customer data, source files, and conversation transcripts.

```bash
railcode agent-feedback --message "Deploy failed with an unclear error; expected the missing field to be named." \
  --category friction --command "deploy" --context "Static app deploy; corrected the manifest to unblock."
```

Use `--file <path>` for a prepared report or pipe text on stdin instead of
`--message`. The message limit is 10,000 characters; `--context` is optional and
limited to 5,000. Categories: `bug`, `friction`, `suggestion`, `praise`, `other`
(default). Optionally self-report your assistant/tool name with `--agent` (e.g.
`Codex` or `Claude Code`) and your model with `--model`, if known. These are your
own claims and may be inaccurate; omit unknown values rather than guessing. These
fields and `--command` are limited to 200 characters each.

The CLI attaches its version, OS platform, CPU architecture, and Node version. The
backend links the report to the logged-in user and organization in PostHog. It
requires an existing login; it works outside an app directory. `Feedback accepted.`
means best-effort acceptance, not confirmed storage. If reporting fails, continue
the original task without repeated retries or logging in solely to send feedback.

This command is intentionally absent from CLI help and requires **CLI 0.3.3 or
later**. This feedback guidance was verified against the CLI 0.3.3 source. Older
CLIs may return `Unknown command`; treat that as unavailable.

## Map The Request To Railcode

Use this table before authoring the manifest. If the request names an external product or
data source, always check data connections/saved queries, service connectors, **and personal
connectors** before deciding what is available; the detailed discovery commands are in the
scoping step.

**Hard file boundary:** whenever AI must **read, understand, extract, summarize, transform, or
generate a file**, use a **managed agent** with `tools.app_files` and its sandbox. The companion
app may upload, store, list, download, and display files, but its in-page `llm.generate()` /
`llm.stream()` must never consume file contents, file URLs, file-derived payloads, or generate
file artifacts as a substitute. Publish durable results back through `tools.app_data_write`.

| What the user asks for | Use this Railcode feature |
|---|---|
| "Analyze company metrics/orders/customers from our database" | `tools.saved_queries` (default); use `tools.adhoc_sql` only when direct SQL is explicitly requested |
| "Use our team's shared Stripe, CRM, or other SaaS account" | `tools.connectors` plus `tools.docs`; the org owns the service-connector credential |
| "Use my Gmail, Slack, or another account I personally connected" | `tools.personal_connectors` on a **personal** agent; calls run as the agent owner |
| "Connect my account to a product Railcode does not bundle" | A custom MCP personal connector works for an **app, not an agent**; offer a companion app, service connector, or data import path |
| "Read records people manage in a Railcode app" | `tools.app_data`, usually with a companion app |
| "Read, extract, summarize, transform, or generate a file with AI" | **Managed agent** with `tools.app_files` + sandbox; never the companion app's `llm` |
| "Edit this Word document / DOCX and preserve it as a file" | **Managed agent + companion app**: the app stores/manages source and output files; declare `tools.app_files` to load the DOCX and `tools.app_data_write` to publish the edited document |
| "Create or revise a PowerPoint / PPTX deck" | **Managed agent + companion app**: the app manages templates, inputs, and generated decks; use the sandbox to create/edit the PPTX and `publish_artifact_to_app` to return it |
| "Create a PDF report, form, or document" | **Managed agent + companion app**: the app manages inputs and downloadable outputs; generate and verify the PDF in the sandbox, then publish it through `tools.app_data_write` |
| "Analyze this Excel / XLSX workbook" | **Managed agent + companion app**: the app stores the workbook and results; load it through `tools.app_files`, parse/analyze it in the sandbox, and publish durable results through `tools.app_data_write` |
| "Write results or publish an artifact back to an app" | `tools.app_data_write` (`app_kv_*` / `publish_artifact_to_app`) |
| "Remember state between runs" | `tools.agent_kv`; use app storage instead when humans need to view or edit it |
| "Parse files, produce documents, or run code" | Managed-agent sandbox plus `tools.app_files`; publish durable outputs back to an app with `tools.app_data_write` |
| "Email a report from the system" | `tools.email`; use a Gmail **personal connector** when it must send from the owner's own mailbox |
| "Run every morning, from Slack, or after a browser closes" | Managed agent plus a cron schedule or the built-in Slack invocation path |
| "Give people a UI to upload inputs, trigger runs, or review results" | A companion Railcode app whose **worker** calls `agents.start()` (see [Companion Apps](#companion-apps)) |
| "Call an arbitrary website/API" | First look for service or bundled personal connectors; otherwise offer connector setup/import—a managed agent cannot fetch the open web or declare custom MCP toolkits |

## Sandbox Capabilities

Managed agents run in a per-run code sandbox when sandboxing is configured for the deployment;
there is no manifest key or per-agent switch to request it. The sandbox provides shell and file
tools so the agent can write and run code, inspect and transform files, and use appropriate
libraries for tasks such as parsing Excel/CSV data, extracting or assembling PDFs, editing
documents, unpacking archives, and producing generated artifacts.

The sandbox is ephemeral and carries no credentials or standing org access. Bring tenant files
in with `tools.app_files`, reach other systems only through explicit manifest authorities, and
publish durable files or records back through `tools.app_data_write`. Anything left only in the
sandbox disappears when the run ends.

## When To Use A Managed Agent vs The In-Page LLM

A **managed agent** (this skill) runs server-side under its own ratified manifest, with a
code sandbox and durable, auditable runs. The **app's own LLM** (`llm.generate`/`llm.stream`
via `$create-railcode-app`) runs inside the app's worker and is bounded by that one
invocation — it cannot outlive the request, run code, or touch a file. Pick the first matching
row:

| The AI feature… | Use |
|---|---|
| Summarizes / classifies / analyzes data the app already reads — user watching, done in seconds | **The app's worker `llm`** |
| Reads, understands, extracts, summarizes, transforms, or generates any file | **Managed agent** (`app_files` + sandbox); never the app's `llm` |
| Writes and runs code | **Managed agent** (sandbox) |
| Is triggered outside the app (Slack, cron, API) | **Managed agent** |
| Must survive the request, run unattended, or needs retries | **Managed agent** |
| Has effects that must not depend on who's viewing (shared writes, send as the system) | **Managed agent** |
| Needs a run history someone will audit or debug | **Managed agent** |

The planes compose: the app keeps its chat shell in the page and delegates heavy steps by
calling `agents.start` from an LLM tool's `run` (the app manifest declares
`agents: [name]`; this agent declares `app_files: [app]` to reach uploaded files).

## Start From An Example

Railcode ships worked, deployable examples at
**https://github.com/Railcode-HQ/railcode-examples**. Read them to learn a pattern; copy one
when it covers much of what the user is asking for. Each `agents/` example is a **companion app
plus its agent manifests**, which is the shape most agent work takes.

| Example | What it is | Showcases |
| --- | --- | --- |
| [`agents/pitch-deck`](https://github.com/Railcode-HQ/railcode-examples/tree/main/agents/pitch-deck) | An app for uploading company materials, paired with an agent that writes a polished pitch-deck PDF from them. | App-paired managed agents: `app_data`/`app_files` access, code execution, and a run started with `agents.start()` from the app's worker because a worker cannot hold one open. |
| [`agents/proposals`](https://github.com/Railcode-HQ/railcode-examples/tree/main/agents/proposals) | An agent that watches Granola meetings on a cron and drafts an editable `.docx` proposal, paired with an app that displays them. | Personal connectors (Granola), an agent-owned cron schedule, and why that schedule cannot live on the app: a cron invocation has no caller, so `agents.start()` from cron is a 409. |

They pair an app with a managed agent because agents can't own files or storage directly — they
work through an app they have data access to. Both companion apps are **apps v2** (a static
`frontend/` plus a `server/index.ts` worker), so the agent is started from the app's worker, not
from the page. The repo's `apps/` directory holds plain-app examples (kanban, data chat, CRM);
reach for those through `$create-railcode-app`.

**Ask, don't assume.** When the request substantially overlaps an example, put the choice in the
step 1 scoping batch, naming the example in the user's own terms:

> *"Railcode provides an example that already generates client proposals from meeting notes.
> Should I use that as a starting point, or build from scratch?"*

Ask once, alongside the other scoping questions. Never copy an example unprompted, and don't
raise the question when nothing matches.

### Copying an example

Copy **only** the one directory, as plain files — never `git clone` the repo into the user's
project, add it as a submodule, or leave a `.git` behind:

```bash
mkdir -p my-proposals
curl -fsSL https://github.com/Railcode-HQ/railcode-examples/archive/refs/heads/main.tar.gz \
  | tar -xz --strip-components=3 -C my-proposals railcode-examples-main/agents/proposals
```

`--strip-components=3` drops `railcode-examples-main/agents/<example>/`, so the example's files
land directly in `my-proposals/`. Swap the trailing path for the other row above. To study one
manifest without copying anything, fetch it raw from
`https://raw.githubusercontent.com/Railcode-HQ/railcode-examples/main/agents/proposals/agents/proposal-writer/agent.yaml`.

The agent manifests live at `agents/<agent-name>/agent.yaml`; the app around them is a normal
Railcode app (`railcode.json` + `manifest.yaml`). Make the copy the user's own **before**
authoring behavior:

- Rename each `agents/<name>/` directory and the manifest's `name`, so the copy doesn't collide
  with an agent that already exists in the org.
- Point `tools.app_data` / `app_files` / `app_data_write` at the renamed companion app slug, and
  keep `visibility` right for the tools declared (`personal_connectors` needs `personal`).
- Cut every tool the new agent doesn't need — a copied manifest carries the example's authority,
  not the narrowest set for this job — and re-size `limits` for the new workload.
- Rewrite the `system` prompt and `input_schema` for the new contract; the example's prompt
  encodes its own step-by-step procedure and input shape.
- In the app: set `app` in `railcode.json`, rename `package.json`'s `name`, run `npm install`,
  update the `agents:` list in `manifest.yaml` and every `agents.start`/`agents.get` call,
  and replace the example's `README.md` if it ships one.

Then test the draft (`railcode agent test --file …`) before creating anything, exactly as in the
build workflow below. If the download fails, say so and build from scratch — don't reconstruct
an example from memory.

## Build Workflow

### 1. Scope the agent

Ask the scoping questions **first, all in one batch** — this is the moment the user is
still present; questions dribbled out mid-build risk landing after they've stepped away.
Phrase them for a **non-technical user who knows nothing of Railcode internals**: ask
about intent and let the answers pick the primitives without naming them. *"Should the
whole team be able to run this, or just you?"* — not "org or personal visibility?".
*"Should it also run by itself every morning?"* — not "do you want a cron schedule?". The
bullets below are what **you** need to learn from the answers, not the words to use.

If the request needs something agents can't do (scraping the open web, reacting to data
changes, running continuously — see [Hard Limits](#hard-limits)), say so up front and
propose the nearest supported shape. Clarify only choices that materially change the
definition:

**External source discovery is mandatory.** Whenever the user asks for an agent that reads,
writes, syncs, searches, or acts on data from a named product or system ("X"), do not jump
straight to a manifest or conclude that X is unsupported. Before choosing tools, inspect every
Railcode integration plane available to the signed-in user:

```bash
railcode db list                       # database/data-source connections
railcode query list                    # admin-published saved queries over those sources
railcode connector list                # org service connectors
railcode personal-connectors list      # per-user bundled and custom toolkits + connection status
```

Inspect any plausible match before authoring (`railcode connector docs <name>` and/or
`railcode personal-connectors tools <toolkit>`), and copy exact connector names, endpoints,
tool slugs, and schemas rather than guessing. Prefer saved queries over `adhoc_sql`. A bundled
personal toolkit requires `visibility: personal` and runs as the agent owner; an org agent
cannot declare personal connectors. If you cannot authenticate or reach the instance, ask what
is configured and give the user these discovery commands rather than treating the failed check
as evidence that no integration exists.

If no suitable source exists, explain the gap and offer concrete paths: have an admin connect a
database and publish a saved query; enable or create an org service connector for a shared
credential/API; or connect a bundled personal toolkit and make the agent personal. Also mention
a remote custom MCP personal connector when X provides one, but state the boundary clearly:
`custom_<slug>` connectors are callable by Railcode **apps only**, not managed-agent manifests.
For an agent workflow, offer a companion app that calls the custom MCP as its viewer, an
admin-configured service connector, or importing the needed data into a connected database/app
store the agent can read. If X exposes none of those supported surfaces, say Railcode cannot
connect to it directly and ask which alternative source the user wants to use.

- the job it owns and the output expected;
- the input it accepts — free-form JSON or text; the `system` prompt is the input contract;
- the model and tools it needs;
- whether it runs on demand, from an app, on a schedule, or by Slack mention;
- whether it needs a **companion app** (see [Companion Apps](#companion-apps));
- whether to **start from an example** — when one in [Start From An Example](#start-from-an-example)
  covers much of the request, ask: *"Railcode provides an example that already generates client
  proposals from meeting notes. Should I use that as a starting point, or build from scratch?"*;
- what real systems, data, spend, or side effects a test may touch;
- **its visibility** — `org` (the default: shared, invokable by anyone with an invoke
  grant, managed by its creator or any admin) or `personal` (owned and invoked by its
  creator alone, admins included — no grant makes it shared, and it cannot later become
  `org`). Pick `personal` only when the agent needs `tools.personal_connectors` (its
  owner's own Gmail/Slack/etc.) or should otherwise be usable by exactly one person.

Use the narrowest useful tool set and explicit instructions — but size `limits` the other
way: match the token budget to the task and **leave headroom**. Document-editing and
file-analysis runs use far more tokens than the defaults; a run that hits a cap dies as
`limit_exceeded`, while an unused ceiling costs nothing (see
[manifest tools reference](references/manifest-tools.md), "Sizing `limits`").
Do not invent tool identifiers,
provider names, or manifest fields; managed-agent manifest fields are server-defined (author
the file in JSON or YAML — see step 2). See
[manifest tools reference](references/manifest-tools.md) for the current `tools.*` vocabulary
and `limits` — a snapshot of the server schema, not a contract; a save-time error always wins
over this file.

### 2. Authenticate and inspect

Run `railcode login` if the CLI has no usable saved token. Agent commands use the selected
organization context and work from any directory; agents can have `org` or `personal`
visibility and do not use `railcode.json`.

**Manifest file format.** `--file` (on `create`/`update`/`test`) reads the manifest as **JSON
or YAML**; the CLI picks the parser by extension (`.yaml`/`.yml` → YAML, anything else →
JSON), and both parse to the same object the API stores. There is no local manifest-schema
validator — treat server validation and ratification warnings as authoritative.

For an existing agent, pull its exact stored manifest before editing:

```bash
railcode agent show <agent>
railcode agent pull <agent> --output agent.json
```

`pull` and `show --manifest` **emit JSON only** — there is no YAML output flag. If the user
asks to see or store an agent's definition as YAML, convert that pulled JSON to YAML yourself
and write `agent.yaml`; it round-trips back through `--file` unchanged.

For a new agent, author the manifest in the current server-supported shape — or, if the user
chose an example in step 1, copy that example's `agent.yaml` and adapt it (see
[Start From An Example](#start-from-an-example)). Write the `system` prompt as described in
[Writing The System Prompt](#writing-the-system-prompt). **Ask the user
whether to save the definition in the current working directory.** If yes, write it there as
YAML (`agent.yaml`) and feed that file to `test`/`create`; if no, keep it in a scratch
location outside their project.

### 3. Test the draft

Test an unsaved manifest before creating or replacing an agent:

```bash
railcode agent test --file agent.json --input '{"key":"value"}' --trace
```

Use `--input-file` for larger or sensitive test payloads. Testing invokes real configured
models and tools, so it may incur spend, read real data, or cause tool side effects. Get any
needed authorization before running a side-effecting test.

An agent that reads a companion app through `app_data`/`app_files` proves nothing against an
empty app. Seed it first with `railcode app kv set <collection> <key> '<json>'` and
`railcode app files upload <path>` (CLI 0.1.28+, app owner or org admin), using the shape the
app itself writes, then clean up anything throwaway.

Do not rely only on the process exit code: a request that reached the runtime can exit 0 even
when the run's printed status is failed. Check `Status:` or inspect `--json`.

A draft test does not persist writes. `app_data_write` tools run against a per-run in-memory
overlay, while `agent_kv` tools are omitted because no saved agent exists yet. An untouched
store after `test` is expected; use `create` + `run` to verify persistence. See
[manifest tools reference](references/manifest-tools.md#drafttest-caveats).

### 4. Publish or update

```bash
railcode agent create --file agent.yaml            # or agent.json — format is picked by extension
railcode agent create --file agent.yaml --visibility personal
railcode agent update <agent> --file agent.yaml
```

`update` replaces the stored manifest. Preserve fields intentionally by starting from
`railcode agent pull`, and read all ratification warnings before considering the change done.
While you're in the pulled manifest, audit the `system` prompt for debris left by earlier test
rounds — see [Writing The System Prompt](#writing-the-system-prompt).

`--visibility <org|personal>` on `create`/`update`/`test` sets or changes who the agent
belongs to. Omit it on `create`/`test` for the default `org`; omit it on `update` to leave
the existing visibility alone (never pass it just to be explicit — an omitted flag and an
explicit `org` are different requests server-side). Creating/transitioning to `personal`
needs the `agent:create` capability; `org` needs `agent:create_org` — holding one does not
imply the other. `personal -> org` is rejected outright; `org -> personal` is allowed but
does not retroactively change past shared runs/writes.

### 5. Verify the saved agent

```bash
railcode agent run <agent> --input '{"key":"value"}' --trace
railcode agent show <agent> --manifest
```

Confirm the saved manifest, run status, output, and relevant trace steps. For organization
observability logs, use `$manage-railcode-org`; its `railcode logs agent ...` workflow is an
admin capability rather than part of agent authoring.

When the agent writes back through `tools.app_data_write`, a clean run status is not proof the
data landed. Check the companion app's stores directly (CLI 0.1.28+, app owner or an org
admin):

```bash
railcode app kv collections --app <app>              # collections + record counts
railcode app kv list <collection> --app <app>        # what app_kv_set actually wrote
railcode app files list --app <app>                  # what publish_artifact_to_app produced
railcode app files download <name> --app <app>       # open the generated .docx/.pdf yourself
```

Add `--scope user --user <member-uuid>` or `--scope role --role <role-uuid>` to inspect a
non-shared namespace; `--scope all` lists across every scope with owner attribution. This is
also the fastest way to catch a **personal** agent writing into its owner's private scope when
the team expected shared records.

### 6. Schedule only when requested

Each managed agent currently has at most one cron schedule. Inspect it first, then use
`schedule set` to upsert or a stricter create/update alias when that distinction matters.

```bash
railcode agent schedule show <agent>
railcode agent schedule set <agent> --cron "0 9 * * *" --timezone UTC
```

Use an IANA timezone and a five-field cron expression. Verify the stored schedule after every
mutation. `run-now` executes synchronously against real services.

A scheduled run passes **null** input — there is no per-schedule payload. Write the `system`
prompt so a run with no input knows exactly what to do. See
[example agents](references/examples.md) (`daily-metrics-report`).

## Writing The System Prompt

The `system` prompt is the agent's whole contract: what job it owns, how to read its input,
and what to return. Two habits keep it working as it evolves.

**Prefer positive instruction.** Say what the agent *should* do rather than what it shouldn't.
*"Quote figures only from the uploaded materials, and write a bracketed placeholder where one
is missing"* gives the model something to aim at; *"don't invent figures"* forbids one path and
leaves the rest to guesswork. This is an encouragement, not a rule — a real boundary (*"never
email anyone outside the attendee list"*) is worth stating outright, and hard limits should
stay hard. But when a "don't" is standing in for a "do", write the "do".

**Audit the whole prompt on every update.** Each run reads the prompt cold. The agent has no
memory of previous versions, earlier runs, or the bug being chased last week — so prompts
accumulate debris that reads fine to us and misleads the agent:

- **Corrections phrased as history** — *"We no longer do X, do Y instead."* This agent never
  did X; the sentence introduces X and asks it to carry both. State only Y.
- **Debug leftovers** — a temporary *"for now, only process the first three rows"*, or a
  workaround for a bug that has since been fixed.
- **Orphaned steps** — instructions naming a tool, app, connector, or field the manifest no
  longer declares.
- **The same rule three times** in slightly different words, each added during a different
  test round. Restatements compete; keep the clearest one.

So before `railcode agent update`, read the stored `system` end to end from
`railcode agent pull` — not from memory of what you last wrote — and rewrite it as the
procedure someone encountering it cold would follow. A system prompt should read as a
specification, never as a changelog.

## Slack (On By Default)

Once an org admin has connected the org's Slack workspace, **every active agent is
reachable from Slack with no per-agent setup**. Members run one by mentioning the bot in a
channel it has been invited to:

```
@Railcode $<agent-name> summarize this thread
```

The agent name takes a leading `$` and must be the **first token** after the mention (a
bare name gets a usage hint instead of silently running something). What this means for
agent design:

- **Authority is unchanged.** The Slack caller is resolved by verified email to a live org
  member and must hold the normal invoke grant — no match, no run. A `personal` agent is
  therefore reachable on Slack only by its owner.
- **Input arrives as `{ text: <message> }`.** Agent input is free-form, so any agent can be
  mentioned; its `system` prompt must explain how to interpret that input.
- **The platform posts the final reply** into the mentioning thread, on success and on
  failure. Whatever the agent returns IS the Slack reply (a Slack-triggered run is told so
  in its system prompt and to write Slack mrkdwn); it does not need the `slack` connector
  to answer — that connector, when granted, is for interim progress updates only.

So any agent a team will use conversationally should handle free-text input and produce a
final answer that reads well as a Slack message.

## Companion Apps

An agent often needs a **companion app** — a small app (`$create-railcode-app`) deployed
alongside it. Every app built today is **apps v2**: a static frontend plus a backend worker, so
the companion app calls the agent **from its worker** with `@railcode/sdk`, not from the page.
Reach for this pattern whenever the agent relies on files or records someone must manage, or
people need a place to trigger it and see its output:

- **Storage the agent relies on** — the app is the UI for uploading and managing the files
  and records the agent reads: `files.upload()`/`db` in the app; `app_files: [<app-slug>]`
  / `app_data: [<app-slug>]` in the agent's manifest.
- **A surface for results** — the agent writes back via `app_data_write`
  (`app_kv_set`, `publish_artifact_to_app`) and the app renders run outputs.
- **An easy way to test and trigger** — a worker route wired to `agents.start(name, input)`
  (app manifest: `agents: [<agent-name>]`) exercises the agent end-to-end far faster than
  hand-crafting CLI runs, and doubles as the interactive production trigger.

Four things to know about driving an agent from a v2 companion app:

- `agents.start()` returns the **queued** run immediately. Hand `request_id` to the frontend and
  let it poll a route that calls `agents.get()`. There is no worker-side call that waits for a
  run, and a `get()` loop is not a substitute: it spends a subrequest per poll and its token
  expires before a long run ends.
- The app must **declare the agent** (`agents: [<name>]`). A missing declaration is a refusal
  (`403`), not pass-through — even for a caller who could invoke it from the dashboard.
- **A run is owned by `(app, caller)`.** The app can only read runs it started, for the caller who
  started them; a dashboard-started run is invisible to it.
- **An app cron cannot start a run** (`409` — no caller means no run owner). For scheduled work,
  give the agent **its own schedule**.

**Prefer an ORG agent for a v2 companion app.** An org agent's `app_data_write` lands in the
app's *shared* scope, which **is** a v2 app's flat `db` store — so results appear in a collection
the worker already reads, with no bridge. A **personal** agent writes into its owner's *user*
scope, which on a migrated app is frozen and read-only from the worker.

Name the app after the agent (e.g. agent `report-extractor`, app
`report-extractor-console`), declare the narrowest slugs on both sides, and build the app
with `$create-railcode-app`. The `agents/` rows in [Start From An Example](#start-from-an-example)
are working apps-v2 versions of exactly this pairing, agent manifest and worker both — copy one
when it covers what the user is asking for.

## Hard Limits

What a managed agent **cannot** do, regardless of manifest (the full platform-wide list is
in `$create-railcode-app` → "Limitations"):

- **Reach the open web.** Sandbox egress is an allowlist (PyPI, npm, the presigned
  download host with `app_files`); the `connector` tool reaches only ratified endpoints.
  No scraping, no arbitrary APIs.
- **Run long or continuously.** Runs are bounded — at most 300 steps / 1200 s / the token
  caps in `limits`. No daemons, no monitors; recurring work is a cron schedule.
- **React to events.** Triggers are app/API call, cron, and Slack mention only — no
  data-change or inbound-webhook triggers.
- **Invoke other agents.** There is no agent→agent tool; compose pipelines through an app
  or an external caller instead.
- **Use custom MCP personal connectors.** A user-added by-URL MCP connector
  (`custom_<slug>`) works for its owner and for apps, but is **not declarable in an agent
  manifest** — ratification checks the static registry. Bundled toolkits only.
- **Keep sandbox state.** The sandbox filesystem is per-run; anything worth keeping must
  be published (`publish_artifact_to_app`) or written to KV before the run ends.

## Permissions and Boundaries

- `list`, `show`, and `pull` only ever return **org** agents plus the caller's **own**
  personal agents — someone else's personal agent is invisible (a 404, never a 403, to
  avoid confirming it exists), admins included.
- For an **org** agent: `run` needs an invoke grant for that agent; `update`/`delete`/`test`/
  schedule mutations are allowed for **the agent's own creator, or any org owner/admin** — not
  every member. Creating (or transitioning an existing agent to) `org` additionally needs the
  `agent:create_org` capability.
- For a **personal** agent: invoke and manage are both **owner-only, with no admin
  override** — there is no break-glass, so even an org owner/admin can't reach someone else's.
  Creating one needs the broadly-grantable `agent:create` capability, not owner/admin.
- `delete` archives the agent while keeping run history and requires `--yes` outside a TTY.
- Use `$create-railcode-app` when building an app that starts an agent from its worker through
  `agents.start(name, input)`. A privileged app manifest declares `agents: [name]`.
- An app can also run its own agentic loop **in the page** with `llm.generate({ tools })` /
  `llm.stream({ tools })` — no managed agent involved. See **When To Use A Managed Agent
  vs The In-Page LLM** at the top of this skill for the split.
- Use `$manage-railcode-org` for members, roles/grants, apps/access, connections, service
  connectors, analytics, and organization logs.

## Reference

Read [CLI reference](references/cli-workflow.md) for the exact agent commands, aliases,
schedule behavior, inputs, outputs, and failure semantics. Read
[manifest tools reference](references/manifest-tools.md) for the `tools.*` vocabulary,
what each grants, its permission gate, and `limits`. Read
[example agents](references/examples.md) for worked, runnable manifests covering a minimal
agent and a scheduled query-to-email workflow. For complete agent-plus-companion-app projects
(pitch decks, client proposals), read or copy from `railcode-examples` — see
[Start From An Example](#start-from-an-example).
