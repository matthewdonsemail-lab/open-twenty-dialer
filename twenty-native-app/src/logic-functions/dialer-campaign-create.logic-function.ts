import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, restCatch, routeBody, pick } from 'src/lib/dialer-client';
import { DIALER_CAMPAIGN_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const data = pick(routeBody(event), ["name","status","utmSource","urlKey","funnelBaseUrl","templateBaseUrl","industryId"]);
  try {
    const payload = await getRest().post('/rest/agencyCampaigns', data);
    return ok(oneRow(payload as { data?: unknown }, 'createAgencyCampaign', 'agencyCampaign', 'agencyCampaigns') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_CAMPAIGN_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-campaign-create',
  description: 'Create a Campaign',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/campaigns',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
