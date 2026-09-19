import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_CRONS_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-crons/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_CRONS_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-crons',
  label: 'Convex Crons',
  description: 'Add recurring scheduled jobs (crons) to the Convex app.',
  content: "<!-- GENERATED from convex-agents content/capabilities/crons.json — do not edit by hand. -->\n\n# Add scheduled jobs (crons)\n\nDefine recurring jobs in convex/crons.ts targeting internal functions, with sane intervals and idempotent handlers.\n\n## Workflow\n\n1. Create convex/crons.ts with cronJobs().\n2. Schedule internal functions (never public api.*) at the right interval.\n3. Make handlers idempotent (safe to re-run); keep each run small.\n4. Verify the job appears in the dashboard schedule.\n\n## Rules\n\n- Schedule internal.* functions, never api.*.\n- Keep cron handlers small + idempotent.\n- Don't poll tight intervals for things a subscription can push.",
});
