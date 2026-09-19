import { defineCommandMenuItem } from 'twenty-sdk/define';

import { MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: '0336f3d0-ed0e-499d-9ffd-87b548b7b5ef',
  shortLabel: 'Dialer',
  label: 'Open Dialer',
  isPinned: true,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier: MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
