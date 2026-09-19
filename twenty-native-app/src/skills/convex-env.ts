import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_ENV_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-env/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_ENV_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-env',
  label: 'Convex Env',
  description: 'Set and wire Convex deployment env vars / secrets for the app.',
  content: "<!-- GENERATED from convex-agents content/capabilities/env.json — do not edit by hand. -->\n\n# Manage env vars + secrets\n\nStore secrets as Convex deployment env vars (npx convex env set), read them with process.env in actions, never commit them.\n\n## Workflow\n\n1. `npx convex env set KEY value` (per deployment).\n2. Read via process.env.KEY inside actions (not queries/mutations).\n3. Never hardcode or commit secrets; add to .env.local only for local.\n4. Confirm with `npx convex env list`.\n\n## Rules\n\n- Secrets live in Convex env vars, never in code or git.\n- process.env only in actions ('use node' if needed), not queries/mutations.\n- Different deployments need their own values.",
});
