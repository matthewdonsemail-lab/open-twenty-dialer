import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, ok, err, routeParam } from 'src/lib/dialer-client';
import { DIALER_PROSPECT_DELETE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  await getRest().delete('/rest/agencyProspects/' + id);
  return ok({ id });
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PROSPECT_DELETE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-prospect-delete',
  description: 'Delete a Prospect',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/prospects/:id',
    httpMethod: 'DELETE',
    isAuthRequired: true,
  },
});
