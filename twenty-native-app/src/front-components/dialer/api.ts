import { RestApiClient } from 'twenty-client-sdk/rest';

// Lazy singleton: the manifest builder imports this module at build time
// outside the platform runtime, where the client constructor is unavailable.
let _client: RestApiClient | null = null;
function api(): RestApiClient {
  if (!_client) _client = new RestApiClient();
  return _client;
}

export interface Page<T> {
  records: T[];
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

async function get<T>(path: string, query?: Record<string, string | number>): Promise<T> {
  return (await api().get(path, query ? { query } : undefined)) as T;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return (await api().post(path, body)) as T;
}

async function patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return (await api().patch(path, body)) as T;
}

export async function listRecords<T>(kind: string, opts?: { limit?: number; startingAfter?: string; filter?: string }): Promise<Page<T>> {
  const query: Record<string, string | number> = { limit: opts?.limit ?? 100 };
  if (opts?.filter) query.filter = opts.filter;
  if (opts?.startingAfter) query.startingAfter = opts.startingAfter;
  const res = (await get<unknown>(`/s/dialer/${kind}`, query)) as Page<T>;
  return { records: res.records ?? [], totalCount: res.totalCount ?? 0, pageInfo: res.pageInfo ?? { hasNextPage: false, endCursor: null } };
}

export async function updateRecord<T>(kind: string, id: string, data: Record<string, unknown>): Promise<T> {
  return (await patch<T>(`/s/dialer/${kind}/${id}`, data)) as T;
}

export async function createRecord<T>(kind: string, data: Record<string, unknown>): Promise<T> {
  return (await post<T>(`/s/dialer/${kind}`, data)) as T;
}

export interface MetaOption {
  label: string;
  value: string;
  color?: string;
}

export async function metaOptions(object: string): Promise<Record<string, MetaOption[]>> {
  return (await get<Record<string, MetaOption[]>>(`/s/dialer/meta/${object}`)) as Record<string, MetaOption[]>;
}

export async function claimPhone(id: string, memberId: string): Promise<Record<string, any>> {
  return (await post<Record<string, any>>(`/s/dialer/phones/${id}/claim`, { memberId })) as Record<string, any>;
}

export async function releasePhone(id: string, memberId: string): Promise<Record<string, any>> {
  return (await post<Record<string, any>>(`/s/dialer/phones/${id}/release`, { memberId })) as Record<string, any>;
}
