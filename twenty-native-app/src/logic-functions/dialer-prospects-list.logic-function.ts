import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getRest, listRows, ok, queryParam } from 'src/lib/dialer-client';
import { DIALER_PROSPECTS_LIST_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const limit = Math.min(Math.max(parseInt(queryParam(event, 'limit') ?? '200', 10) || 200, 1), 200);
  const after = queryParam(event, 'startingAfter') ?? undefined;
  const filter = queryParam(event, 'filter') ?? undefined;
  const orderBy = queryParam(event, 'orderBy') ?? 'id[AscNullsFirst]';
  const q: Record<string, string | number> = { limit, orderBy };
  if (after) {
    const keyset = 'id[gt]:' + JSON.stringify(after);
    q.filter = filter ? '(' + filter + ') AND ' + keyset : keyset;
  } else if (filter) q.filter = filter;
  const payload = (await getRest().get('/rest/agencyProspects', { query: q })) as { data?: Record<string, unknown[]>; totalCount?: number };
  const records = listRows(payload, 'agencyProspects');
  const last = records[records.length - 1] as { id?: string } | undefined;
  return ok({ records, totalCount: payload?.totalCount ?? records.length, pageInfo: { hasNextPage: records.length >= limit, endCursor: last?.id ?? null } });
};

export default defineLogicFunction({
  universalIdentifier: DIALER_PROSPECTS_LIST_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-prospects-list',
  description: 'List Prospects (limit/filter/startingAfter keyset)',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/prospects',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
