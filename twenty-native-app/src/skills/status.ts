import { defineSkill } from 'twenty-sdk/define';

import { STATUS_SKILL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Ported from local agent skill: status/SKILL.md
export default defineSkill({
  universalIdentifier: STATUS_SKILL_UNIVERSAL_IDENTIFIER,
  name: 'status',
  label: 'Status',
  description: 'Check running research task status by run ID',
  content: "# Check Research Status\n\n## Run ID: $ARGUMENTS\n\n```bash\nparallel-cli research status \"$ARGUMENTS\" --json\n```\n\nIf CLI not found, tell user to run `/parallel:parallel-cli-setup`.",
});
