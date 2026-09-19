import { defineApplicationRole } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Universal identifiers of the workspace custom objects the dialer works
// with (stable across installs; resolved from /rest/metadata/objects).
const AGENCY_OBJECT_UNIVERSAL_IDENTIFIERS = [
  '740ef4a9-a569-4775-827f-cfa18f3b7cc3', // agencyProspect
  'd42026c2-6b4a-436f-a042-e1c513e36bfd', // agencyLead
  '23f2ffb3-aa36-4fa0-81cb-975140a5175a', // agencyCampaign
  'e873fd3b-a2e1-482c-a9d7-a1cdfc91e86e', // agencyScript
  '9ddd6140-823f-41ba-8320-d8608d79392c', // agencyPhone
  'bb69c50f-c4b0-4d55-ab21-94f03e3aa99a', // agencyCall
];

export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} default function role`,
  description: `${APP_DISPLAY_NAME} default function role`,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: true,
  objectPermissions: AGENCY_OBJECT_UNIVERSAL_IDENTIFIERS.map(
    (objectUniversalIdentifier) => ({
      objectUniversalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: true,
    }),
  ),
});
