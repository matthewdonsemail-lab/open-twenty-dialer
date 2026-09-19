import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, restCatch, routeBody, routeParam, pick } from 'src/lib/dialer-client';
import { DIALER_PHONE_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const data = pick(routeBody(event), ["name","phoneNumber","countryCode","numberType","state","messagingProfileId","callState","claimedByMemberId","claimedByEmail","claimedAt","currentCallId","lastSyncedAt"]);
  try {
    const payload = await getRest().patch('/rest/agencyPhones/' + id, data);
    return ok(oneRow(payload as { data?: unknown }, 'updateAgencyPhone', 'agencyPhone', 'agencyPhones') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PHONE_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-phone-update',
  description: 'Update a Phone',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/phones/:id',
    httpMethod: 'PATCH',
    isAuthRequired: true,
  },
});
