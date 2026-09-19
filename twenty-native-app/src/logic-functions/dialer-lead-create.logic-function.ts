import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, restCatch, routeBody, pick } from 'src/lib/dialer-client';
import { DIALER_LEAD_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const data = pick(routeBody(event), ["name","contactName","email","phone","note","source","status","coldCallStatus","campaignIdId","agencyProspectId"]);
  try {
    const payload = await getRest().post('/rest/agencyLeads', data);
    return ok(oneRow(payload as { data?: unknown }, 'createAgencyLead', 'agencyLead', 'agencyLeads') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_LEAD_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-lead-create',
  description: 'Create a Lead',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/leads',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
