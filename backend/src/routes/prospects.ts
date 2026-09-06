import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/database.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { loadSyncConfig } from "../sync/config.js";
import { 
  createAgencyProspect, 
  updateAgencyProspect, 
  deleteAgencyProspect,
  mapOcdProspectToTwenty,
  AgencyProspect
} from "../sync/prospects.js";

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
  const rows = db.prepare("SELECT * FROM prospects ORDER BY created_at DESC").all();
  res.json(rows.map(mapProspect));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM prospects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }
  res.json(mapProspect(row));
});

router.post("/", async (req: AuthRequest, res) => {
  const id = uuid();
  const syncId = uuid();
  const now = new Date().toISOString();
  const {
    first_name, last_name, company, phone, email, website,
    address, city, state, zip, status, source, campaign_id,
    assigned_to, tags, notes, dnc,
  } = req.body;

  db.prepare(
    `INSERT INTO prospects (id, first_name, last_name, company, phone, email, website, address, city, state, zip, status, source, campaign_id, assigned_to, tags, notes, dnc, sync_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, first_name || null, last_name || null, company || null,
    phone || null, email || null, website || null, address || null,
    city || null, state || null, zip || null, status || "new",
    source || null, campaign_id || null, assigned_to || null,
    tags ? JSON.stringify(tags) : null, notes || null,
    dnc ? 1 : 0, syncId, now, now
  );

  const row = db.prepare("SELECT * FROM prospects WHERE id = ?").get(id) as any;
  const mapped = mapProspect(row);

  if (syncEnabled) {
    try {
      const config = loadSyncConfig();
      const twentyProspect = mapOcdProspectToTwenty(mapped);
      console.log("[sync] Syncing new prospect to Twenty:", JSON.stringify(twentyProspect, null, 2));
      await createAgencyProspect(config, { ...twentyProspect, sync_id: syncId });
    } catch (err) {
      console.error("[sync] failed to sync prospect create:", err);
    }
  }

  res.status(201).json(mapped);
});

router.patch("/:id", async (req, res) => {
  const existing = db.prepare("SELECT * FROM prospects WHERE id = ?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  const fields = [
    "first_name", "last_name", "company", "phone", "email", "website",
    "address", "city", "state", "zip", "status", "source", "campaign_id",
    "assigned_to", "tags", "notes", "dnc", "last_contacted_at", "contact_count",
  ];

  const updates: string[] = [];
  const values: any[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(field === "tags" ? JSON.stringify(req.body[field]) : req.body[field]);
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  updates.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(req.params.id);

  db.prepare(`UPDATE prospects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  const row = db.prepare("SELECT * FROM prospects WHERE id = ?").get(req.params.id) as any;
  const mapped = mapProspect(row);

  if (syncEnabled && existing.sync_id) {
    try {
      const config = loadSyncConfig();
      const twentyUpdates = mapOcdProspectToTwenty(mapped);
      console.log("[sync] Syncing prospect update to Twenty:", JSON.stringify({
        sync_id: existing.sync_id,
        updates: twentyUpdates,
      }, null, 2));
      await updateAgencyProspect(config, existing.sync_id, twentyUpdates);
    } catch (err) {
      console.error("[sync] failed to sync prospect update:", err);
    }
  }

  res.json(mapped);
});

router.delete("/:id", async (req, res) => {
  const existing = db.prepare("SELECT * FROM prospects WHERE id = ?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  const result = db.prepare("DELETE FROM prospects WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  if (syncEnabled && existing.sync_id) {
    try {
      const config = loadSyncConfig();
      console.log("[sync] Deleting prospect from Twenty with sync_id:", existing.sync_id);
      await deleteAgencyProspect(config, existing.sync_id);
    } catch (err) {
      console.error("[sync] failed to sync prospect delete:", err);
    }
  }

  res.status(204).end();
});

router.post("/import", async (req: AuthRequest, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "No rows to import" });
    return;
  }

  const insert = db.prepare(
    `INSERT INTO prospects (id, first_name, last_name, company, phone, email, website, address, city, state, zip, status, source, sync_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  );

  let count = 0;
  const importedSyncIds: string[] = [];

  const insertMany = db.transaction((items: any[]) => {
    let c = 0;
    for (const row of items) {
      try {
        const id = uuid();
        const syncId = uuid();
        insert.run(
          id,
          row.first_name || null,
          row.last_name || null,
          row.company || null,
          row.phone || null,
          row.email || null,
          row.website || null,
          row.address || null,
          row.city || null,
          row.state || null,
          row.zip || null,
          row.status || "new",
          row.source || "import",
          syncId,
        );
        importedSyncIds.push(syncId);
        c++;
      } catch {}
    }
    return c;
  });

  const imported = insertMany(rows);
  res.json({ imported, total: rows.length });

  if (syncEnabled && imported > 0) {
    try {
      const config = loadSyncConfig();
      const importedProspects = db.prepare("SELECT * FROM prospects WHERE sync_id IN (???)").all(importedSyncIds) as any[];
      for (const prospect of importedProspects) {
        const mapped = mapProspect(prospect);
        const twentyProspect = mapOcdProspectToTwenty(mapped);
        await createAgencyProspect(config, { ...twentyProspect, sync_id: mapped.sync_id });
      }
    } catch (err) {
      console.error("[sync] failed to sync imported prospects:", err);
    }
  }
});

function mapProspect(row: any) {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    company: row.company,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    status: row.status,
    source: row.source,
    campaign_id: row.campaign_id,
    assigned_to: row.assigned_to,
    tags: row.tags ? JSON.parse(row.tags) : null,
    notes: row.notes,
    dnc: Boolean(row.dnc),
    last_contacted_at: row.last_contacted_at,
    contact_count: row.contact_count,
    sync_id: row.sync_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export default router;
