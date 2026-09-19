import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, routeBody, routeParam } from 'src/lib/dialer-client';
import { DIALER_PHONE_STATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const body = routeBody(event);
  const callState = body.callState as string | undefined;
  if (callState !== 'DIALING' && callState !== 'ACTIVE') return err(400, 'callState must be DIALING or ACTIVE');
  const memberId = body.memberId as string | undefined;
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const got = await getRest().get('/rest/agencyPhones/' + id);
  const agencyPhone = oneRow(got as { data?: unknown }, 'updateAgencyPhone', 'agencyPhone', 'agencyPhones') as Record<string, any> | null;
  if (!agencyPhone) return err(404, 'Phone not found');
  if (memberId && agencyPhone.claimedByMemberId && agencyPhone.claimedByMemberId !== memberId) {
    return err(403, 'Number is held by another member');
  }
  const data: Record<string, unknown> = { callState };
  if (body.currentCallId) data.currentCallId = body.currentCallId;
  const saved = await getRest().patch('/rest/agencyPhones/' + agencyPhone.id, data);
  return ok(oneRow(saved as { data?: unknown }, 'updateAgencyPhone', 'agencyPhone', 'agencyPhones') ?? saved);
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PHONE_STATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-phone-state',
  description: 'Set DIALING/ACTIVE on a held number (holder only)',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/phones/:id/state',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
