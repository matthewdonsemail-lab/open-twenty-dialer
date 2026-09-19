import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, routeBody, routeParam } from 'src/lib/dialer-client';
import { DIALER_PHONE_CLAIM_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const body = routeBody(event);
  const memberId = body.memberId as string | undefined;
  const memberEmail = (body.memberEmail as string | undefined) ?? null;
  if (!memberId) return err(400, 'memberId is required');
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const got = await getRest().get('/rest/agencyPhones/' + id);
  const agencyPhone = oneRow(got as { data?: unknown }, 'updateAgencyPhone', 'agencyPhone', 'agencyPhones') as Record<string, any> | null;
  if (!agencyPhone) return err(404, 'Phone not found');
  if (agencyPhone.callState !== 'IDLE' && agencyPhone.claimedByMemberId !== memberId) {
    return err(409, 'Number is held by another member', { heldBy: { memberId: agencyPhone.claimedByMemberId, email: agencyPhone.claimedByEmail, since: agencyPhone.claimedAt } });
  }
  const data: Record<string, unknown> = { callState: 'DIALING', claimedByMemberId: memberId, claimedByEmail: memberEmail, claimedAt: new Date().toISOString() };
  if (body.currentCallId) data.currentCallId = body.currentCallId;
  const saved = await getRest().patch('/rest/agencyPhones/' + agencyPhone.id, data);
  return ok(oneRow(saved as { data?: unknown }, 'updateAgencyPhone', 'agencyPhone', 'agencyPhones') ?? saved);
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PHONE_CLAIM_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-phone-claim',
  description: 'Claim a number IDLE->DIALING (409 heldBy when taken)',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/phones/:id/claim',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
