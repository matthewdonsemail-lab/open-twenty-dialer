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
  phoneNumber?: { primaryPhoneNumber?: string; primaryPhoneCountryCode?: string; primaryPhoneCallingCode?: string; additionalPhones?: unknown[] } | string;
  primaryPhone?: { primaryPhoneNumber?: string; primaryPhoneCountryCode?: string; primaryPhoneCallingCode?: string; additionalPhones?: unknown[] } | string;
  phoneValid?: boolean;
  fullAddress?: string;
  city?: string;
  region?: string;
  country?: string;
  niche?: string;
  label?: string | { value?: string; label?: string };
  website?: string;
  rating?: number;
  reviewCount?: number;
  email?: string;
  externalId?: string;
  outboundState?: string | { value?: string; label?: string };
  outboundLabel?: string | { value?: string; label?: string };
  smsMetadata?: unknown;
  videoStatus?: string | { value?: string; label?: string };
  videoSource?: string;
  videoError?: string;
  videoUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string; secondaryLinks?: unknown[] };
  whatsappStatus?: string | { value?: string; label?: string };
  whatsappValidated?: boolean;
  ghlWebhookUrl?: string;
  googleReviewsUrl?: string;
  coldCallStatus?: string;
  utmSource?: string;
  campaignIdId?: string; // Relation to agencyCampaign
  createdAt?: string;
  updatedAt?: string;
}

// Twenty SELECT fields may arrive as a plain string value or as { value, label }.
function selectValue(v: unknown): string | undefined {
  if (typeof v === "string") return v || undefined;
  if (v && typeof v === "object") {
    const o = v as { value?: unknown; label?: unknown };
    if (typeof o.value === "string" && o.value) return o.value;
    if (typeof o.label === "string" && o.label) return o.label;
  }
  return undefined;
}

function slugifyIndustryValue(niche: string): string {
  // Display-only fallback for the label badge when a prospect has no label.
  const value = niche.trim().toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return value.length > 0 ? value : "UNLABELED";
}

/**
 * Industry routing read from the agencyCampaign row — the only source of
 * urlKey/funnel/template bases. Linked campaign first, else the campaign
 * whose industryId matches the prospect label. Null = unconfigured
 * (callers surface explicit states, never invented defaults).
 */
