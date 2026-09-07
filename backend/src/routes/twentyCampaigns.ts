import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { loadSyncConfig } from "../sync/config.js";

const router = Router();
router.use(authMiddleware);

let syncEnabled = false;
let syncConfig = null;
try {
  if (process.env.TWENTY_BASE_URL && process.env.TWENTY_API_KEY) {
    syncConfig = loadSyncConfig();
    syncEnabled = true;
  }
} catch {
  // Twenty sync not configured
}

interface AgencyCampaign {
  id: string;
  name?: string;
  utmSource?: string;
  status?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

router.get("/", async (_req, res) => {
  if (!syncEnabled || !syncConfig) {
    res.status(503).json({ error: "Twenty sync not configured" });
    return;
  }

  try {
    const baseUrl = syncConfig.twentyBaseUrl.replace(/\/rest$/, "");
    const res = await fetch(`${baseUrl}/agencyCampaigns`, {
      headers: {
        Authorization: `Bearer ${syncConfig.twentyApiKey}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`[campaigns] Twenty response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[campaigns] Error body:`, text.substring(0, 200));
      throw new Error(`Failed to fetch agencyCampaigns: ${res.status}`);
    }

    const json = await res.json();
    console.log(`[campaigns] Response keys:`, Object.keys(json));
    
    const campaigns = (json?.data ?? json) as AgencyCampaign[];
    const mapped = campaigns.map((campaign: AgencyCampaign) => ({
      id: campaign.id,
      name: campaign.name,
      type: campaign.utmSource || "outbound",
      status: campaign.status === "PAUSED" ? "paused" : campaign.status === "ACTIVE" ? "active" : "completed",
      settings: campaign.note ? JSON.parse(campaign.note) : null,
      created_at: campaign.createdAt || new Date().toISOString(),
      updated_at: campaign.updatedAt || new Date().toISOString(),
    }));

    console.log(`[campaigns] Returning ${mapped.length} campaigns`);
    res.json(mapped);
  } catch (err: any) {
    console.error("[campaigns] failed to fetch campaigns from Twenty:", err.message);
    res.status(500).json({ error: "Failed to fetch campaigns from Twenty", details: err.message });
  }
});

export default router;
