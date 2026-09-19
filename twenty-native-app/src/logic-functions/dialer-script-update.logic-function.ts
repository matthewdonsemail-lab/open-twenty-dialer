import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, restCatch, routeBody, routeParam, pick } from 'src/lib/dialer-client';
import { DIALER_SCRIPT_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const data = pick(routeBody(event), ["name","scriptData","campaignIdId"]);
  try {
    const payload = await getRest().patch('/rest/agencyScripts/' + id, data);
    return ok(oneRow(payload as { data?: unknown }, 'updateAgencyScript', 'agencyScript', 'agencyScripts') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_SCRIPT_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-script-update',
  description: 'Update a Script',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/scripts/:id',
    httpMethod: 'PATCH',
    isAuthRequired: true,
  },
});
