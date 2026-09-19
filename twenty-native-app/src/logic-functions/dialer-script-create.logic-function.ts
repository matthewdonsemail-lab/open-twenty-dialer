import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, restCatch, routeBody, pick } from 'src/lib/dialer-client';
import { DIALER_SCRIPT_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const data = pick(routeBody(event), ["name","scriptData","campaignIdId"]);
  try {
    const payload = await getRest().post('/rest/agencyScripts', data);
    return ok(oneRow(payload as { data?: unknown }, 'createAgencyScript', 'agencyScript', 'agencyScripts') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_SCRIPT_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-script-create',
  description: 'Create a Script',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/scripts',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
