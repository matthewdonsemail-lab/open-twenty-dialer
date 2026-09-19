import { defineSkill } from 'twenty-sdk/define';

import { CONVEX_AGENT_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: convex-agent/SKILL.md
export default defineSkill({
  universalIdentifier: CONVEX_AGENT_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'convex-agent',
  label: 'Convex Agent',
  description: 'Add an AI agent / RAG backend (@convex-dev/agent) to the Convex app.',
  content: "<!-- GENERATED from convex-agents content/capabilities/agent.json — do not edit by hand. -->\n\n# Add an AI agent / RAG backend\n\nInstall @convex-dev/agent for durable threads, message history, tool-calls, and vector search/RAG — the backend for an in-app AI agent. Call models through the Convex AI Gateway by default: Convex holds the provider credentials, so there is no LLM key to obtain, store, or rotate.\n\n## Workflow\n\n1. Install @convex-dev/agent + @convex-dev/ai-sdk-provider; add the agent component to convex.config.ts.\n2. Define the agent (tools, instructions) with `languageModel: convexGateway(\"provider/model\")` — no API key needed (needs convex 1.45+ on a Convex Cloud deployment, paid plan).\n3. Create threads + stream messages; persist history in Convex.\n4. For RAG: embed docs into a vector index and retrieve in the tool. The gateway does not serve embeddings yet, so store the embedding provider's key via the `env` micro power.\n5. Only if the gateway is unavailable (free plan, self-hosted, local backend): call the provider SDK with a key stored via the `env` micro power.\n\n## Rules\n\n- Default to the Convex AI Gateway (`convexGateway` from @convex-dev/ai-sdk-provider) for model calls; fall back to a provider key in Convex env only where the gateway is unavailable (free plan, self-hosted, local backend).\n- Never expose a provider API key client-side; when one is needed (embeddings, gateway fallback), keep it in Convex env via the `env` micro power.\n- Run model calls in actions ('use node' if the SDK needs it).\n- Persist threads/messages in Convex for durability + reactivity.",
});
