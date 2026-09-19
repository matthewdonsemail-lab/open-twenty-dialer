import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, routeParam } from 'src/lib/dialer-client';
import { DIALER_CALL_GET_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const payload = await getRest().get('/rest/agencyCalls/' + id);
  const rec = oneRow(payload as { data?: unknown }, 'agencyCall', 'agencyCalls');
  if (!rec) return err(404, 'Call not found');
  return ok(rec);
};

export default defineLogicFunction({
  universalIdentifier: DIALER_CALL_GET_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-call-get',
  description: 'Get one Call by id',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/calls/:id',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
