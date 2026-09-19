import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_TEST_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-test/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_TEST_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-test',
  label: 'Convex Test',
  description: 'Generate convex-test tests for the app\'s Convex functions.',
  content: "<!-- GENERATED from convex-agents content/capabilities/test.json — do not edit by hand. -->\n\n# Generate Convex tests\n\nUse convex-test + vitest to test functions against an in-memory backend: args/returns, auth paths, indexes, and scheduled functions.\n\n## Workflow\n\n1. Install convex-test + vitest.\n2. Write tests using convexTest(schema): seed via t.run, call t.query/t.mutation, assert.\n3. Cover auth (withIdentity), error paths, and scheduled functions (t.finishInProgressScheduledFunctions).\n4. Run vitest; keep tests deterministic.\n\n## Rules\n\n- Use convex-test (in-memory), not a live deployment.\n- Cover auth + error paths, not just the happy path.\n- Keep tests deterministic (no real time/network).",
});
