import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_SENTINEL_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-sentinel/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_SENTINEL_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-sentinel',
  label: 'Convex Sentinel',
  description: 'Set up Sentinel production error capture in your own Convex deployment.',
  content: "<!-- GENERATED from convex-agents content/capabilities/sentinel.json — do not edit by hand. -->\n\n# Capture production errors in your own deployment\n\nInstall `@convex-dev/sentinel` to capture production errors (server function failures, client JS/React crashes, OCC and scale signals) into a table in the user's OWN deployment, redacted at write time, then react to new ones. Data never leaves the user's deployment.\n\n## Workflow\n\n1. Install the component: `app.use(sentinel)` in `convex/convex.config.ts`.\n2. Wire the client SDK: a React error boundary plus `window.onerror`/`unhandledrejection` and breadcrumbs.\n3. Redaction runs at write time and is on by default (default-deny on secret key names and value patterns).\n4. Read recent errors with the Convex CLI (`convex data`, `run-once-query`); react to new ones via the monitor's `prod_error` event.\n5. Optionally enable the self-healing cron: `triage` classifies each error and, for recurring non-transient ones, hands it to ai-runner to open a fix PR.\n\n## Rules\n\n- Redaction is mandatory and on by default — never store raw secrets; the agent's reads reach the model provider.\n- Data stays in the user's deployment; never send it to a third party.\n- Sample and cap to control volume and cost.\n- Capturing PROD errors needs a deployed cloud app; install works anonymously.",
});
