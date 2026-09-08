import { createLogger } from "./logger.js";

const log = createLogger('twenty-client');

/**
 * Core SDK Primitives & Interfaces matching Twenty's client contracts
 */
export interface TwentyPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface TwentyListResponse<T> {
  data: Record<string, T[]> | T[];
  totalCount?: number;
  pageInfo?: TwentyPageInfo;
}

export interface TwentyItemResponse<T> {
  data: Record<string, T> | T;
}

export interface TwentyRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TwentyQueryOptions {
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
  query?: Record<string, string>;
  filter?: string | Record<string, unknown>;
  [key: string]: unknown;
}

interface SyncConfig {
  twentyBaseUrl: string;
  twentyApiKey: string;
}

let config: SyncConfig | null = null;

export function loadSyncConfig(): SyncConfig {
  const baseUrl = process.env.TWENTY_BASE_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "TWENTY_BASE_URL and TWENTY_API_KEY environment variables are required"
    );
  }

  return {
    twentyBaseUrl: baseUrl.replace(/\/$/, ""),
    twentyApiKey: apiKey,
  };
}

function getConfig(): SyncConfig {
  if (!config) {
    config = loadSyncConfig();
  }
  return config;
}

/**
 * Converts kebab-case or snake_case string to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Infers singular object key name (e.g. agencyProspects -> agencyProspect)
 */
function toSingular(str: string): string {
  if (str.endsWith("ies")) return str.slice(0, -3) + "y";
  if (str.endsWith("s") && !str.endsWith("ss")) return str.slice(0, -1);
  return str;
}

/**
 * Converts string to PascalCase for mutation action matching
 */
function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Extracts an array of records from any Twenty response envelope:
 * - Direct array: T[]
 * - Standard REST: { data: { agencyProspects: T[] } }
 * - Double nested / SDK envelope: { data: { data: { agencyProspects: T[] } } }
 * - Direct data array: { data: T[] }
 * - Fallbacks: data.rows, data.edges (GraphQL)
 */
export function unwrapTwentyList<T>(payload: any, path: string): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const data = payload.data?.data ? payload.data.data : payload.data;
  if (!data) {
    if (Array.isArray(payload.rows)) return payload.rows;
    return [];
  }

  if (Array.isArray(data)) return data;

  const cleanPath = path.replace(/^\//, '').split('?')[0].split('/')[0];
  const objectName = toCamelCase(cleanPath);
  const singularName = toSingular(objectName);

  if (Array.isArray(data[objectName])) return data[objectName];
  if (Array.isArray(data[cleanPath])) return data[cleanPath];
  if (Array.isArray(data[singularName])) return data[singularName];
  if (Array.isArray(data.rows)) return data.rows;

  if (Array.isArray(data.edges)) {
    return data.edges
      .map((e: any) => e?.node)
      .filter((n: any): n is T => n !== undefined);
  }

  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }

  return [];
}

/**
 * Extracts a single record from Twenty CRM query or mutation envelopes.
 * Handles nested singular keys and mutation prefixes (create/update),
 * while maintaining a non-enumerable `.data` property for existing routes.
 */
