import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { listTwenty, createTwenty, updateTwenty, deleteTwenty, getTwenty } from "../lib/twenty-client.js";
import { createLogger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

const log = createLogger('prospects');

// Status mappings
const STATUS_MAP: Record<string, string> = {
  "NEW": "new",
  "CONTACTED": "contacted",
  "INTERESTED": "interested",
  "NOT_INTERESTED": "not_interested",
  "CALLBACK": "callback",
  "CONVERTED": "converted",
  "DO_NOT_CONTACT": "do_not_contact",
};

interface AgencyProspect {
  id: string;
  name?: string;
  slug?: string;
  phone?: string;
  fullAddress?: string;
  city?: string;
  region?: string;
  country?: string;
  niche?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  email?: string;
  externalId?: string;
  outboundState?: string;
  outboundLabel?: string;
  coldCallStatus?: string;
  utmSource?: string;
  campaignIdId?: string; // Relation to agencyCampaign
  createdAt?: string;
  updatedAt?: string;
}

interface AgencyCampaign {
  id: string;
  utmSource?: string;
}

router.get("/", async (_req, res) => {
  try {
    log.info('Listing prospects from Twenty CRM');
    const prospects = await listTwenty<AgencyProspect>('agencyProspects', 100);

    // Fetch campaigns to resolve campaign types
    let campaignMap: Record<string, string> = {};
    try {
      const campaigns = await listTwenty<AgencyCampaign>('agencyCampaigns', 100);
      campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c.utmSource || 'outbound']));
    } catch {
      // Campaign lookup is best-effort; proceed without it
    }

    const mapped = prospects.map(prospect => {
      // Parse name into first_name / last_name
      const fullName = prospect.name || "";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.slice(1).join(" ") || undefined;

      // Parse address
      const addressParts = (prospect.fullAddress || "").split(",").map(p => p.trim());
      const address = addressParts[0] || "";
      const city = prospect.city || addressParts[1] || "";
      const state = prospect.region || addressParts[2] || "";
      const zip = addressParts[3] || "";

      // Map Twenty status to our frontend status
      const status = prospect.coldCallStatus
        ? STATUS_MAP[prospect.coldCallStatus] || "new"
        : "new";

      return {
        id: prospect.id,
        first_name: firstName,
        last_name: lastName,
        company: prospect.niche || "—" ,
        phone: prospect.phone,
        email: prospect.email,
        website: prospect.website,
        address,
        city,
        state,
        zip,
        status,
        source: prospect.niche || "twenty-import",
        campaign_id: prospect.campaignIdId || undefined,
        campaign_type: prospect.utmSource ? (prospect.utmSource === 'outbound' ? 'outbound' : prospect.utmSource === 'inbound' ? 'inbound' : 'blended') : undefined,
        assigned_to: undefined,
        tags: prospect.outboundState ? [prospect.outboundState] : null,
        notes: prospect.outboundLabel || undefined,
        dnc: status === "not_interested" || status === "do_not_contact",
        last_contacted_at: null,
        contact_count: 0,
        sync_id: prospect.externalId,
        created_at: prospect.createdAt || new Date().toISOString(),
        updated_at: prospect.updatedAt || new Date().toISOString(),
      };
    });

    log.info(`Returning ${mapped.length} prospects`);
    res.json(mapped);
  } catch (err: any) {
    log.error("Failed to list prospects:", err.message);
    res.status(500).json({ error: "Failed to fetch prospects from Twenty", details: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    log.info(`Getting prospect ${req.params.id}`);
    const id = req.params.id as string;
    const prospect = await getTwenty<AgencyProspect>('agencyProspects', id);
    log.info(`Raw prospect from Twenty: ${JSON.stringify(prospect)}`);
    log.info(`  All keys: ${JSON.stringify(Object.keys(prospect as any))}`);
    log.info(`  campaignIdId: ${prospect.campaignIdId}`);
    log.info(`  Any campaign-related keys: ${Object.keys(prospect as any).filter(k => k.toLowerCase().includes('campaign')).join(', ')}`);

    const addressParts = (prospect.fullAddress || "").split(",").map(p => p.trim());
    const fullName = prospect.name || "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(" ") || undefined;
    const status = prospect.coldCallStatus
      ? STATUS_MAP[prospect.coldCallStatus] || "new"
      : "new";

    const mapped = {
      id: prospect.id,
      first_name: firstName,
      last_name: lastName,
      company: prospect.niche || "—",
      phone: prospect.phone,
      email: prospect.email,
      website: prospect.website,
      address: addressParts[0],
      city: prospect.city || addressParts[1],
      state: prospect.region || addressParts[2],
      zip: addressParts[3],
      status,
      source: prospect.niche || "twenty-import",
      campaign_id: prospect.campaignIdId || undefined,
      campaign_type: prospect.utmSource ? (prospect.utmSource === 'outbound' ? 'outbound' : prospect.utmSource === 'inbound' ? 'inbound' : 'blended') : undefined,
      tags: prospect.outboundState ? [prospect.outboundState] : null,
      notes: prospect.outboundLabel,
      dnc: status === "not_interested" || status === "do_not_contact",
      sync_id: prospect.externalId,
      created_at: prospect.createdAt || new Date().toISOString(),
      updated_at: prospect.updatedAt || new Date().toISOString(),
    };

    res.json(mapped);
  } catch (err: any) {
    log.error(`Failed to get prospect ${req.params.id}:`, err.message);
    res.status(404).json({ error: "Prospect not found" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const {
      first_name, last_name, phone, email, website,
      address, city, state, zip, status, source, tags, notes, dnc,
    } = req.body;

    const fullName = [first_name, last_name].filter(Boolean).join(" ").trim();
    const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

    // Map our status to Twenty's coldCallStatus
    const coldCallStatus = dnc ? "DO_NOT_CONTACT" : (
      status === "contacted" ? "CONTACTED" :
      status === "interested" ? "INTERESTED" :
      status === "callback" ? "CALLBACK" :
      status === "converted" ? "CONVERTED" :
      status === "not_interested" ? "NOT_INTERESTED" : "NEW"
    );

    log.info(`Creating prospect: ${fullName}`);

    const payload = {
      name: fullName,
      phone: phone,
      email: email,
      website: website,
      fullAddress: fullAddress || undefined,
      city: city,
      region: state,
      country: "US",
      niche: source || "general",
      rating: 0,
      reviewCount: 0,
      externalId: undefined,
      outboundState: tags?.[0],
      coldCallStatus,
    };

    const result = await createTwenty<any>('agencyProspects', payload);
    const prospect = result.data || result;

    const mapped = {
      id: prospect.id,
      first_name,
      last_name,
      phone,
      email,
      website,
      address,
      city,
      state,
      zip,
      status: coldCallStatus === "DO_NOT_CONTACT" ? "do_not_contact" : "new",
      source,
      tags: tags || null,
      notes: notes,
      dnc: Boolean(dnc),
      sync_id: prospect.externalId,
      created_at: prospect.createdAt || new Date().toISOString(),
      updated_at: prospect.updatedAt || new Date().toISOString(),
    };

    log.info(`Created prospect ${prospect.id}`);
    res.status(201).json(mapped);
  } catch (err: any) {
    log.error("Failed to create prospect:", err.message);
    res.status(500).json({ error: "Failed to create prospect in Twenty", details: err.message });
  }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    log.info(`Updating prospect ${req.params.id}`);

    const {
      first_name, last_name, phone, email, website,
      address, city, state, zip, status, source, tags, notes, dnc,
      campaign_id,
    } = req.body;

    const payload: any = {};

    if (first_name !== undefined || last_name !== undefined) {
      const fullName = [first_name, last_name].filter(Boolean).join(" ").trim();
      if (fullName) payload.name = fullName;
    }

    if (phone !== undefined) payload.phone = phone;
    if (email !== undefined) payload.email = email;
    if (website !== undefined) payload.website = website;
    if (address !== undefined || city !== undefined || state !== undefined || zip !== undefined) {
      const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");
      if (fullAddress) payload.fullAddress = fullAddress;
    }
    if (city !== undefined) payload.city = city;
    if (state !== undefined) payload.region = state;
    if (source !== undefined) payload.niche = source;
    if (notes !== undefined) payload.outboundLabel = notes;
    if (tags?.[0] !== undefined) payload.outboundState = tags[0];

    // Handle campaign relation
    if (campaign_id !== undefined) {
      payload.campaignIdId = campaign_id || null;
    }

    // Map status
    if (status !== undefined) {
      payload.coldCallStatus = dnc ? "DO_NOT_CONTACT" : (
        status === "contacted" ? "CONTACTED" :
        status === "interested" ? "INTERESTED" :
        status === "callback" ? "CALLBACK" :
        status === "converted" ? "CONVERTED" :
        status === "not_interested" ? "NOT_INTERESTED" : "NEW"
      );
    }

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const id = req.params.id as string;
    const result = await updateTwenty<any>('agencyProspects', id, payload);
    const prospect = result.data || result;

    const mappedStatus = prospect.coldCallStatus
      ? STATUS_MAP[prospect.coldCallStatus] || "new"
      : "new";

    const fullName = prospect.name || "";
    const nameParts = fullName.split(" ");

    const mapped = {
      id: prospect.id,
      first_name: nameParts[0] || undefined,
      last_name: nameParts.slice(1).join(" ") || undefined,
      company: prospect.niche || "—",
      phone: prospect.phone,
      email: prospect.email,
      website: undefined,
      address: undefined,
      city: undefined,
      state: undefined,
      zip: undefined,
      status: mappedStatus,
      source: prospect.source || undefined,
      campaign_id: prospect.campaignIdId || undefined,
      notes: prospect.note || null,
      dnc: mappedStatus === "not_interested" || mappedStatus === "converted",
      last_called_at: null,
      call_count: 0,
      created_at: prospect.createdAt || new Date().toISOString(),
      updated_at: prospect.updatedAt || new Date().toISOString(),
    };

    log.info(`Updated prospect ${prospect.id}`);
    res.json(mapped);
  } catch (err: any) {
    log.error(`Failed to update prospect ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to update prospect in Twenty", details: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    log.info(`Deleting prospect ${req.params.id}`);
    const id = req.params.id as string;

    await deleteTwenty('agencyProspects', id);

    log.info(`Deleted prospect ${id}`);
    res.status(204).end();
  } catch (err: any) {
    log.error(`Failed to delete prospect ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to delete prospect from Twenty", details: err.message });
  }
});

export default router;
