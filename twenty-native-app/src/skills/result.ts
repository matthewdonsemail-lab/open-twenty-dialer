import { defineSkill } from 'twenty-sdk/define';

import { RESULT_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: result/SKILL.md
export default defineSkill({
  universalIdentifier: RESULT_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'result',
  label: 'Result',
  description: 'Get completed research task result by run ID',
  content: "# Get Research Result\n\n## Run ID: $ARGUMENTS\n\n```bash\nparallel-cli research poll \"$ARGUMENTS\" --json\n```\n\nPresent results in a clear, organized format.\n\nIf CLI not found, tell user to run `/parallel:parallel-cli-setup`.",
});
