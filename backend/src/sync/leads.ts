import type { SyncConfig } from "./config.js"

type AgencyLeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "CONVERTED" | "LOST"

// Map OCD statuses to Twenty's built-in status field (for backward compatibility)
const OCD_STATUS_MAP: Record<string, AgencyLeadStatus> = {
  new: "NEW",
  contacted: "CONTACTED",
  interested: "QUALIFIED",
  callback: "BOOKED",
  converted: "CONVERTED",
  not_interested: "LOST",
  do_not_contact: "LOST",
}

// Map Twenty's built-in status back to OCD
const STATUS_REVERSE_MAP: Record<AgencyLeadStatus, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "interested",
  BOOKED: "callback",
  CONVERTED: "converted",
  LOST: "not_interested",
}

// Map OCD statuses to custom coldCallStatus field (UPPER_CASE)
const OCD_STATUS_TO_COLD_CALL: Record<string, string> = {
  "new": "NEW",
  "contacted": "CONTACTED",
  "interested": "INTERESTED",
  "not_interested": "NOT_INTERESTED",
  "callback": "CALLBACK",
  "converted": "CONVERTED",
  "do_not_contact": "DO_NOT_CONTACT",
}

// Map custom coldCallStatus back to OCD
const COLD_CALL_STATUS_TO_OCD: Record<string, string> = {
  "NEW": "new",
  "CONTACTED": "contacted",
  "INTERESTED": "interested",
  "NOT_INTERESTED": "not_interested",
  "CALLBACK": "callback",
  "CONVERTED": "converted",
  "DO_NOT_CONTACT": "do_not_contact",
}

interface AgencyLeadWrite {
  contactName?: string
  email?: string
  phone?: {
    primaryPhoneNumber: string
    primaryPhoneCountryCode: string
    primaryPhoneCallingCode: string
    additionalPhones: unknown[]
  }
  source?: string
  status?: AgencyLeadStatus
  coldCallStatus?: string
  note?: string
  outboundMessage?: string
  replyAt?: string
  agencyProspectId?: string
  /** Twenty user id of the member who created/owns this record. */
  createdById?: string
}

interface AgencyLeadRow extends AgencyLeadWrite {
  id: string
  name?: string
  coldCallStatus?: string
}

export async function ensureAgencyLeadObject(config: SyncConfig): Promise<void> {
  // This is a no-op since Twenty already has the agencyLeads object.
  // Future: could use the ui-kit ensureAgencyLeadObject if needed.
}

export async function listAgencyLeads(config: SyncConfig): Promise<AgencyLeadRow[]> {
  const res = await fetch(`${config.twentyBaseUrl}/agencyLeads?limit=200`, {
    headers: { Authorization: `Bearer ${config.twentyApiKey}` },
  })
  if (!res.ok) throw new Error(`Failed to list agencyLeads: ${res.status}`)
  const json = await res.json()
  const data = (json as { data?: Record<string, unknown> })?.data
  const rows = data?.agencyLeads
  if (Array.isArray(rows)) return rows as AgencyLeadRow[]
  if (rows && typeof rows === "object" && Array.isArray((rows as { edges?: unknown[] }).edges)) {
    return ((rows as { edges: { node?: AgencyLeadRow }[] }).edges).map(e => e.node!).filter(Boolean)
  }
  return []
}

export function mapOcdLeadToAgencyLead(lead: {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  status?: string
  source?: string
  notes?: string
  dnc?: boolean
  sync_id?: string
  createdById?: string
}): AgencyLeadWrite {
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || undefined
  // Use the built-in status for backward compatibility with SMS pipeline
  const status = lead.dnc ? "LOST" : (OCD_STATUS_MAP[lead.status || ""] ?? "NEW")
  // Use custom coldCallStatus for cold calling workflow
  const coldCallStatus = OCD_STATUS_TO_COLD_CALL[lead.status || ""] || "NEW"
  const noteParts = [lead.company, lead.notes]
  if (lead.sync_id) noteParts.unshift(`sync_id:${lead.sync_id}`)
  return {
    contactName: fullName,
    email: lead.email,
    phone: lead.phone
      ? {
          primaryPhoneNumber: lead.phone.replace(/\D/g, ""),
          primaryPhoneCountryCode: "",
          primaryPhoneCallingCode: "",
          additionalPhones: [],
        }
      : undefined,
    source: lead.source,
    status,
    coldCallStatus,
    note: noteParts.length > 0 ? noteParts.join("\n") : undefined,
    outboundMessage: lead.sync_id, // Store sync_id here for lookup
    createdById: lead.createdById,
  }
}

export function mapAgencyLeadToOcd(lead: AgencyLeadRow): {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  status?: string
  source?: string
  notes?: string
  dnc?: boolean
  sync_id?: string
} {
  const name = lead.contactName || lead.name || ""
  const parts = name.split(" ")
  
  // Read from custom coldCallStatus first, fallback to built-in status
  let status = lead.coldCallStatus 
    ? COLD_CALL_STATUS_TO_OCD[lead.coldCallStatus] 
    : (lead.status ? STATUS_REVERSE_MAP[lead.status] : "new")
  
  return {
    first_name: parts[0] || undefined,
    last_name: parts.slice(1).join(" ") || undefined,
    email: lead.email,
    phone: lead.phone?.primaryPhoneNumber,
    status,
    source: lead.source,
    notes: lead.note,
    dnc: lead.coldCallStatus === "DO_NOT_CONTACT" || lead.status === "LOST",
    sync_id: lead.outboundMessage,
  }
}

export async function createAgencyLead(
  config: SyncConfig,
  payload: AgencyLeadWrite & { sync_id?: string },
): Promise<{ id: string; action: "created" | "updated" }> {
  const res = await fetch(`${config.twentyBaseUrl}/agencyLeads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create agencyLead: ${res.status}`)
  const json = await res.json()
  const id = (json as { data?: { id?: string } })?.data?.id
  return { id: id || "", action: "created" }
}

export async function updateAgencyLead(
  config: SyncConfig,
  id: string,
  payload: AgencyLeadWrite,
): Promise<void> {
  const res = await fetch(`${config.twentyBaseUrl}/agencyLeads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${config.twentyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to update agencyLead: ${res.status}`)
  }
}

export async function deleteAgencyLead(
  config: SyncConfig,
  id: string,
): Promise<void> {
  const res = await fetch(`${config.twentyBaseUrl}/agencyLeads/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.twentyApiKey}` },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete agencyLead: ${res.status}`)
  }
}

export async function findByEmail(
  config: SyncConfig,
  email: string,
): Promise<AgencyLeadRow | null> {
  const res = await fetch(
    `${config.twentyBaseUrl}/agencyLeads?limit=1&filter=emails.primaryEmail[eq]:${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${config.twentyApiKey}` } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const data = (json as { data?: Record<string, unknown> })?.data
  const rows = data?.agencyLeads
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0] as AgencyLeadRow
  }
  return null
}
