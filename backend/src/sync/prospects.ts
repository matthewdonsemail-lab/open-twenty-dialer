import type { SyncConfig } from "./config.js"
import db from "../db/database.js"
import { v4 as uuid } from "uuid"

const OBJECT_NAME = "agencyProspects"

// Matches ui-kit/lib/template-sites/schema.ts AgencyProspect type
export interface AgencyProspect {
  id?: string
  slug: string
  name: string
  phone: string
  fullAddress: string
  city: string
  region: string
  country: string
  niche: string
  website: string
  rating: number
  reviewCount: number
  email?: string
  externalId?: string // Used to store sync_id for linking
  outboundState?: string
  outboundLabel?: string
  coldCallStatus?: string // New field for cold calling workflow
}

// Map OCD status values to Twenty SELECT field values (UPPER_CASE)
const OCD_STATUS_TO_TWENTY: Record<string, string> = {
  "new": "NEW",
  "contacted": "CONTACTED",
  "interested": "INTERESTED",
  "not_interested": "NOT_INTERESTED",
  "callback": "CALLBACK",
  "converted": "CONVERTED",
  "do_not_contact": "DO_NOT_CONTACT",
}

// Map Twenty SELECT field values back to OCD status
const TWENTY_STATUS_TO_OCD: Record<string, string> = {
  "NEW": "new",
  "CONTACTED": "contacted",
  "INTERESTED": "interested",
  "NOT_INTERESTED": "not_interested",
  "CALLBACK": "callback",
  "CONVERTED": "converted",
  "DO_NOT_CONTACT": "do_not_contact",
}

export function mapOcdProspectToTwenty(prospect: any): AgencyProspect {
  // Parse address components
  const addressParts = (prospect.address || "").split(",").map(p => p.trim())
  const street = addressParts[0] || ""
  const city = prospect.city || addressParts[1] || ""
  const state = prospect.state || addressParts[2] || ""
  const zip = prospect.zip || addressParts[3] || ""
  const country = "US" // Default to US, could be configurable
  
  // Generate slug from name + city
  const slug = `${prospect.first_name || ''} ${prospect.last_name || ''} ${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
  
  return {
    id: prospect.id,
    slug: slug || `prospect-${prospect.id?.slice(-8) || Date.now()}`,
    name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || prospect.company || "Unknown Prospect",
    phone: prospect.phone || "",
    fullAddress: [street, city, state, zip].filter(Boolean).join(", "),
    city: city || "Unknown City",
    region: state || "Unknown State",
    country: country,
    niche: prospect.source || "general",
    website: prospect.website || "",
    rating: 0, // Default, can be enriched later
    reviewCount: 0,
    email: prospect.email,
    externalId: prospect.sync_id, // Store sync_id here for linking
    coldCallStatus: OCD_STATUS_TO_TWENTY[prospect.status] || "NEW",
  }
}

export function mapTwentyToOcdProspect(prospect: AgencyProspect, syncId?: string) {
  // Parse name into first and last
  const nameParts = prospect.name.split(" ")
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""
  
  // Parse address
  const addressParts = (prospect.fullAddress || "").split(",")
  const address = addressParts[0] || ""
  const city = addressParts[1] || prospect.city || ""
  const state = addressParts[2] || prospect.region || ""
  const zip = addressParts[3] || ""
  
  return {
    first_name: firstName,
    last_name: lastName,
    company: "", // Not in prospect schema
    phone: prospect.phone,
    email: prospect.email,
    website: prospect.website,
    address: address,
    city: city,
    state: state,
    zip: zip,
    status: TWENTY_STATUS_TO_OCD[prospect.coldCallStatus] || "new",
    source: prospect.niche,
    assigned_to: null,
    tags: null,
    notes: null,
    dnc: prospect.outboundLabel === "DO_NOT_CONTACT",
    last_contacted_at: null,
    contact_count: 0,
    sync_id: syncId || prospect.externalId || null,
  }
}

export async function listAgencyProspects(config: SyncConfig): Promise<AgencyProspect[]> {
  const url = `${config.twentyBaseUrl}/${OBJECT_NAME}?limit=100`
  console.log("[sync] Querying Twenty:", url)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.twentyApiKey}` },
  })
  const text = await response.text()
  console.log("[sync] Twenty response status:", response.status)
  console.log("[sync] Twenty response body:", text)
  
  if (!response.ok) throw new Error(`Failed to list ${OBJECT_NAME}: ${response.status} ${text}`)
  const json = JSON.parse(text)
  
  // Twenty paginated response: { data: { agencyProspects: [...] }, totalCount, pageInfo }
  const raw = json.data?.[OBJECT_NAME] || json.data?.rows || json.data || []
  const rows = Array.isArray(raw) ? raw : []
  console.log("[sync] agencyProspects count:", rows.length)
  return rows
}

