import { config } from "dotenv"

// Load .env.local if not already loaded
config({ path: ".env.local" })

export interface SyncConfig {
  twentyBaseUrl: string
  twentyApiKey: string
  syncPollIntervalMs: number
}

export function loadSyncConfig(): SyncConfig {
  const baseUrl = process.env.TWENTY_BASE_URL
  const apiKey = process.env.TWENTY_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error(
      "TWENTY_BASE_URL and TWENTY_API_KEY environment variables are required for sync",
    )
  }

  return {
    twentyBaseUrl: baseUrl.replace(/\/$/, ""),
    twentyApiKey: apiKey,
    syncPollIntervalMs: parseInt(process.env.SYNC_POLL_INTERVAL_MS || "30000", 10),
  }
}
