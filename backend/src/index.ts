import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import multer from "multer";
import fs from "fs";

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
import prospectsRoutes from "./routes/prospects.js";
import campaignsRoutes from "./routes/campaigns.js";
import scriptsRoutes from "./routes/scripts.js";
import twentyPhonesRoutes from "./routes/twentyPhones.js";
import twentyMetaRoutes from "./routes/twentyMeta.js";
import twentySetupRoutes from "./routes/twentySetup.js";
import { getTwentyPgStatus } from "./db/twenty-pg.js";
import { createLogger } from "./lib/logger.js";

const log = createLogger('server');
const app = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

// Ensure recordings directory exists
const RECORDINGS_DIR = path.join(process.cwd(), "data", "recordings");
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  const twentyPg = getTwentyPgStatus();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    twentyCrm: {
      apiKeyConfigured: Boolean(process.env.TWENTY_API_KEY),
      databaseUrlConfigured: twentyPg.configured,
      databaseMessage: twentyPg.message,
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/prospects", prospectsRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/scripts", scriptsRoutes);
app.use("/api/twenty/phones", twentyPhonesRoutes);
app.use("/api/twenty/meta", twentyMetaRoutes);
app.use("/api/setup/twenty", twentySetupRoutes);

/**
 * POST /api/calls/recording
 * Accept and store call recording uploads
 */
app.post("/api/calls/recording", upload.single("recording"), async (req, res) => {
  try {
    const file = req.file;
    const { leadId, callId } = req.body;

    if (!file) {
      return res.status(400).json({ error: "No recording file provided" });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(file.originalname) || ".webm";
    const filename = `${timestamp}-${timestamp}-${extension}`;
    const filePath = path.join(RECORDINGS_DIR, filename);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Generate URL for accessing the recording
    const recordingUrl = `/api/calls/recordings/${filename}`;

    log.info(`Recording uploaded: ${filename} (${file.size} bytes) for lead: ${leadId}, call: ${callId}`);

    res.json({
      success: true,
      recordingUrl,
      filename,
      size: file.size,
    });
  } catch (err: any) {
    log.error("Failed to upload recording:", err.message);
    res.status(500).json({ error: "Failed to upload recording", details: err.message });
  }
});

/**
 * GET /api/calls/recordings/:filename
 * Serve stored recordings
 */
app.get("/api/calls/recordings/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(RECORDINGS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Recording not found" });
  }

  res.sendFile(filePath);
});

// Log whether Twenty Postgres is available for login
const twentyPgStatus = getTwentyPgStatus();
if (!twentyPgStatus.configured) {
  log.warn("[auth] Twenty credential verification is unavailable:", twentyPgStatus.message);
} else {
  log.info("[auth] Twenty credential verification is configured.");
}

log.info(`Server running on http://localhost:${PORT}`);
app.listen(PORT, "0.0.0.0", () => {
  log.info(`Server ready on port ${PORT}`);
});
