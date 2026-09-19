import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_MIGRATE_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-migrate/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_MIGRATE_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-migrate',
  label: 'Convex Migrate',
  description: 'Migrate schema + backfill data on a deployed Convex app using @convex-dev/migrations.',
  content: "<!-- GENERATED from convex-agents content/capabilities/migrate.json — do not edit by hand. -->\n\n# Migrate the schema / data on a live app\n\nChange a deployed schema without breaking existing data: stage the schema change, install @convex-dev/migrations, write a backfill that makes old rows valid, run it, and verify before tightening the validator.\n\n## Workflow\n\n1. Make the new field optional first (so deploy doesn't reject existing rows).\n2. Install @convex-dev/migrations; write a migration that backfills/transforms existing rows.\n3. Run the migration; verify all rows are valid.\n4. Tighten the validator (make the field required) once the backfill is complete.\n\n## Rules\n\n- Never tighten a validator before the backfill completes — it rejects existing rows and breaks the live app.\n- Add new fields as optional first, migrate, then require.\n- Verify row counts before and after.",
});
