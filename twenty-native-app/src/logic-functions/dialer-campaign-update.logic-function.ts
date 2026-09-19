import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, oneRow, ok, err, restCatch, routeBody, routeParam, pick } from 'src/lib/dialer-client';
import { DIALER_CAMPAIGN_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const id = routeParam(event, 'id');
  if (!id) return err(400, 'id is required');
  const data = pick(routeBody(event), ["name","status","utmSource","urlKey","funnelBaseUrl","templateBaseUrl","industryId"]);
  try {
    const payload = await getRest().patch('/rest/agencyCampaigns/' + id, data);
    return ok(oneRow(payload as { data?: unknown }, 'updateAgencyCampaign', 'agencyCampaign', 'agencyCampaigns') ?? payload);
  } catch (e2: any) {
    return restCatch(e2);
  }
};

export default defineLogicFunction({
  universalIdentifier: DIALER_CAMPAIGN_UPDATE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-campaign-update',
  description: 'Update a Campaign',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/campaigns/:id',
    httpMethod: 'PATCH',
    isAuthRequired: true,
  },
});
