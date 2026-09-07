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
  provider?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: string;
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
      phoneNumber: phone.phoneNumber || phone.name || "—",
      provider: phone.provider || "Unknown",
      city: phone.city || "—",
      state: phone.state || "—",
      country: phone.country || "—",
      status: phone.status || "active",
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
