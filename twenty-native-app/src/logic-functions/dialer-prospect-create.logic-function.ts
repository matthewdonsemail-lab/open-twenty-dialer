import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, restCatch, routeBody, pick } from 'src/lib/dialer-client';
import { DIALER_PROSPECT_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const data = pick(routeBody(event), ["name","phone","email","website","websiteUrl","slug","city","region","country","niche","rating","reviewCount","coldCallStatus","outboundState","outboundLabel","externalId","campaignIdId","fullAddress"]);
  try {
    const payload = await getRest().post('/rest/agencyProspects', data);
    return ok(oneRow(payload as { data?: unknown }, 'createAgencyProspect', 'agencyProspect', 'agencyProspects') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PROSPECT_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-prospect-create',
  description: 'Create a Prospect',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/prospects',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