async function resolveIndustryRouting(prospect: AgencyProspect): Promise<{
  urlKey: string; funnelBaseUrl?: string; templateBaseUrl?: string; packDir?: string;
} | null> {
  const linked: any = (prospect as any).campaignId ?? (prospect as any).campaignIdId;
  const linkedId = typeof linked === "string" ? linked : linked?.id;
  if (linkedId) {
    try {
      const campaign: any = await getTwenty<any>('agencyCampaigns', linkedId);
      if (campaign?.urlKey) return campaign;
    } catch {
      // fall through to industryId filter
    }
  }
  const label = selectValue(prospect.label);
  if (!label) return null;
  try {
    const campaigns = await listTwenty<any>('agencyCampaigns', {
      limit: 1,
      filter: `industryId[eq]:${label}`,
    } as any);
    if (campaigns[0]?.urlKey) return campaigns[0];
  } catch (err: any) {
    log.info(`Campaign routing lookup failed: ${(err as any)?.message}`);
  }
  return null;
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

      const labelValue = selectValue(prospect.label);
      const outboundState = selectValue(prospect.outboundState);

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
        // Industry / niche (live Twenty shape)
        slug: prospect.slug,
        niche: prospect.niche,
        label: labelValue,
        labelValue,
        country: prospect.country,
        rating: prospect.rating,
        reviewCount: prospect.reviewCount,
        // Messaging shape (SMS pipeline + WhatsApp)
        outboundState,
        outboundLabel: selectValue(prospect.outboundLabel),
        smsMetadata: prospect.smsMetadata ?? null,
        phoneValid: prospect.phoneValid ?? null,
        whatsappStatus: selectValue(prospect.whatsappStatus),
        whatsappValidated: prospect.whatsappValidated ?? null,
        phoneNumber: prospect.phoneNumber ?? null,
        primaryPhone: prospect.primaryPhone ?? null,
        ghlWebhookUrl: prospect.ghlWebhookUrl,
        googleReviewsUrl: prospect.googleReviewsUrl,
        // Video pipeline
        videoStatus: selectValue(prospect.videoStatus),
        videoSource: prospect.videoSource,
        videoError: prospect.videoError,
        videoUrl: prospect.videoUrl ?? null,
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
      // Industry / niche (live Twenty shape)
      slug: prospect.slug,
      niche: prospect.niche,
      label: selectValue(prospect.label),
      labelValue: selectValue(prospect.label),
      country: prospect.country,
      rating: prospect.rating,
      reviewCount: prospect.reviewCount,
      // Messaging shape (SMS pipeline + WhatsApp)
      outboundState: selectValue(prospect.outboundState),
      outboundLabel: selectValue(prospect.outboundLabel),
      smsMetadata: prospect.smsMetadata ?? null,
      phoneValid: prospect.phoneValid ?? null,
      whatsappStatus: selectValue(prospect.whatsappStatus),
      whatsappValidated: prospect.whatsappValidated ?? null,
      phoneNumber: prospect.phoneNumber ?? null,
      primaryPhone: prospect.primaryPhone ?? null,
      ghlWebhookUrl: prospect.ghlWebhookUrl,
      googleReviewsUrl: prospect.googleReviewsUrl,
      // Video pipeline
      videoStatus: selectValue(prospect.videoStatus),
      videoSource: prospect.videoSource,
      videoError: prospect.videoError,
      videoUrl: prospect.videoUrl ?? null,
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

/**
 * GET /api/prospects/:id/website-status
 * Server-side aggregation for SendWebsiteWidget (Twenty key never leaves backend):
 * prospect messaging/video block + INDUSTRY agencyOffer + computed template/offer URLs.
 * Offer is industry-only (name == INDUSTRY:{urlKey}); industry routing (urlKey,
 * funnel/template bases, pack) is read from the agencyCampaign row — never
 * hardcoded, never defaulted. Missing rows surface as explicit nulls.
 */
router.get("/:id/website-status", async (req, res) => {
  try {
    const id = req.params.id as string;
    const prospect = await getTwenty<AgencyProspect>('agencyProspects', id);

    // Industry routing from the campaign row: linked campaign first, else the
    // campaign whose industryId matches the prospect label.
    const routing = await resolveIndustryRouting(prospect);
    const industryKey = routing?.urlKey || null;
    const funnelBase = (routing?.funnelBaseUrl || "").replace(/\/$/, "");
    const templateBase = (routing?.templateBaseUrl || "").replace(/\/$/, "");
    const pack = routing?.packDir || null;

    // Offer lookup: the INDUSTRY row, never the per-prospect row.
    let offer: any = null;
    if (industryKey) {
      try {
        const offers = await listTwenty<any>('agencyOffers', {
          limit: 1,
          filter: `name[eq]:INDUSTRY:${industryKey}`,
        } as any);
        offer = offers[0] ?? null;
      } catch (err: any) {
        log.info(`No industry offer INDUSTRY:${industryKey} for prospect ${id}: ${err.message}`);
      }
    }

    // Effective video: industry CUSTOM override wins, else the prospect video.
    const prospectVideoUrl =
      typeof prospect.videoUrl === "string"
        ? prospect.videoUrl
        : (prospect.videoUrl as any)?.primaryLinkUrl || undefined;
    const offerMode = String(offer?.videoMode || "PROSPECT").toUpperCase();
    const overrideUrl =
      typeof offer?.videoUrl === "string"
        ? offer.videoUrl
        : offer?.videoUrl?.primaryLinkUrl || undefined;
    const effectiveVideoUrl =
      offerMode === "CUSTOM" && overrideUrl ? overrideUrl : prospectVideoUrl;

    // Canonical phone: PHONES composite first, legacy TEXT fallback.
    const phoneE164 =
      (prospect.phoneNumber as any)?.primaryPhoneNumber ||
      (prospect.primaryPhone as any)?.primaryPhoneNumber ||
      prospect.phone;

    // Absolute "website we built" URL: phi /offer/:industry/:slug lineup
    // (same slug as the funnel). Null when unconfigured — never invented.
    // No trailing slash (the Vercel rewrites match slash-less paths).
    const niche = prospect.niche || "";
    const labelValue = selectValue(prospect.label) || (niche ? slugifyIndustryValue(niche) : "UNLABELED");
    const slug = prospect.slug || "";
    const prospectId = prospect.id;
    const templateKey = slug || prospectId;
    const templateUrl = industryKey && templateBase ? `${templateBase}/offer/${industryKey}/${templateKey}` : null;
    const funnelSrc = funnelBase ? `${funnelBase}/offer/prospect/${prospectId}` : null;

    res.json({
      prospect: {
        id: prospectId,
        slug,
        niche,
        label: selectValue(prospect.label),
        labelValue,
        website: prospect.website,
        phone: prospect.phone,
        phoneE164,
        country: prospect.country,
        city: prospect.city,
        region: prospect.region,
        videoStatus: selectValue(prospect.videoStatus),
        videoSource: prospect.videoSource,
        videoError: prospect.videoError,
        videoUrl: prospect.videoUrl ?? null,
        outboundState: selectValue(prospect.outboundState),
        outboundLabel: selectValue(prospect.outboundLabel),
        smsMetadata: prospect.smsMetadata ?? null,
        whatsappStatus: selectValue(prospect.whatsappStatus),
      },
      offer: offer ? {
        id: offer.id,
        title: offer.title,
        heroH1: offer.heroH1,
        status: offer.status,
        ctaType: offer.ctaType,
        videoMode: offer.videoMode,
        industryId: offer.industryId,
        videoUrl: effectiveVideoUrl ? { primaryLinkUrl: effectiveVideoUrl } : (offer.videoUrl ?? null),
      } : null,
      urls: {
        industryKey,
        pack,
        slug,
        // Cosmetic display URL (industry + slug); the funnel resolves by prospect ID
        offerDisplayUrl: industryKey && slug ? `/offer/${industryKey}/${slug}` : null,
        funnelSrc,
        templateUrl,
        templateAvailable: templateUrl !== null,
      },
    });
  } catch (err: any) {
    log.error(`Failed to get website-status for ${req.params.id}:`, err.message);
    res.status(404).json({ error: "Prospect not found" });
  }
});

/**
 * POST /api/prospects/:id/website-sent
 * Day-1 sent log (no Telnyx key needed): stamps outboundLabel -> SMS_IN_PROGRESS
 * when the current label is a pre-send state, and echoes the payload for the UI.
 */
router.post("/:id/website-sent", async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { templateUrl, offerUrl, fromNumber, body } = req.body ?? {};
    const sentAt = new Date().toISOString();

    let advancedLabel: string | null = null;
    try {
      const current = await getTwenty<AgencyProspect>('agencyProspects', id);
      const currentLabel = selectValue(current.outboundLabel);
      if (!currentLabel || ["NEEDS_ENRICHMENT", "NEEDS_VIDEO", "READY_FOR_SMS"].includes(currentLabel)) {
        await updateTwenty('agencyProspects', id, { outboundLabel: "SMS_IN_PROGRESS" });
        advancedLabel = "SMS_IN_PROGRESS";
      }
    } catch (err: any) {
      log.info(`website-sent label advance skipped for ${id}: ${err.message}`);
    }

    log.info(`Website sent logged for prospect ${id} from ${fromNumber || "unknown"}`);
    res.json({
      success: true,
      prospectId: id,
      sentAt,
      templateUrl: templateUrl ?? null,
      offerUrl: offerUrl ?? null,
      fromNumber: fromNumber ?? null,
      bodyPreview: typeof body === "string" ? body.slice(0, 280) : null,
      outboundLabel: advancedLabel,
    });
  } catch (err: any) {
    log.error(`Failed to log website-sent for ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to log website sent", details: err.message });
  }
});

/**
 * POST /api/prospects/:id/ensure-offer
 * Resolves the funnel 404 at the industry level: returns the INDUSTRY:{id}
 * offer for the prospect's industry, or creates it (neutral copy, ACTIVE,
 * videoMode=PROSPECT) so /offer/:industry/:slug + funnel links work immediately.
 * Per-prospect rows are never created here.
 */
router.post("/:id/ensure-offer", async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const prospect = await getTwenty<AgencyProspect>('agencyProspects', id);
    const routing = await resolveIndustryRouting(prospect);
    if (!routing?.urlKey) {
      res.status(404).json({ error: "Industry not configured for prospect" });
      return;
    }
    const industryKey = routing.urlKey;
    const twentyValue = selectValue((routing as any).industryId) || selectValue(prospect.label) || "";
    const rowName = `INDUSTRY:${industryKey}`;

    const existing = await listTwenty<any>('agencyOffers', {
      limit: 1,
      filter: `name[eq]:${rowName}`,
    } as any);
    if (existing[0]) {
      res.json({ action: "existing" as const, industryKey, offer: existing[0] });
      return;
    }

    // Neutral seed copy only — the operator tailors it in the builder.
    const created = await createTwenty<any>('agencyOffers', {
      name: rowName,
      title: `Free Consultation`,
      heroH1: `Book Your Free Consultation`,
      heroLede: {
        blocknote: null,
        markdown: `Answer a few quick questions and book your free consultation call.`,
      },
      status: "ACTIVE",
      industryId: twentyValue || undefined,
      videoMode: "PROSPECT",
    });
    const offer = (created as any).data || created;
    log.info(`Created industry offer ${rowName} (${offer.id}) via prospect ${id}`);
    res.status(201).json({ action: "created" as const, industryKey, offer });
  } catch (err: any) {
    log.error(`Failed to ensure offer for ${req.params.id}:`, err.message);
    res.status(500).json({ error: "Failed to ensure offer", details: err.message });
  }
});

export default router;
