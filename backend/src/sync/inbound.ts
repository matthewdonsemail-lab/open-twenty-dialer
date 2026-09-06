import type { SyncConfig } from "./config.js"
import db from "../db/database.js"
import { listAgencyLeads, mapAgencyLeadToOcd } from "./leads.js"
import { listAgencyProspects, mapTwentyToOcdProspect } from "./prospects.js"
import { v4 as uuid } from "uuid"

export interface InboundSyncResult {
  created: number
  updated: number
  errors: string[]
}

export async function pollLeads(
  config: SyncConfig,
  lastSyncAt: string | null,
): Promise<InboundSyncResult> {
  const rows = await listAgencyLeads(config)
  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const twentyId = row.id
      const twentyUpdatedAt = (row as any).updated_at || (row as any).updatedAt
      
      // Skip if older than last sync
      if (lastSyncAt && twentyUpdatedAt && twentyUpdatedAt <= lastSyncAt) continue

      // Extract sync_id from outboundMessage if present
      const syncId = (row as any).outboundMessage
      const email = (row as any).email as string | undefined

      // Find existing lead by sync_id or email
      let existingLead: { id: string; sync_id?: string } | undefined
      if (syncId) {
        existingLead = db.prepare("SELECT id, sync_id FROM leads WHERE sync_id = ?").get(syncId) as any
      }
      if (!existingLead && email) {
        existingLead = db.prepare("SELECT id, sync_id FROM leads WHERE email = ?").get(email) as any
      }

      if (existingLead) {
        // Update existing lead
        const mapped = mapAgencyLeadToOcd(row as any)
        const now = new Date().toISOString()
        
        db.prepare(`
          UPDATE leads SET 
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            status = COALESCE(?, status),
            notes = COALESCE(?, notes),
            dnc = CASE WHEN ? = 1 THEN 1 ELSE dnc END,
            updated_at = ?
          WHERE id = ?
        `).run(
          mapped.first_name || null,
          mapped.last_name || null,
          mapped.email || null,
          mapped.phone || null,
          mapped.status || null,
          mapped.notes || null,
          mapped.dnc ? 1 : 0,
          now,
          existingLead.id
        )
        updated++
      } else {
        // Create new lead
        const leadId = uuid()
        const leadSyncId = syncId || uuid()
        const mapped = mapAgencyLeadToOcd(row as any)
        const now = new Date().toISOString()

        db.prepare(`
          INSERT INTO leads (id, first_name, last_name, email, phone, status, notes, dnc, sync_id, source, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'twenty-import', ?, ?)
        `).run(
          leadId,
          mapped.first_name || null,
          mapped.last_name || null,
          mapped.email || null,
          mapped.phone || null,
          mapped.status || "new",
          mapped.notes || null,
          mapped.dnc ? 1 : 0,
          leadSyncId,
          now,
          now
        )
        created++
      }
    } catch (err) {
      errors.push(`Lead ${row.id}: ${err}`)
    }
  }

  return { created, updated, errors }
}

export async function pollProspects(
  config: SyncConfig,
  lastSyncAt: string | null,
): Promise<InboundSyncResult> {
  console.log("[sync] Starting prospect poll, lastSyncAt:", lastSyncAt)
  const rows = await listAgencyProspects(config)
  console.log("[sync] Prospects to process:", JSON.stringify(rows, null, 2))
  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const twentyId = row.id
      const twentyUpdatedAt = (row as any).updated_at || (row as any).updatedAt
      
      // Skip if older than last sync
      if (lastSyncAt && twentyUpdatedAt && twentyUpdatedAt <= lastSyncAt) {
        console.log("[sync] Skipping old prospect:", twentyId)
        continue
      }

      // Extract sync_id from externalId field
      const syncId = (row as any).externalId || null
      const email = (row as any).email as string | undefined
      
      console.log("[sync] Processing prospect:", JSON.stringify({
        id: twentyId,
        name: row.name,
        email,
        syncId,
        lastSyncAt,
        updatedAt: twentyUpdatedAt,
        slug: row.slug,
      }, null, 2))

      // Find existing prospect by sync_id or email
      let existingProspect: { id: string; sync_id?: string } | undefined
      if (syncId) {
        existingProspect = db.prepare("SELECT id, sync_id FROM prospects WHERE sync_id = ?").get(syncId) as any
        console.log("[sync] Found by sync_id:", existingProspect)
      }
      if (!existingProspect && email) {
        existingProspect = db.prepare("SELECT id, sync_id FROM prospects WHERE email = ?").get(email) as any
        console.log("[sync] Found by email:", existingProspect)
      }

      if (existingProspect) {
        // Update existing prospect
        const mapped = mapTwentyToOcdProspect(row as any, syncId)
        const now = new Date().toISOString()
        
        console.log("[sync] Updating prospect in DB:", JSON.stringify({
          id: existingProspect.id,
          mapped: mapped,
        }, null, 2))
        
        db.prepare(`
          UPDATE prospects SET 
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            website = COALESCE(?, website),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            zip = COALESCE(?, zip),
            status = COALESCE(?, status),
            source = COALESCE(?, source),
            notes = COALESCE(?, notes),
            dnc = CASE WHEN ? = 1 THEN 1 ELSE dnc END,
            updated_at = ?
          WHERE id = ?
        `).run(
          mapped.first_name || null,
          mapped.last_name || null,
          mapped.email || null,
          mapped.phone || null,
          mapped.website || null,
          mapped.address || null,
          mapped.city || null,
          mapped.state || null,
          mapped.zip || null,
          mapped.status || null,
          mapped.source || null,
          mapped.notes || null,
          mapped.dnc ? 1 : 0,
          now,
          existingProspect.id
        )
        updated++
      } else {
        // Create new prospect
        const prospectId = uuid()
        const prospectSyncId = syncId || uuid()
        const mapped = mapTwentyToOcdProspect(row as any, prospectSyncId)
        const now = new Date().toISOString()

        console.log("[sync] Creating new prospect in DB:", JSON.stringify({
          id: prospectId,
          mapped: mapped,
          syncId,
          prospectSyncId,
        }, null, 2))

        db.prepare(`
          INSERT INTO prospects (id, first_name, last_name, email, phone, website, address, city, state, zip, status, source, dnc, sync_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          prospectId,
          mapped.first_name || null,
          mapped.last_name || null,
          mapped.email || null,
          mapped.phone || null,
          mapped.website || null,
          mapped.address || null,
          mapped.city || null,
          mapped.state || null,
          mapped.zip || null,
          mapped.status || "new",
          mapped.source || "twenty-import",
          mapped.dnc ? 1 : 0,
          prospectSyncId,
          now,
          now
        )
        created++
      }
    } catch (err) {
      errors.push(`Prospect ${row.id}: ${err}`)
    }
  }

  return { created, updated, errors }
}

export async function pollCampaigns(
  config: SyncConfig,
  lastSyncAt: string | null,
): Promise<InboundSyncResult> {
  // agencyCampaigns polling — implement when object exists in Twenty
  return { created: 0, updated: 0, errors: [] }
}

export function findOcdLeadBySyncId(syncId: string): { id: string } | null {
  const row = db.prepare("SELECT id FROM leads WHERE sync_id = ?").get(syncId) as { id: string } | undefined
  return row || null
}

export function findOcdLeadByEmail(email: string): { id: string } | null {
  if (!email) return null
  const row = db.prepare("SELECT id FROM leads WHERE email = ?").get(email) as { id: string } | undefined
  return row || null
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
