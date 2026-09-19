import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, restCatch, routeBody, routeParam, pick } from 'src/lib/dialer-client';
import { DIALER_PROSPECT_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const data = pick(routeBody(event), ["name","phone","email","website","websiteUrl","slug","city","region","country","niche","rating","reviewCount","coldCallStatus","outboundState","outboundLabel","externalId","campaignIdId","fullAddress"]);
  try {
    const payload = await getRest().patch('/rest/agencyProspects/' + id, data);
    return ok(oneRow(payload as { data?: unknown }, 'updateAgencyProspect', 'agencyProspect', 'agencyProspects') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PROSPECT_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-prospect-update',
  description: 'Update a Prospect',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/prospects/:id',
    httpMethod: 'PATCH',
    isAuthRequired: true,
  },
});
