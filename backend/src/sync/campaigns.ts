import type { SyncConfig } from "./config.js"

type AgencyCampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED"

const OCD_STATUS_MAP: Record<string, AgencyCampaignStatus> = {
  active: "ACTIVE",
  paused: "PAUSED",
  completed: "PAUSED",
}

const STATUS_REVERSE_MAP: Record<AgencyCampaignStatus, string> = {
  DRAFT: "active",
  ACTIVE: "active",
  PAUSED: "paused",
}

interface AgencyCampaignWrite {
  name?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  industryId?: string
  copyTemplate?: string
  status?: AgencyCampaignStatus
  note?: string
  sync_id?: string
}

interface AgencyCampaignRow extends AgencyCampaignWrite {
  id: string
}

export async function ensureAgencyCampaignObject(config: SyncConfig): Promise<void> {
  // agencyCampaigns object may not exist in Twenty yet; this is a no-op placeholder.
  // Future: could create it via Twenty metadata API if needed.
}

export function mapOcdCampaignToAgencyCampaign(
  campaign: {
    id: string
    name?: string
    type?: string
    status?: string
    settings?: unknown
    sync_id?: string
  },
): AgencyCampaignWrite {
  return {
    name: campaign.name,
    utmSource: campaign.type === "inbound" ? "inbound" : campaign.type === "blended" ? "blended" : "outbound",
    status: OCD_STATUS_MAP[campaign.status || ""] ?? "ACTIVE",
    note: campaign.settings ? JSON.stringify(campaign.settings) : undefined,
    sync_id: campaign.sync_id,
  }
}

export function mapAgencyCampaignToOcd(
  campaign: AgencyCampaignRow,
): {
  name?: string
  type?: string
  status?: string
  settings?: unknown
} {
  const typeMap: Record<string, string> = {
    outbound: "outbound",
    inbound: "inbound",
    blended: "blended",
  }
  return {
    name: campaign.name,
    type: typeMap[campaign.utmSource || ""] || "outbound",
    status: STATUS_REVERSE_MAP[campaign.status || "ACTIVE"],
    settings: campaign.note ? JSON.parse(campaign.note) : undefined,
  }
}

export async function createAgencyCampaign(
  config: SyncConfig,
  payload: AgencyCampaignWrite & { sync_id?: string },
): Promise<{ id: string; action: "created" | "updated" }> {
  const res = await fetch(`${config.twentyBaseUrl}/agencyCampaigns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create agencyCampaign: ${res.status}`)
  const json = await res.json()
  const id = (json as { data?: { id?: string } })?.data?.id
  return { id: id || "", action: "created" }
}

export async function updateAgencyCampaign(
  config: SyncConfig,
  id: string,
  payload: AgencyCampaignWrite,
): Promise<void> {
  const res = await fetch(`${config.twentyBaseUrl}/agencyCampaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${config.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to update agencyCampaign: ${res.status}`)
  }
}

export async function deleteAgencyCampaign(
  config: SyncConfig,
  id: string,
): Promise<void> {
  const res = await fetch(`${config.twentyBaseUrl}/agencyCampaigns/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.twentyApiKey}` },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete agencyCampaign: ${res.status}`)
  }
}
