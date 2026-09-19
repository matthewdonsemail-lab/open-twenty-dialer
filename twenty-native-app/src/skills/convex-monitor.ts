import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_MONITOR_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-monitor/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_MONITOR_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-monitor',
  label: 'Convex Monitor',
  description: 'Watch for the next dev/prod error or request in a Convex app and react to it.',
  content: "<!-- GENERATED from convex-agents content/capabilities/monitor.json — do not edit by hand. -->\n\n# Watch for the next thing to react to\n\nBlock on the next typed event instead of polling. Races local error logs, deployment subscriptions, and Sentinel prod-error rows; returns the first to fire (or a quiet heartbeat).\n\n## Workflow\n\n1. Call `wait_for_event` with {project_dir, event_kinds, timeout_ms}.\n2. On kind=convex_error/next_error: decode and fix it. On kind=prod_error: triage (see sentinel) and fix. On kind=feature_request: build it. On kind=quiet: loop.\n3. Where a harness has no blocking MCP (e.g. Copilot cloud), the pack runs a poll loop with the SAME event contract — same behavior, different mechanism.\n\n## Rules\n\n- Prefer the blocking tool; fall back to a poll loop only where blocking MCP is weak.\n- The event schema is fixed and versioned — the same trigger yields the same typed event.\n- Prod events (kind=prod_error) require a deployed cloud app plus Sentinel.",
});
