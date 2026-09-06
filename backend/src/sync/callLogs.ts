import type { SyncConfig } from "./config.js"
import { listAgencyLeads, updateAgencyLead } from "./leads.js"

const OUTCOME_TO_STATUS: Record<string, string | null> = {
  answered: "CONTACTED",
  voicemail: "CONTACTED",
  no_answer: null,
  busy: null,
  dnc: "LOST",
  wrong_number: "LOST",
  disconnected: "LOST",
}

export interface CallLogSyncPayload {
  id: string
  lead_id?: string
  outcome?: string
  duration_seconds?: number
  notes?: string
  transcript?: string
  started_at?: string
  ended_at?: string
  twentyLeadId?: string
}

export async function syncCallLog(
  config: SyncConfig,
  callLog: CallLogSyncPayload,
): Promise<void> {
  if (!callLog.lead_id || !callLog.twentyLeadId) return

  // Apply status update based on outcome
  const newStatus = callLog.outcome ? OUTCOME_TO_STATUS[callLog.outcome] : null
  if (newStatus) {
    await updateAgencyLead(config, callLog.twentyLeadId, {
      status: newStatus as any,
    })
  }

  // Append call summary to note
  const summaryNote = `[${callLog.outcome}] ${callLog.duration_seconds ?? 0}s${
    callLog.started_at ? ` @ ${callLog.started_at}` : ""
  }${callLog.notes ? `\nNotes: ${callLog.notes}` : ""}`

  await updateAgencyLead(config, callLog.twentyLeadId, {
    note: summaryNote,
  })
}

export async function deleteCallLogSync(
  config: SyncConfig,
  id: string,
): Promise<void> {
  console.log(`[sync] call log delete: ${id} (no-op, no Twenty equivalent)`)
}

export async function getTwentyLeadIdByOcdId(
  config: SyncConfig,
  ocId: string,
): Promise<string | null> {
  const rows = await listAgencyLeads(config)
  for (const row of rows) {
    // Check if sync_id is stored in outboundMessage or note
    const outboundMsg = row.outboundMessage || ""
    const note = row.note || ""
    if (outboundMsg === ocId || note.includes(`sync_id:${ocId}`)) {
      return row.id
    }
  }
  return null
}
