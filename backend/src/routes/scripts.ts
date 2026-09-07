import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { listTwenty, createTwenty, updateTwenty, deleteTwenty, getTwenty } from "../lib/twenty-client.js";
import { createLogger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

const log = createLogger('scripts');

interface AgencyScript {
  id: string;
  name?: string;
  campaignId?: string; // The relation to agencyCampaign
  scriptData?: string; // JSON string containing script content
  createdAt?: string;
  updatedAt?: string;
}

interface ScriptListItem {
  id: string;
  name: string;
  campaignId: string | null;
  scriptData: any;
  created_at: string;
  updated_at: string;
}

router.get("/", async (_req, res) => {
  try {
    log.info('Listing scripts from Twenty CRM');
    const scripts = await listTwenty<AgencyScript>('agencyScripts', 100);
    
    const mapped: ScriptListItem[] = scripts.map(s => ({
      id: s.id,
      name: s.name || "Unnamed Script",
      campaignId: s.campaignId || null,
      scriptData: s.scriptData ? JSON.parse(s.scriptData) : null,
      created_at: s.createdAt || new Date().toISOString(),
      updated_at: s.updatedAt || new Date().toISOString(),
    }));

    log.info(`Returning ${mapped.length} scripts`);
    res.json(mapped);
  } catch (err: any) {
    log.error("Failed to list scripts:", err.message);
    res.status(500).json({ error: "Failed to fetch scripts from Twenty", details: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    log.info(`Getting script ${req.params.id}`);
    const id = req.params.id as string;
    const script = await getTwenty<AgencyScript>(`agencyScripts`, id);
    
    const mapped: ScriptListItem = {
      id: script.id,
      name: script.name || "Unnamed Script",
      campaignId: script.campaignId || null,
      scriptData: script.scriptData ? JSON.parse(script.scriptData) : null,
      created_at: script.createdAt || new Date().toISOString(),
      updated_at: script.updatedAt || new Date().toISOString(),
    };

    res.json(mapped);
  } catch (err: any) {
    log.error(`Failed to get script ${req.params.id}:`, err.message);
    res.status(404).json({ error: "Script not found" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, campaignId, scriptData } = req.body;

    log.info(`Creating script: ${name}`);

    const payload: any = {
      name: name || "New Script",
      scriptData: scriptData ? JSON.stringify(scriptData) : undefined,
    };

    if (campaignId) {
      payload.campaignId = campaignId;
    }

    const result = await createTwenty<any>('agencyScripts', payload);
    const script = result.data || result;
    
    const mapped: ScriptListItem = {
      id: script.id,
      name: script.name || "New Script",
      campaignId: script.campaignId || null,
      scriptData: script.scriptData ? JSON.parse(script.scriptData) : null,
      created_at: script.createdAt || new Date().toISOString(),
      updated_at: script.updatedAt || new Date().toISOString(),
    };

    log.info(`Created script ${script.id}`);
    res.status(201).json(mapped);
  } catch (err: any) {
    log.error("Failed to create script:", err.message);
    res.status(500).json({ error: "Failed to create script in Twenty", details: err.message });
  }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { name, campaignId, scriptData } = req.body;

    log.info(`Updating script ${req.params.id}`);
    const id = req.params.id as string;

    const payload: any = {};
    if (name !== undefined) payload.name = name;
    if (campaignId !== undefined) payload.campaignId = campaignId || null;
    if (scriptData !== undefined) payload.scriptData = JSON.stringify(scriptData);

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const result = await updateTwenty<any>('agencyScripts', id, payload);
    const script = result.data || result;
    
    const mapped: ScriptListItem = {
      id: script.id,
      name: script.name || "Unnamed Script",
      campaignId: script.campaignId || null,
      scriptData: script.scriptData ? JSON.parse(script.scriptData) : null,
      created_at: script.createdAt || new Date().toISOString(),
      updated_at: script.updatedAt || new Date().toISOString(),
    };

    log.info(`Updated script ${script.id}`);
    res.json(mapped);
  } catch (err: any) {
    log.error(`Failed to update script ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to update script in Twenty", details: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    log.info(`Deleting script ${req.params.id}`);
    const id = req.params.id as string;
    
    await deleteTwenty('agencyScripts', id);
    
    log.info(`Deleted script ${id}`);
    res.status(204).end();
  } catch (err: any) {
    log.error(`Failed to delete script ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to delete script from Twenty", details: err.message });
  }
});

export default router;
