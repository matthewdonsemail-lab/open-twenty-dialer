import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { listTwenty } from "../lib/twenty-client.js";
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
  createdAt?: string;
  updatedAt?: string;
}

router.get("/", async (_req, res) => {
  try {
    log.info('Fetching phones from Twenty CRM');

    const phones = await listTwenty<AgencyPhone>('agencyPhones', 100);

    log.info(`Found ${phones.length} phones`);

    const mapped = phones.map((phone) => ({
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
      // Back-compat aliases for existing UI (PhoneNumbersPage, widget selector)
      provider: phone.numberType || "Unknown",
      city: "—",
      country: phone.countryCode || "—",
      status: (phone.state || "active").toLowerCase(),
      created_at: phone.createdAt || new Date().toISOString(),
      updated_at: phone.updatedAt || new Date().toISOString(),
    }));

    res.json(mapped);
  } catch (err: any) {
    log.error("Failed to fetch phones from Twenty:", err.message);
    res.status(500).json({ error: "Failed to fetch phone numbers from Twenty", details: err.message });
  }
});

export default router;
