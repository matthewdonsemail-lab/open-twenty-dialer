import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_REVIEWER_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-reviewer/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_REVIEWER_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-reviewer',
  label: 'Convex Reviewer',
  description: 'Convex code reviewer — security, auth, validators, performance, and pattern checks for code in a convex/ directory. Use to review or audit Convex functions before shipping.',
  content: "<!-- GENERATED from convex-agents content/capabilities/convex-reviewer.json — do not edit by hand. -->\n\n# Convex Code Reviewer\n\nStructured review of Convex code for security, authorization, validators, performance, and schema design. Applies a Convex-specific checklist and flags anti-patterns with severity (Critical / Important / Suggestion).\n\n## Workflow\n\n1. First pass — Security: verify all public functions check ctx.auth.getUserIdentity(), verify resource ownership before reads/writes, confirm no client-provided user IDs are trusted, confirm scheduled functions target internal.* not api.*.\n2. Second pass — Performance: confirm no .filter() on DB queries (withIndex required), verify all foreign-key fields have indexes, confirm no Date.now() in query handlers, confirm .collect() is not used on unbounded queries.\n3. Third pass — Code quality: confirm args and returns validators on every public function, no any types, promises are awaited, arrays in documents are bounded (<8192 elements).\n4. Report findings grouped by severity; explain why each issue matters and suggest a fix.\n\n## Rules\n\n- Flag missing auth checks as Critical — any unauthenticated public mutation is a data-loss risk.\n- Flag .filter() on DB queries as Important — it is a full table scan.\n- Flag Date.now() in query handlers as Important — it breaks reactivity.\n- Flag missing args or returns validators as Important.\n- Flag scheduling to api.* (not internal.*) as Important.\n- Always explain why a change is needed, not just what to change.",
});
