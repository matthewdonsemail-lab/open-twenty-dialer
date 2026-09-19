import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_SEED_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-seed/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_SEED_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-seed',
  label: 'Convex Seed',
  description: 'Seed or import data into the Convex database.',
  content: "<!-- GENERATED from convex-agents content/capabilities/seed.json — do not edit by hand. -->\n\n# Seed / import data\n\nPopulate tables via an internalMutation seed function (re-runnable) or `npx convex import`, matching the schema.\n\n## Workflow\n\n1. For fixtures: write an internalMutation that inserts sample rows; run it with `npx convex run`.\n2. For bulk import: shape the data to the schema and use `npx convex import`.\n3. Make seeding idempotent (clear-then-insert or upsert) so re-running is safe.\n4. Verify row counts.\n\n## Rules\n\n- Seed via internalMutation or convex import, matching validators.\n- Make seeding idempotent.\n- Never seed secrets/PII into a shared deployment.",
});