export async function createAgencyProspect(config: SyncConfig, prospect: AgencyProspect & { sync_id: string }): Promise<void> {
  const payload = {
    slug: prospect.slug,
    name: prospect.name,
    phone: prospect.phone,
    fullAddress: prospect.fullAddress,
    city: prospect.city,
    region: prospect.region,
    country: prospect.country,
    niche: prospect.niche,
    website: prospect.website,
    rating: prospect.rating,
    reviewCount: prospect.reviewCount,
    email: prospect.email,
    externalId: prospect.sync_id, // Link to OCD record
    outboundState: prospect.outboundState,
    coldCallStatus: prospect.coldCallStatus,
  }
  console.log("[sync] Creating prospect in Twenty:", JSON.stringify(payload, null, 2))
  
  const response = await fetch(`${config.twentyBaseUrl}/${OBJECT_NAME}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error("[sync] Failed to create prospect in Twenty:", errorText)
    throw new Error(`Failed to create ${OBJECT_NAME}: ${response.status} ${errorText}`)
  }
}

export async function updateAgencyProspect(config: SyncConfig, syncId: string, updates: Partial<AgencyProspect>): Promise<void> {
  // Find prospect by externalId (which stores sync_id)
  const prospects = await listAgencyProspects(config)
  const target = prospects.find(p => p.externalId === syncId)
  
  if (!target) {
    throw new Error(`Prospect not found in Twenty with sync_id: ${syncId}`)
  }

  const payload: Record<string, any> = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.phone !== undefined) payload.phone = updates.phone
  if (updates.fullAddress !== undefined) payload.fullAddress = updates.fullAddress
  if (updates.city !== undefined) payload.city = updates.city
  if (updates.region !== undefined) payload.region = updates.region
  if (updates.country !== undefined) payload.country = updates.country
  if (updates.niche !== undefined) payload.niche = updates.niche
  if (updates.website !== undefined) payload.website = updates.website
  if (updates.rating !== undefined) payload.rating = updates.rating
  if (updates.reviewCount !== undefined) payload.reviewCount = updates.reviewCount
  if (updates.email !== undefined) payload.email = updates.email
  if (updates.outboundState !== undefined) payload.outboundState = updates.outboundState
  if (updates.outboundLabel !== undefined) payload.outboundLabel = updates.outboundLabel
  if (updates.coldCallStatus !== undefined) payload.coldCallStatus = updates.coldCallStatus

  console.log("[sync] Updating prospect in Twenty:", JSON.stringify({ 
    twentyId: target.id, 
    syncId,
    payload 
  }, null, 2))

  const response = await fetch(`${config.twentyBaseUrl}/${OBJECT_NAME}/${target.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${config.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error("[sync] Failed to update prospect:", errorText)
    throw new Error(`Failed to update ${OBJECT_NAME}: ${response.status} ${errorText}`)
  }
}

export async function deleteAgencyProspect(config: SyncConfig, syncId: string): Promise<void> {
  // Find prospect by externalId
  const prospects = await listAgencyProspects(config)
  const target = prospects.find(p => p.externalId === syncId)
  
  if (!target) {
    console.warn("[sync] Could not find prospect to delete with sync_id:", syncId)
    return
  }

  console.log("[sync] Deleting prospect from Twenty:", target.id, "sync_id:", syncId)
  const response = await fetch(`${config.twentyBaseUrl}/${OBJECT_NAME}/${target.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.twentyApiKey}` },
  })
  if (!response.ok && response.status !== 204) {
    const errorText = await response.text()
    console.error("[sync] Failed to delete prospect:", errorText)
    throw new Error(`Failed to delete ${OBJECT_NAME}: ${response.status} ${errorText}`)
  }
}

export async function ensureAgencyProspectObject(config: SyncConfig): Promise<void> {
  try {
    await listAgencyProspects(config)
    console.log("[sync] agencyProspects object is available")
  } catch (err) {
    console.warn("[sync] agencyProspects object not found in Twenty:", err)
  }
}

export function findOcdProspectBySyncId(syncId: string): { id: string } | null {
  const row = db.prepare("SELECT id FROM prospects WHERE sync_id = ?").get(syncId) as { id: string } | undefined
  return row || null
}

export function findOcdProspectByEmail(email: string): { id: string } | null {
  if (!email) return null
  const row = db.prepare("SELECT id FROM prospects WHERE email = ?").get(email) as { id: string } | undefined
  return row || null
}
