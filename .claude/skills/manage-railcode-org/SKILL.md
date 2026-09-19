---
name: manage-railcode-org
description: Administer a Railcode organization through the Railcode CLI. Use for app access and ownership, members and system roles, custom roles and granular grants, saved-query publishing, data connections, service connectors, analytics, and org observability logs. Do not use for building apps or authoring managed-agent manifests.
version: 0.2.1
---

# Manage Railcode Org

## Update First

Before answering a Railcode management or CLI question or running a `railcode` command,
update the installed Railcode skills and CLI, then confirm npm's published version:

```bash
npx skills add Railcode-HQ/railcode-skills
npm install -g railcode@latest
railcode --version
npm view railcode version
```

If the skill changes, re-read this file from the top. If npm is unreachable, state that the
latest version could not be verified and do not claim this guidance is current. This version
was checked against published **Railcode CLI 0.1.28**.

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

## Management Workflow

### 1. Authenticate and establish scope

Run `railcode login` if needed. Management commands target the organization saved by login
and work from any directory; they do not require an app or `railcode.json`.

Before mutating state, confirm the intended organization and inspect the current resource.
Most references accept a name, slug, or email as appropriate, or a UUID. Prefer UUIDs when a
human-readable reference is ambiguous. Use `--json` when a machine-readable result matters.

### 2. Inspect before changing

Use the matching read command first: `apps show/access`, `members list`,
`roles list/grants/effective/catalog`, `connections list`, `connector list --admin`/`native`,
`query list`, `analytics`, or `logs`.

Owner/admin permissions are enforced server-side. A `403` is an authority boundary, not a
reason to bypass the CLI or use another credential without the user's authorization.

### 3. Apply the narrowest mutation

Change only the named resource. Preserve least privilege:

- grant specific resources instead of `*` unless broad access is explicitly intended;
- prefer saved queries over ad-hoc SQL authority;
- restrict service-connector HTTP methods;
- avoid embedding credentials in shell history—prefer the supported file options;
- do not delete, remove a member, transfer ownership, revoke access, or rotate credentials
  unless the user requested that state change.

### 4. Verify effective state

Repeat the relevant read command after mutation. For access changes, verify both the direct
policy and computed grants (`apps access`, `roles effective`). For connector setup, validate
with the least invasive list/docs/query operation that proves configuration without causing
unrequested downstream side effects.

## Capability Boundaries

- `members list` is readable by any member; member mutations require admin authority.
- App list/show/access follow per-app visibility; set-access/transfer/archive/unarchive/delete
  require manage rights (owner or org admin).
- Roles, grants, connections, connector administration, analytics, and logs are capability-
  gated server-side.
- The CLI cannot create a member. A new person joins through the invite flow in the web app;
  the CLI then lists, re-roles, or removes them.
- `apps delete` removes deploys and app data and is irreversible. `apps archive` is the
  reversible alternative — the app keeps serving, keeps its data, and keeps running its
  agents; it only leaves the launcher. Propose archiving whenever the user's goal is to
  retire an app rather than destroy it.
- `app kv` / `app files` (singular `app`) read and write a deployed app's records and files.
  They need an owner grant or `app:manage_any`, and `set`/`delete`/`drop`/`upload` mutate live
  tenant data — including individual members' private scopes. Inspect first; mutate only what
  was asked for.
- `roles materialize` expands a wildcard into explicit rows; inspect the subject and resource
  first because it changes future grant maintenance semantics.

## Skill Boundaries

Use `$create-railcode-app` for scaffolding, developing, testing, manifesting, and deploying a
static app. Use `$create-railcode-agent` for managed-agent JSON manifests, tests, invocations,
and schedules. This skill owns the organization-level administration those builders may
depend on.

## Reference

Read [CLI management reference](references/cli-management.md) for exact commands, flags,
resource types, access modes, connection shapes, log filters, and saved-query administration.
