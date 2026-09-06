import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/database.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { loadSyncConfig } from "../sync/config.js";
import { mapOcdCampaignToAgencyCampaign, createAgencyCampaign, updateAgencyCampaign, deleteAgencyCampaign } from "../sync/campaigns.js";

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
  const rows = db.prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all();
  res.json(rows.map(mapCampaign));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(mapCampaign(row));
});

router.post("/", async (req: AuthRequest, res) => {
  const id = uuid();
  const syncId = uuid();
  const now = new Date().toISOString();
  const { name, type, status, settings } = req.body;

  db.prepare(
    `INSERT INTO campaigns (id, name, type, status, settings, created_by, sync_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    type || "outbound",
    status || "active",
    settings ? JSON.stringify(settings) : null,
    req.userId || null,
    syncId,
    now,
    now
  );

  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as any;
  const mapped = mapCampaign(row);

  if (syncEnabled) {
    try {
      const config = loadSyncConfig();
      await createAgencyCampaign(config, { ...mapOcdCampaignToAgencyCampaign(mapped), sync_id: syncId });
    } catch (err) {
      console.error("[sync] failed to sync campaign create:", err);
    }
  }

  res.status(201).json(mapped);
});

router.patch("/:id", async (req, res) => {
  const existing = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const { name, type, status, settings } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (type !== undefined) { updates.push("type = ?"); values.push(type); }
  if (status !== undefined) { updates.push("status = ?"); values.push(status); }
  if (settings !== undefined) { updates.push("settings = ?"); values.push(JSON.stringify(settings)); }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  updates.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(req.params.id);

  db.prepare(`UPDATE campaigns SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id) as any;
  const mapped = mapCampaign(row);

  if (syncEnabled && existing.sync_id) {
    try {
      const config = loadSyncConfig();
      await updateAgencyCampaign(config, existing.sync_id, mapOcdCampaignToAgencyCampaign(mapped));
    } catch (err) {
      console.error("[sync] failed to sync campaign update:", err);
    }
  }

  res.json(mapped);
});

router.delete("/:id", async (req, res) => {
  const existing = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const result = db.prepare("DELETE FROM campaigns WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (syncEnabled && existing.sync_id) {
    try {
      const config = loadSyncConfig();
      await deleteAgencyCampaign(config, existing.sync_id);
    } catch (err) {
      console.error("[sync] failed to sync campaign delete:", err);
    }
  }

  res.status(204).end();
});

function mapCampaign(row: any) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    settings: row.settings ? JSON.parse(row.settings) : null,
    created_by: row.created_by,
    sync_id: row.sync_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default router;