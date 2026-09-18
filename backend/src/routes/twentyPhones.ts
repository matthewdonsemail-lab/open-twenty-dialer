import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { listTwenty, getTwenty, updateTwenty } from "../lib/twenty-client.js";
import { createLogger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

const log = createLogger('phones');

interface AgencyPhone {
  id: string;
  name?: string;
  phoneNumber?: string;
  countryCode?: string;
  numberType?: string;
  state?: string;
  messagingProfileId?: string;
  tenDlcCampaignId?: string;
  tollFreeVerificationId?: string;
  lastSyncedAt?: string;
  eligibleProducts?: unknown;
  features?: unknown;
  health?: unknown;
  // Claim state (who holds the number for the live call)
  callState?: string;
  claimedByMemberId?: string;
  claimedByEmail?: string;
  claimedAt?: string;
  currentCallId?: string;
  createdAt?: string;
  updatedAt?: string;
}

function mapPhone(phone: AgencyPhone) {
  return {
    id: phone.id,
    name: phone.name,
    phoneNumber: phone.phoneNumber || phone.name || "—",
    // Live Twenty shape (see SendWebsiteWidget_plan.md §1.4)
    countryCode: phone.countryCode || null,
    numberType: phone.numberType || null,
    state: phone.state || null,
    messagingProfileId: phone.messagingProfileId || null,
    tenDlcCampaignId: phone.tenDlcCampaignId || null,
    tollFreeVerificationId: phone.tollFreeVerificationId || null,
    lastSyncedAt: phone.lastSyncedAt || null,
    eligibleProducts: phone.eligibleProducts ?? null,
    features: phone.features ?? null,
    health: phone.health ?? null,
    // Claim state — single holder at a time
    callState: phone.callState || "IDLE",
    claimedByMemberId: phone.claimedByMemberId || null,
    claimedByEmail: phone.claimedByEmail || null,
    claimedAt: phone.claimedAt || null,
    currentCallId: phone.currentCallId || null,
    // Back-compat aliases for existing UI (PhoneNumbersPage, widget selector)
    provider: phone.numberType || "Unknown",
    city: "—",
    country: phone.countryCode || "—",
    status: (phone.state || "active").toLowerCase(),
    created_at: phone.createdAt || new Date().toISOString(),
    updated_at: phone.updatedAt || new Date().toISOString(),
  };
}

router.get("/", async (_req, res) => {
  try {
    log.info('Fetching phones from Twenty CRM');

    const phones = await listTwenty<AgencyPhone>('agencyPhones', 100);

    log.info(`Found ${phones.length} phones`);

    res.json(phones.map(mapPhone));
  } catch (err: any) {
    log.error("Failed to fetch phones from Twenty:", err.message);
    res.status(500).json({ error: "Failed to fetch phone numbers from Twenty", details: err.message });
  }
});

/**
 * POST /api/twenty/phones/:id/claim
 * Claim a number for the live call. Fails 409 when another member holds it.
 * Body: { memberId, memberEmail }
 */
router.post("/:id/claim", async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { memberId, memberEmail } = req.body as { memberId?: string; memberEmail?: string };
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const phone = await getTwenty<AgencyPhone>('agencyPhones', id);
    const state = phone.callState || "IDLE";
    const holder = phone.claimedByMemberId || null;
    if (state !== "IDLE" && holder && holder !== memberId) {
      log.info(`Claim refused: ${id} held by ${phone.claimedByEmail || holder}`);
      res.status(409).json({
        error: "Number is in use",
        heldBy: phone.claimedByEmail || holder,
        callState: state,
        claimedAt: phone.claimedAt || null,
      });
      return;
    }
    const now = new Date().toISOString();
    const updated = await updateTwenty<AgencyPhone>('agencyPhones', id, {
      callState: "DIALING",
      claimedByMemberId: memberId,
      claimedByEmail: memberEmail || "",
      claimedAt: now,
      lastSyncedAt: now,
    });
    log.info(`Number claimed: ${id} by ${memberEmail || memberId}`);
    res.json(mapPhone(updated));
  } catch (err: any) {
    log.error("Failed to claim number:", err.message);
    res.status(500).json({ error: "Failed to claim number", details: err.message });
  }
});

/**
 * POST /api/twenty/phones/:id/state
 * Move the live call DIALING -> ACTIVE (holder only).
 * Body: { memberId, state: "DIALING" | "ACTIVE" }
 */
router.post("/:id/state", async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { memberId, state } = req.body as { memberId?: string; state?: string };
    if (!memberId || (state !== "DIALING" && state !== "ACTIVE")) {
      res.status(400).json({ error: "memberId and state (DIALING|ACTIVE) are required" });
      return;
    }
    const phone = await getTwenty<AgencyPhone>('agencyPhones', id);
    if ((phone.claimedByMemberId || null) !== memberId) {
      res.status(409).json({ error: "Number is held by another member", heldBy: phone.claimedByEmail || phone.claimedByMemberId || null });
      return;
    }
    const updated = await updateTwenty<AgencyPhone>('agencyPhones', id, {
      callState: state,
      lastSyncedAt: new Date().toISOString(),
    });
    res.json(mapPhone(updated));
  } catch (err: any) {
    log.error("Failed to set call state:", err.message);
    res.status(500).json({ error: "Failed to set call state", details: err.message });
  }
});

/**
 * POST /api/twenty/phones/:id/release
 * Release the number back to IDLE (holder only, unless force: true).
 * Body: { memberId, force?: boolean, callId?: string }
 */
router.post("/:id/release", async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { memberId, force, callId } = req.body as { memberId?: string; force?: boolean; callId?: string };
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const phone = await getTwenty<AgencyPhone>('agencyPhones', id);
    const holder = phone.claimedByMemberId || null;
    if (holder && holder !== memberId && !force) {
      res.status(409).json({ error: "Number is held by another member", heldBy: phone.claimedByEmail || holder });
      return;
    }
    const now = new Date().toISOString();
    const updated = await updateTwenty<AgencyPhone>('agencyPhones', id, {
      callState: "IDLE",
      claimedByMemberId: "",
      claimedByEmail: "",
      claimedAt: null,
      currentCallId: callId || phone.currentCallId || "",
      lastSyncedAt: now,
    });
    log.info(`Number released: ${id} by ${memberId}${force ? " (forced)" : ""}`);
    res.json(mapPhone(updated));
  } catch (err: any) {
    log.error("Failed to release number:", err.message);
    res.status(500).json({ error: "Failed to release number", details: err.message });
  }
});

export default router;
