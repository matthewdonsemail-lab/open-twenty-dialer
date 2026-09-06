import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// Load environment variables from project root .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env.local");
const result = config({ path: envPath });
if (result.error) {
  console.warn("[env] failed to load .env.local:", result.error.message);
} else {
  console.log("[env] loaded from", envPath);
}

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.js";
import campaignsRoutes from "./routes/campaigns.js";
import callLogsRoutes from "./routes/callLogs.js";
import scriptsRoutes from "./routes/scripts.js";
import prospectsRoutes from "./routes/prospects.js";
import syncRoutes from "./routes/sync.js";
import { loadSyncConfig } from "./sync/config.js";
import { SyncServiceImpl } from "./sync/service.js";

const app = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/prospects", prospectsRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/call-logs", callLogsRoutes);
app.use("/api/scripts", scriptsRoutes);
app.use("/api/sync", syncRoutes);

// Initialize sync service after routes are mounted
let syncService: SyncServiceImpl | null = null;
if (process.env.TWENTY_BASE_URL && process.env.TWENTY_API_KEY) {
  try {
    const config = loadSyncConfig();
    syncService = new SyncServiceImpl(config);
    syncService.init().catch(console.error);
    console.log("[sync] sync service enabled");
  } catch (err) {
    console.warn("[sync] failed to initialize:", err);
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cold Dialer API running on http://localhost:${PORT}`);
});
