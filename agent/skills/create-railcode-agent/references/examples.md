# Example Agents

Worked, runnable reference manifests for a minimal text agent and a scheduled saved-query
reporter. Start from the closest example and adapt it rather than authoring from scratch.

Each example is a real YAML file under [`../examples/`](../examples). Author agents in YAML by
default (see [SKILL.md](../SKILL.md), step 2) — these files double as the copy-and-adapt
starting point.

## Using an example

```bash
railcode agent test   --file examples/<name>.yaml --input '{...}' --trace   # unsaved draft run
railcode agent create --file examples/<name>.yaml                           # publish
railcode agent run    <name> --input '{...}' --trace                        # invoke the saved agent
```

Before running any of them:

- **Set `model:`** to the exact `model` column from `railcode llm models` — it is org-specific
  and validated for an exact match. Names commonly look like `provider/model`
  (`anthropic/claude-opus-4-8`, `bedrock/global.anthropic.claude-...`), but the format is a
  registration convention, not a rule — some entries are bare (`gpt-4o-mini`). Copy the column
  verbatim; a value the org has not registered fails with `Unknown LLM model`.
- **Grants and ratification.** Examples that declare grant-backed tools (`saved_queries`,
  `connectors`, `docs`, `email`, `adhoc_sql`, `app_data`, `app_data_write`) only save if the
  caller holds the matching authority — otherwise the save names the missing operation. See
  [manifest-tools.md](manifest-tools.md).

## Maintenance

These manifests are shape-correct against the backend agent-manifest schema as of the snapshot
tracked in [manifest-tools.md](manifest-tools.md). The CLI has no local manifest validator, so
treat `railcode agent test` (and server ratification warnings) as authoritative and re-verify
after any backend `tools.*` / `limits` change.

---

## `minimal-summarizer`

The smallest agent that runs, and the safe one to `test` first — it declares no tools, so a
draft run touches no data and has no side effects beyond model spend.

- **Scenario** — turn a blob of text into 3–5 bullet points.
- **Demonstrates** — the required skeleton (`kind: agent`, `name`, `model`, `system`) and
  the free-form input contract: input arrives unvalidated, so the `system` prompt names the
  expected fields (`text`, optional
  `max_bullets`) and says what to do when they're missing.
- **Visibility** — `org` (the default); no `--visibility` flag needed.
- **Non-defaults** — none. No `tools` (defaults to none) and no `limits` (defaults: 300
  steps / 1200 s / 150k total tokens — see [manifest-tools.md](manifest-tools.md); a later
  example tunes them).
- **Try it** (safe — no tools, no side effects):
  ```bash
  railcode agent test --file examples/minimal-summarizer.yaml \
    --input '{"text":"<paste a few paragraphs>","max_bullets":3}' --trace
  railcode agent create --file examples/minimal-summarizer.yaml
  railcode agent run minimal-summarizer --input '{"text":"..."}'
  ```
- **Adapt** — rewrite `system` for a different summary style; extend the input contract in
  `system` (e.g. an optional `format` of bullets or paragraph); add a `limits` block if
  inputs get large.

---

## `daily-metrics-report`

A scheduled reporting agent: run a saved query, email the digest. It runs on a cron schedule
with no caller input.

- **Scenario** — email the team a short daily summary of yesterday's product metrics.
- **Demonstrates** — `tools.saved_queries` (calls a ratified saved query), `tools.email` with a
  **domain allowlist** (recipients restricted to `yourcompany.com`), a `limits` block using the
  current keys (`max_tokens_total` / `max_tokens_turn`), and an attached **cron schedule** — a
  separate resource, not a manifest key.
- **Null-input by design.** A cron run always passes `null` input, so the `system` prompt
  tells the agent exactly what a run with no input should do.
- **Visibility** — `org` (the default).
- **Non-defaults** — a tight `limits` block, plus the cron schedule below.
- **Grants** — needs `daily_active_users` ratified as a saved query in the org, and the `email`
  grant (org default `*`). Missing either fails the save/run naming the gap
  (see [manifest-tools.md](manifest-tools.md)).
- **Try it — ⚠️ this test has real side effects.** `test` invokes the live tools: it runs the
  real query **and actually sends the email** to allowlisted recipients. Scope the `domains`/
  `emails` allowlist to yourself first, or only run it once you accept the send.
  ```bash
  # sends a real email — see warning above
  railcode agent test --file examples/daily-metrics-report.yaml --trace
  railcode agent create --file examples/daily-metrics-report.yaml
  ```
- **Schedule it** (companion command — the schedule is not stored in the manifest):
  ```bash
  railcode agent schedule set daily-metrics-report --cron "0 9 * * *" --timezone America/New_York
  railcode agent schedule show daily-metrics-report
  ```
  `--cron` is a five-field expression; `--timezone` is an IANA zone (or a `UTC±HH:00` offset).
  Schedules are capped at 48 fires/day (no more frequent than ~every 30 minutes).
- **Adapt** — swap the saved-query name; widen/narrow the email allowlist; change the cron or
  timezone; tune `limits`. To make it on-demand instead of scheduled, describe an input
  convention in `system` (e.g. an optional `date` override) and skip the `schedule set` step.
