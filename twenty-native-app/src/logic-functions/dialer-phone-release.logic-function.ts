import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, routeBody, routeParam } from 'src/lib/dialer-client';
import { DIALER_PHONE_RELEASE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const body = routeBody(event);
  const memberId = body.memberId as string | undefined;
  const force = body.force === true;
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const got = await getRest().get('/rest/agencyPhones/' + id);
  const agencyPhone = oneRow(got as { data?: unknown }, 'updateAgencyPhone', 'agencyPhone', 'agencyPhones') as Record<string, any> | null;
  if (!agencyPhone) return err(404, 'Phone not found');
  if (!force && memberId && agencyPhone.claimedByMemberId && agencyPhone.claimedByMemberId !== memberId) {
    return err(403, 'Number is held by another member');
  }
  const saved = await getRest().patch('/rest/agencyPhones/' + agencyPhone.id, { callState: 'IDLE', claimedByMemberId: null, claimedByEmail: null, claimedAt: null, currentCallId: null });
  return ok(oneRow(saved as { data?: unknown }, 'updateAgencyPhone', 'agencyPhone', 'agencyPhones') ?? saved);
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PHONE_RELEASE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-phone-release',
  description: 'Release a number to IDLE (holder only unless force)',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/phones/:id/release',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
