import { RestApiClient } from 'twenty-client-sdk/rest';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { Response } from 'twenty-sdk/logic-function';

// The function runtime provides twenty-client-sdk via its own layer, so
// clients must be constructed lazily: the manifest builder imports these
// modules at build time outside the platform runtime, where the
// constructors are unavailable.
//
// NOTE: record access uses RestApiClient, not CoreApiClient. The runtime
// CoreApiClient schema only contains standard objects, so custom objects
// (agency*) fail validation there. REST endpoints are generated from the
// live workspace schema and serve every object.
let _rest: RestApiClient | null = null;
let _metadata: MetadataApiClient | null = null;
export function getRest(): RestApiClient {
  if (!_rest) _rest = new RestApiClient();
  return _rest;
}
export function getMetadataClient(): MetadataApiClient {
  if (!_metadata) _metadata = new MetadataApiClient();
  return _metadata;
}

export type RestListPayload<T> = {
  data?: Record<string, T[] | unknown> | null;
  totalCount?: number | null;
  pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null;
};

// Unwrap a REST list envelope { data: { <plural>: [...] }, totalCount }.
// The SDK returns the raw envelope; unwrapping lives here, in one place.
export function listRows<T>(payload: RestListPayload<T> | null | undefined, plural: string): T[] {
  const d = payload?.data;
  if (!d || typeof d !== 'object') return [];
  const v: unknown = (d as Record<string, unknown>)[plural];
  return Array.isArray(v) ? (v as T[]) : [];
}

// Unwrap a single-record envelope. REST get-one/create/update return the
// record NESTED under the object name: { data: { agencyPhone: {...} } }.
export function oneRow<T extends { id?: string }>(payload: { data?: unknown } | null | undefined, ...keys: string[]): T | null {
  const d = payload?.data as Record<string, unknown> | null | undefined;
  if (!d || typeof d !== 'object') return null;
  if ('id' in d) return d as unknown as T;
  for (const k of keys) {
    const v = d[k];
    if (v && typeof v === 'object' && 'id' in (v as Record<string, unknown>)) return v as T;
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null && 'id' in (v[0] as Record<string, unknown>)) return v[0] as T;
  }
  return null;
}

// Run a REST call, surfacing the upstream error body (validation messages)
// instead of a bare 500.
export async function rest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500;
    const body = e?.body;
    const messages = (body as any)?.messages ?? (body as any)?.message ?? e?.message ?? 'request failed';
    throw { statusCode: status, messages };
  }
}

export function restCatch(e: any): unknown {
  const status = typeof e?.statusCode === 'number' ? e.statusCode : typeof e?.status === 'number' ? e.status : 500;
  const body = e?.messages ?? e?.body ?? null;
  const message = typeof body === 'string' ? body : 'upstream error';
  const details = typeof body === 'string' ? undefined : body;
  return err(status, message, details ? { details } : undefined);
}

export function ok(data: unknown): unknown {
  return data;
}

export function err(status: number, message: string, extra?: Record<string, unknown>): unknown {
  return new Response(JSON.stringify({ error: message, ...(extra ?? {}) }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function routeBody(event: { body?: object | null }): Record<string, any> {
  const b = (event.body ?? {}) as Record<string, any>;
  if (b && typeof b === 'object' && 'data' in b && typeof b.data === 'object' && b.data !== null) {
    return b.data as Record<string, any>;
  }
  return b;
}

export function routeParam(event: { pathParameters?: Record<string, string | undefined> }, name: string): string | undefined {
  return event.pathParameters?.[name];
}

export function queryParam(event: { queryStringParameters?: Record<string, string | undefined> }, name: string): string | undefined {
  return event.queryStringParameters?.[name];
}

// Keep only writable fields so stray system keys never reach the API.
export function pick(data: Record<string, any>, allowed: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of allowed) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
}
