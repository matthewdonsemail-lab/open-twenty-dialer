import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_IMPROVE_CONVEX_PLUGIN_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-improve-convex-plugin/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_IMPROVE_CONVEX_PLUGIN_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-improve-convex-plugin',
  label: 'Convex Improve Convex Plugin',
  description: 'Send this coding session\'s transcript to the Convex team for an AI post-mortem that improves the quickstart system.',
  content: "<!-- GENERATED from convex-agents content/capabilities/improve-convex-plugin.json — do not edit by hand. -->\n\n# improve-convex-plugin\n\nSends the current coding session transcript to the anteater POST /review endpoint for an AI post-mortem. The review returns structured findings (ambiguous instructions, agent-stuck patterns, tooling failures, wins) targeted at the runbook, bootstrap script, skills, and components — not end-user data. Sharing is opt-in: the anteater-served helper asks once (Always / Just this once / Never) and remembers the choice.\n\n## Workflow\n\n1. Run the anteater-served helper: `curl -fsSL \"<anteater>/send-transcript\" | bash -s -- --idea \"<one-line app idea from this session>\"`.\n2. If it prints CONSENT_REQUIRED (exit 4), the user has not chosen yet — ask them to share Always, Just this once, or Never, then re-run appending --consent always|once|never. Do not send until they answer.\n3. Watch for output markers: REVIEW_SOURCE (transcript found), REVIEW_SUBMITTED id=... (accepted), REVIEW_DONE status=done (findings ready).\n4. Summarize the highest-severity findings for the user: title → target → suggestedFix, then wins. Keep the summary about the system, not the user's data.\n\n## Rules\n\n- Never send a transcript until the user has explicitly chosen to share (the helper prints CONSENT_REQUIRED and exits until they do).\n- REVIEW_NO_TRANSCRIPT means no Claude/Codex .jsonl was found — tell the user.\n- Never paste raw secrets back — the script redacts keys/tokens before upload; keep the summary system-focused.\n- This is a system-improvement loop, not end-user feature feedback.",
});
