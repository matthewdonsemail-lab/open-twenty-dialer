import { createLogger } from "./logger.js";

const log = createLogger('twenty-client');

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
 * Fetch data from the Twenty CRM REST API
 */
export async function fetchTwenty<T>(path: string, options?: { query?: Record<string, string> }): Promise<T> {
  const cfg = getConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`${cfg.twentyBaseUrl}/rest/${cleanPath}`);

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
 * Create a record in Twenty CRM
 */
export async function createTwenty<T>(path: string, data: any): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.twentyBaseUrl}/rest/${path}`;

  log.info(`Creating ${path}:`, JSON.stringify(data).substring(0, 200));

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
    throw new Error(`Failed to create ${path}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Update a record in Twenty CRM
 */
export async function updateTwenty<T>(path: string, id: string, data: any): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.twentyBaseUrl}/rest/${path}/${encodeURIComponent(id)}`;

  log.info(`Updating ${path}/${id}:`, JSON.stringify(data).substring(0, 200));

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
    throw new Error(`Failed to update ${path}/${id}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Delete a record from Twenty CRM
 */
export async function deleteTwenty(path: string, id: string): Promise<void> {
  const cfg = getConfig();
  const url = `${cfg.twentyBaseUrl}/rest/${path}/${encodeURIComponent(id)}`;

  log.info(`Deleting ${path}/${id}`);

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
    throw new Error(`Failed to delete ${path}/${id}: ${response.status}`);
  }
}

/**
 * Get a single record from Twenty CRM
 */
export async function getTwenty<T>(path: string, id: string): Promise<T> {
  const cfg = getConfig();
  const url = `${cfg.twentyBaseUrl}/rest/${path}/${encodeURIComponent(id)}`;

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
    log.error(`Failed to get ${path}/${id}: ${response.status} - ${text}`);
    throw new Error(`Failed to get ${path}/${id}: ${response.status}`);
  }

  const json = await response.json();
  log.info(`Raw Twenty response: ${JSON.stringify(json).substring(0, 500)}`);

  // Twenty returns single records as { data: { agencyProspect: {...} } } — singular form
  const objectKey = path.replace(/^\//, '');
  if (json.data && json.data[objectKey]) {
    return json.data[objectKey] as T;
  }
  // Fallback: try singular form (Twenty uses singular for single record responses)
  const singularKey = objectKey.replace(/s$/, '');
  if (json.data && json.data[singularKey]) {
    return json.data[singularKey] as T;
  }

  // Fallback: return the full response if it's already the record
  return json as T;
}

/**
 * Get all records from a Twenty object with optional limit
 */
export async function listTwenty<T>(path: string, limit = 100): Promise<T[]> {
  const response = await fetchTwenty<{
    data?: {
      [key: string]: unknown;
      rows?: T[];
      edges?: { node?: T }[];
    };
    totalCount?: number;
    pageInfo?: unknown;
  }>(path, { query: { limit: String(limit) } });

  if (!response.data) {
    log.warn(`No data field in response for ${path}`);
    return [];
  }

  // Try nested by object name (e.g., data.agencyProspects)
  const objectName = path.replace(/^\//, '');
  let records = response.data[objectName] as T[] | undefined;

  // Fallback: try rows
  if (!records && Array.isArray(response.data.rows)) {
    records = response.data.rows;
  }

  // Fallback: try edges (GraphQL style)
  if (!records && Array.isArray(response.data.edges)) {
    records = response.data.edges
      .map((e) => e.node)
      .filter((n): n is T => n !== undefined);
  }

  if (Array.isArray(records)) {
    log.info(`Found ${records.length} records in ${path}`);
    return records;
  }

  log.warn(`No array found in response for ${path}`);
  return [];
}
