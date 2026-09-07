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
  if (!syncEnabled || !syncConfig) {
    res.status(503).json({ error: "Twenty sync not configured" });
    return;
  }

  try {
    const res = await fetch(`${syncConfig.twentyBaseUrl}/agencyPhones`, {
      headers: {
        Authorization: `Bearer ${syncConfig.twentyApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch agencyPhones: ${res.status}`);
    }

    const json = await res.json();
    const phones = (json?.data ?? json) as AgencyPhone[];

    const mapped = phones.map((phone: AgencyPhone) => ({
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
    console.error("[sync] failed to fetch phones from Twenty:", err);
    res.status(500).json({ error: "Failed to fetch phone numbers from Twenty" });
  }
});

export default router;