export function unwrapTwentyItem<T>(payload: any, path: string): T {
  if (!payload) return payload;

  const data = payload.data?.data ? payload.data.data : (payload.data ?? payload);
  const cleanPath = path.replace(/^\//, '').split('?')[0].split('/')[0];
  const objectName = toCamelCase(cleanPath);
  const singularName = toSingular(objectName);
  const pascalSingular = toPascalCase(singularName);

  let record: any = null;

  if (data && typeof data === 'object') {
    if (data[singularName] && typeof data[singularName] === 'object') {
      record = data[singularName];
    } else if (data[objectName] && typeof data[objectName] === 'object' && !Array.isArray(data[objectName])) {
      record = data[objectName];
    } else if (data[`create${pascalSingular}`] && typeof data[`create${pascalSingular}`] === 'object') {
      record = data[`create${pascalSingular}`];
    } else if (data[`update${pascalSingular}`] && typeof data[`update${pascalSingular}`] === 'object') {
      record = data[`update${pascalSingular}`];
    } else if ('id' in data) {
      record = data;
    } else {
      for (const val of Object.values(data)) {
        if (val && typeof val === 'object' && 'id' in val) {
          record = val;
          break;
        }
      }
    }
  }

  const finalRecord = record || data || payload;

  if (finalRecord && typeof finalRecord === 'object' && !finalRecord.data) {
    Object.defineProperty(finalRecord, 'data', {
      value: finalRecord,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }

  return finalRecord as T;
}

/**
 * Fetch raw data from Twenty CRM REST or Metadata API
 */
export async function fetchTwenty<T>(path: string, options?: TwentyQueryOptions): Promise<T> {
  const cfg = getConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const basePath = cleanPath.startsWith("metadata") || cleanPath.startsWith("graphql")
    ? cleanPath
    : `rest/${cleanPath}`;

  const url = new URL(`${cfg.twentyBaseUrl}/${basePath}`);

  if (options?.limit !== undefined) {
    url.searchParams.set("limit", String(options.limit));
  }
  if (options?.startingAfter) {
    url.searchParams.set("startingAfter", options.startingAfter);
  }
  if (options?.endingBefore) {
    url.searchParams.set("endingBefore", options.endingBefore);
  }
  if (options?.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  log.info(`Fetching ${url.toString()}`);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${cfg.twentyApiKey}`,
      "Content-Type": "application/json",
    },
  });

  log.info(`Response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const text = await response.text();
    log.error(`Error body:`, text.substring(0, 500));
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  log.debug(`Response keys:`, Object.keys(json));

  return json as T;
}

/**
 * Create a record in Twenty CRM and return the normalized entity primitive
 */
export async function createTwenty<T = TwentyRecord>(path: string, data: any): Promise<T> {
  const cfg = getConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${cfg.twentyBaseUrl}/rest/${cleanPath}`;

  log.info(`Creating ${cleanPath}:`, JSON.stringify(data).substring(0, 200));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  log.info(`Create response: ${response.status}`);

  if (!response.ok) {
    const text = await response.text();
    log.error(`Create error:`, text.substring(0, 500));
    throw new Error(`Failed to create ${cleanPath}: ${response.status} - ${text}`);
  }

  const json = await response.json();
  return unwrapTwentyItem<T>(json, cleanPath);
}

/**
 * Update a record in Twenty CRM and return the normalized entity primitive
 */
export async function updateTwenty<T = TwentyRecord>(path: string, id: string, data: any): Promise<T> {
  const cfg = getConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${cfg.twentyBaseUrl}/rest/${cleanPath}/${encodeURIComponent(id)}`;

  log.info(`Updating ${cleanPath}/${id}:`, JSON.stringify(data).substring(0, 200));

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${cfg.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  log.info(`Update response: ${response.status}`);

  if (!response.ok) {
    const text = await response.text();
    log.error(`Update error:`, text.substring(0, 500));
    throw new Error(`Failed to update ${cleanPath}/${id}: ${response.status} - ${text}`);
  }

  const json = await response.json();
  return unwrapTwentyItem<T>(json, cleanPath);
}

/**
 * Execute a GraphQL mutation against Twenty's API (not metadata)
 */
export async function graphqlMutation<T>(mutation: string): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.twentyBaseUrl}/graphql`;

  log.info(`GraphQL mutation to ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: mutation }),
  });

  log.info(`GraphQL response: ${response.status}`);

  if (!response.ok) {
    const text = await response.text();
    log.error(`GraphQL error:`, text.substring(0, 500));
    throw new Error(`GraphQL error (${response.status}): ${text}`);
  }

  const json = await response.json();
  if (json.errors?.length > 0) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
}

/**
 * Update a record via GraphQL (supports relation fields with connect/disconnect)
 */
