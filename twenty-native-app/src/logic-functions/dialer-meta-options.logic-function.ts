import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';
import { getMetadataClient, ok, err, routeParam } from 'src/lib/dialer-client';
import { DIALER_META_OPTIONS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const handler = async (event: RoutePayload) => {
  const name = routeParam(event, 'object');
  if (!name) return err(400, 'object is required');
  const { objects } = await getMetadataClient().query({
    objects: { __args: { paging: { first: 200 }, filter: {} }, edges: { node: { nameSingular: true, namePlural: true, fields: { __args: { paging: { first: 200 }, filter: {} }, edges: { node: { name: true, type: true, options: true } } } } } },
  });
  const edges = (objects as { edges?: { node: any }[] } | null | undefined)?.edges ?? [];
  const obj = edges.map((e) => e.node).find((o: any) => o.nameSingular === name || o.namePlural === name);
  if (!obj) return err(404, 'unknown object: ' + name);
  const out: Record<string, { label: string; value: string; color?: string }[]> = {};
  for (const edge of (obj.fields?.edges ?? []) as { node: any }[]) {
    const f = edge.node;
    if (Array.isArray(f?.options) && f.options.length > 0) out[f.name] = f.options;
  }
  return ok(out);
};

export default defineLogicFunction({
  universalIdentifier: DIALER_META_OPTIONS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'dialer-meta-options',
  description: 'SELECT options for an object, keyed by field name',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/dialer/meta/:object',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
