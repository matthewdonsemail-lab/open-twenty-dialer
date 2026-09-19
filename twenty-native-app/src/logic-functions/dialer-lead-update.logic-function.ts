import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, restCatch, routeBody, routeParam, pick } from 'src/lib/dialer-client';
import { DIALER_LEAD_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const data = pick(routeBody(event), ["name","contactName","email","phone","note","source","status","coldCallStatus","campaignIdId","agencyProspectId"]);
  try {
    const payload = await getRest().patch('/rest/agencyLeads/' + id, data);
    return ok(oneRow(payload as { data?: unknown }, 'updateAgencyLead', 'agencyLead', 'agencyLeads') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_LEAD_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-lead-update',
  description: 'Update a Lead',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/leads/:id',
    httpMethod: 'PATCH',
    isAuthRequired: true,
  },
});