export async function updateTwentyGraphQL<T>(objectName: string, id: string, data: any): Promise<T> {
  const camelCaseName = objectName.charAt(0).toUpperCase() + objectName.slice(1);
  const setFields = Object.entries(data)
    .map(([key, value]) => `${key}: ${JSON.stringify(value).replace(/"/g, '\\"')}`)
    .join(", ");

  const mutation = `
    mutation {
      updateOne${camelCaseName}(input: {
        id: "${id}"
        ${setFields ? `data: { ${setFields} }` : ""}
      }) {
        id
      }
    }
  `;

  const result = await graphqlMutation<any>(mutation);
  log.info(`Updated ${objectName}/${id} via GraphQL`);
  return result as unknown as T;
}

/**
 * Delete a record from Twenty CRM
 */
export async function deleteTwenty(path: string, id: string): Promise<void> {
  const cfg = getConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${cfg.twentyBaseUrl}/rest/${cleanPath}/${encodeURIComponent(id)}`;

  log.info(`Deleting ${cleanPath}/${id}`);

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${cfg.twentyApiKey}`,
    },
  });

  log.info(`Delete response: ${response.status}`);

  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    log.error(`Delete error:`, text.substring(0, 500));
    throw new Error(`Failed to delete ${cleanPath}/${id}: ${response.status}`);
  }
}

/**
 * Get a single record from Twenty CRM
 */
export async function getTwenty<T = TwentyRecord>(path: string, id: string): Promise<T> {
  const cfg = getConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${cfg.twentyBaseUrl}/rest/${cleanPath}/${encodeURIComponent(id)}`;

  log.info(`Getting ${url}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.twentyApiKey}`,
      "Content-Type": "application/json",
    },
  });

  log.info(`Get response: ${response.status}`);

  if (!response.ok) {
    const text = await response.text();
    log.error(`Failed to get ${cleanPath}/${id}: ${response.status} - ${text}`);
    throw new Error(`Failed to get ${cleanPath}/${id}: ${response.status}`);
  }

  const json = await response.json();
  log.info(`Raw Twenty response: ${JSON.stringify(json).substring(0, 500)}`);
  return unwrapTwentyItem<T>(json, cleanPath);
}

/**
 * Get all records from a Twenty object with optional limit
 */
export async function listTwenty<T = TwentyRecord>(path: string, limitOrOptions: number | TwentyQueryOptions = 100): Promise<T[]> {
  const cfg = getConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  log.info(`Listing ${cleanPath}`);

  const query: Record<string, string> = {};

  if (typeof limitOrOptions === "number") {
    query.limit = String(limitOrOptions);
  } else if (limitOrOptions && typeof limitOrOptions === "object") {
    if (limitOrOptions.limit) {
      query.limit = String(limitOrOptions.limit);
    }
    if (limitOrOptions.filter) {
      query.filter = typeof limitOrOptions.filter === "string"
        ? limitOrOptions.filter
        : JSON.stringify(limitOrOptions.filter);
    }
    if (limitOrOptions.query) {
      Object.assign(query, limitOrOptions.query);
    }
  }

  const response = await fetchTwenty<{
    data?: {
      [key: string]: unknown;
      rows?: T[];
      edges?: { node?: T }[];
    };
    totalCount?: number;
    pageInfo?: unknown;
  }>(path, { query });

  const records = unwrapTwentyList<T>(response, cleanPath);
  log.info(`Found ${records.length} records in ${cleanPath}`);
  return records;
}

// Export a client object with all methods for convenience
export const twentyClient = {
  fetch: fetchTwenty,
  create: createTwenty,
  update: updateTwenty,
  delete: deleteTwenty,
  get: getTwenty,
  list: listTwenty,
  graphqlMutation,
  updateGraphQL: updateTwentyGraphQL,
  loadSyncConfig,
  unwrapList: unwrapTwentyList,
  unwrapItem: unwrapTwentyItem,
};
