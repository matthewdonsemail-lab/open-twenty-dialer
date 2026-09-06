import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/database.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { loadSyncConfig } from "../sync/config.js";
import { syncCallLog } from "../sync/callLogs.js";
import { getTwentyLeadIdByOcdId } from "../sync/callLogs.js";

const router = Router();
router.use(authMiddleware);

let syncEnabled = false;
try {
  if (process.env.TWENTY_BASE_URL && process.env.TWENTY_API_KEY) {
    loadSyncConfig();
    syncEnabled = true;
  }
} catch {}

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM call_logs ORDER BY created_at DESC").all();
  res.json(rows.map(mapCallLog));
});

router.get("/lead/:leadId", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM call_logs WHERE lead_id = ? ORDER BY created_at DESC"
  ).all(req.params.leadId);
  res.json(rows.map(mapCallLog));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM call_logs WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Call log not found" });
    return;
  }
  res.json(mapCallLog(row));
});

router.post("/", async (req: AuthRequest, res) => {
  const id = uuid();
  const syncId = uuid();
  const {
    lead_id, user_id, campaign_id, direction, outcome,
    duration_seconds, recording_url, notes, transcript,
    sip_call_id, started_at, ended_at,
  } = req.body;

  db.prepare(
    `INSERT INTO call_logs (id, lead_id, user_id, campaign_id, direction, outcome, duration_seconds, recording_url, notes, transcript, sip_call_id, started_at, ended_at, sync_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    lead_id || null,
    user_id || req.userId || null,
    campaign_id || null,
    direction || "outbound",
    outcome || "no_answer",
    duration_seconds || 0,
    recording_url || null,
    notes || null,
    transcript || null,
    sip_call_id || null,
    started_at || null,
    ended_at || null,
    syncId
  );

  // Update lead call count and last called
  if (lead_id) {
    db.prepare(
      "UPDATE leads SET last_called_at = datetime('now'), call_count = call_count + 1 WHERE id = ?"
    ).run(lead_id);
  }

  const row = db.prepare("SELECT * FROM call_logs WHERE id = ?").get(id) as any;
  const mapped = mapCallLog(row);

  if (syncEnabled && lead_id) {
    try {
      const config = loadSyncConfig();
      // Get the lead's sync_id to find the corresponding Twenty lead
      const lead = db.prepare("SELECT sync_id FROM leads WHERE id = ?").get(lead_id) as any;
      if (lead?.sync_id) {
        const twentyLeadId = await getTwentyLeadIdByOcdId(config, lead.sync_id);
        if (twentyLeadId) {
          await syncCallLog(config, { ...mapped, twentyLeadId });
        }
      }
    } catch (err) {
      console.error("[sync] failed to sync call log:", err);
    }
  }

  res.status(201).json(mapped);
});

router.delete("/:id", async (req, res) => {
  const existing = db.prepare("SELECT * FROM call_logs WHERE id = ?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Call log not found" });
    return;
  }

  const result = db.prepare("DELETE FROM call_logs WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Call log not found" });
    return;
  }

  if (syncEnabled && existing.sync_id) {
    try {
      const config = loadSyncConfig();
      // Note: sync deletion is a no-op since call logs don't have direct Twenty equivalent
      console.log("[sync] call log deleted (no Twenty equivalent to delete)");
    } catch (err) {
      console.error("[sync] failed to sync call log delete:", err);
    }
  }

  res.status(204).end();
});

function mapCallLog(row: any) {
  return {
    id: row.id,
    lead_id: row.lead_id,
    user_id: row.user_id,
    campaign_id: row.campaign_id,
    direction: row.direction,
    outcome: row.outcome,
    duration_seconds: row.duration_seconds,
    recording_url: row.recording_url,
    notes: row.notes,
    transcript: row.transcript,
    sip_call_id: row.sip_call_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    sync_id: row.sync_id,
    created_at: row.created_at,
  };
}

export default router;