import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, restCatch, routeBody, pick } from 'src/lib/dialer-client';
import { DIALER_PHONE_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const data = pick(routeBody(event), ["name","phoneNumber","countryCode","numberType","state","messagingProfileId","callState","claimedByMemberId","claimedByEmail","claimedAt","currentCallId","lastSyncedAt"]);
  try {
    const payload = await getRest().post('/rest/agencyPhones', data);
    return ok(oneRow(payload as { data?: unknown }, 'createAgencyPhone', 'agencyPhone', 'agencyPhones') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PHONE_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-phone-create',
  description: 'Create a Phone',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/phones',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
