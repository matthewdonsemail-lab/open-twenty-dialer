import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { listTwenty, createTwenty, updateTwenty, deleteTwenty, getTwenty } from "../lib/twenty-client.js";
import { createLogger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

const log = createLogger('campaigns');

/**
 * Maps Twenty's status SELECT values to frontend display values.
 * Twenty stores: ACTIVE, INACTIVE, DRAFT
 * Frontend displays: active, paused, draft (for UI consistency)
 */
function mapCampaignStatus(twentyStatus: string | undefined): string {
  if (!twentyStatus) return "draft";
  const upper = twentyStatus.toUpperCase();
  if (upper === "ACTIVE") return "active";
  if (upper === "INACTIVE") return "paused";
  return "draft";
}

/**
 * Maps frontend type/utmSource values back to Twenty's campaignType SELECT values.
 * Frontend sends: outbound, inbound, blended, referral, cold-call, website, twenty-import, other
 * Twenty stores: OUTBOUND, INBOUND, BLENDED, REFERRAL, COLD_CALL, WEBSITE, TWENTY_IMPORT, OTHER
 */
function mapCampaignType(frontendType: string | undefined): string {
  if (!frontendType) return "OUTBOUND";
  const map: Record<string, string> = {
    "outbound": "OUTBOUND",
    "inbound": "INBOUND",
    "blended": "BLENDED",
    "referral": "REFERRAL",
    "cold-call": "COLD_CALL",
    "cold_call": "COLD_CALL",
    "website": "WEBSITE",
    "twenty-import": "TWENTY_IMPORT",
    "twenty_import": "TWENTY_IMPORT",
    "other": "OTHER",
  };
  return map[frontendType.toLowerCase()] || "OUTBOUND";
}

interface AgencyCampaign {
  id: string;
  name?: string;
  status?: string; // From Twenty SELECT: ACTIVE, INACTIVE, DRAFT
  campaignType?: string; // From Twenty SELECT: OUTBOUND, INBOUND, etc.
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CampaignListItem {
  id: string;
  name: string;
  type: string; // frontend display type (outbound, inbound, etc.)
  status: string; // frontend display status (active, paused, draft)
  settings: any;
  created_at: string;
  updated_at: string;
}

router.get("/", async (_req, res) => {
  try {
    log.info('Listing campaigns from Twenty CRM');
    const campaigns = await listTwenty<AgencyCampaign>('agencyCampaigns', 100);

    const mapped: CampaignListItem[] = campaigns.map(c => ({
      id: c.id,
      name: c.name || "Unnamed Campaign",
      type: c.campaignType?.toLowerCase().replace("_", "-") || "outbound",
      status: mapCampaignStatus(c.status),
      settings: c.note ? JSON.parse(c.note) : null,
      created_at: c.createdAt || new Date().toISOString(),
      updated_at: c.updatedAt || new Date().toISOString(),
    }));

    log.info(`Returning ${mapped.length} campaigns`);
    res.json(mapped);
  } catch (err: any) {
    log.error("Failed to list campaigns:", err.message);
    res.status(500).json({ error: "Failed to fetch campaigns from Twenty", details: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    log.info(`Getting campaign ${req.params.id}`);
    const id = req.params.id as string;
    const campaign = await getTwenty<AgencyCampaign>(`agencyCampaigns`, id);

    const mapped: CampaignListItem = {
      id: campaign.id,
      name: campaign.name || "Unnamed Campaign",
      type: campaign.campaignType?.toLowerCase().replace("_", "-") || "outbound",
      status: mapCampaignStatus(campaign.status),
      settings: campaign.note ? JSON.parse(campaign.note) : null,
      created_at: campaign.createdAt || new Date().toISOString(),
      updated_at: campaign.updatedAt || new Date().toISOString(),
    };

    res.json(mapped);
  } catch (err: any) {
    log.error(`Failed to get campaign ${req.params.id}:`, err.message);
    res.status(404).json({ error: "Campaign not found" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, type, status, settings, utmSource, campaignType } = req.body;

    log.info(`Creating campaign: ${name}`);

    const payload: any = {
      name: name || "New Campaign",
      status: status || "ACTIVE",
      campaignType: campaignType || mapCampaignType(utmSource || type || "outbound"),
      note: settings ? JSON.stringify(settings) : undefined,
    };

    const result = await createTwenty<any>('agencyCampaigns', payload);
    const campaign = result.data || result;

    const mapped: CampaignListItem = {
      id: campaign.id,
      name: campaign.name,
      type: campaign.campaignType?.toLowerCase().replace("_", "-") || "outbound",
      status: mapCampaignStatus(campaign.status),
      settings: campaign.note ? JSON.parse(campaign.note) : null,
      created_at: campaign.createdAt || new Date().toISOString(),
      updated_at: campaign.updatedAt || new Date().toISOString(),
    };

    log.info(`Created campaign ${campaign.id}`);
    res.status(201).json(mapped);
  } catch (err: any) {
    log.error("Failed to create campaign:", err.message);
    res.status(500).json({ error: "Failed to create campaign in Twenty", details: err.message });
  }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { name, type, status, settings, utmSource, campaignType } = req.body;

    log.info(`Updating campaign ${req.params.id}`);
    const id = req.params.id as string;

    const payload: any = {};
    if (name !== undefined) payload.name = name;

    // Handle status - accept both frontend format and Twenty format
    if (status !== undefined) {
      const s = String(status).toUpperCase().replace("-", "_");
      // Frontend sends: active/paused/draft, Twenty stores: ACTIVE/INACTIVE/DRAFT
      const twentyStatus = s === "PAUSED" ? "INACTIVE" : s === "ACTIVE" ? "ACTIVE" : "DRAFT";
      payload.status = twentyStatus;
    }

    // Handle type - accept both Twenty format and frontend format
    if (campaignType !== undefined) {
      payload.campaignType = String(campaignType).toUpperCase().replace("-", "_");
    } else if (utmSource !== undefined || type !== undefined) {
      payload.campaignType = mapCampaignType(utmSource || type);
    }

    if (settings !== undefined) payload.note = JSON.stringify(settings);

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const result = await updateTwenty<any>('agencyCampaigns', id, payload);
    const campaign = result.data || result;

    const mapped: CampaignListItem = {
      id: campaign.id,
      name: campaign.name,
      type: campaign.campaignType?.toLowerCase().replace("_", "-") || "outbound",
      status: mapCampaignStatus(campaign.status),
      settings: campaign.note ? JSON.parse(campaign.note) : null,
      created_at: campaign.createdAt || new Date().toISOString(),
      updated_at: campaign.updatedAt || new Date().toISOString(),
    };

    log.info(`Updated campaign ${campaign.id}`);
    res.json(mapped);
  } catch (err: any) {
    log.error(`Failed to update campaign ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to update campaign in Twenty", details: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    log.info(`Deleting campaign ${req.params.id}`);
    const id = req.params.id as string;

    await deleteTwenty('agencyCampaigns', id);

    log.info(`Deleted campaign ${id}`);
    res.status(204).end();
  } catch (err: any) {
    log.error(`Failed to delete campaign ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to delete campaign from Twenty", details: err.message });
  }
});

export default router;
