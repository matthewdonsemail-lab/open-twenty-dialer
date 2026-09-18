import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { listTwentyAll, createTwenty, updateTwenty, getTwenty } from "../lib/twenty-client.js";
import { createLogger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

const log = createLogger('calls');

interface AgencyCall {
  id: string;
  name?: string;
  direction?: string;
  status?: string;
  fromNumber?: string;
  toNumber?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  telnyxCallId?: string;
  telnyxRecordingId?: string;
  recordingUrl?: string;
  transcript?: string;
  transcriptionStatus?: string;
  summary?: string;
  meetingUrl?: string;
  meetingProvider?: string;
  meetingAt?: string;
  meetingStatus?: string;
  meetingBookingId?: string;
  agencyPhoneId?: string;
  agencyProspectId?: string;
  agencyLeadId?: string;
  createdBy?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

function mapCall(call: AgencyCall) {
  return {
    id: call.id,
    name: call.name || null,
    direction: call.direction || null,
    status: call.status || null,
    fromNumber: call.fromNumber || null,
    toNumber: call.toNumber || null,
    startedAt: call.startedAt || null,
    endedAt: call.endedAt || null,
    durationSeconds: call.durationSeconds ?? 0,
    telnyxCallId: call.telnyxCallId || null,
    telnyxRecordingId: call.telnyxRecordingId || null,
    recordingUrl: call.recordingUrl || null,
    transcript: call.transcript || null,
    transcriptionStatus: call.transcriptionStatus || null,
    summary: call.summary || null,
    meetingUrl: call.meetingUrl || null,
    meetingProvider: call.meetingProvider || null,
    meetingAt: call.meetingAt || null,
    meetingStatus: call.meetingStatus || null,
    meetingBookingId: call.meetingBookingId || null,
    agencyPhoneId: call.agencyPhoneId || null,
    agencyProspectId: call.agencyProspectId || null,
    agencyLeadId: call.agencyLeadId || null,
    createdBy: call.createdBy ?? null,
    created_at: call.createdAt || new Date().toISOString(),
    updated_at: call.updatedAt || new Date().toISOString(),
  };
}

// GET /api/calls — newest first (Twenty returns insertion order; reverse client-side)
router.get("/", async (_req, res) => {
  try {
    const calls = await listTwentyAll<AgencyCall>('agencyCalls');
    res.json(calls.map(mapCall).reverse());
  } catch (err: any) {
    log.error("Failed to fetch calls:", err.message);
    res.status(500).json({ error: "Failed to fetch calls", details: err.message });
  }
});

// GET /api/calls/:id
router.get("/:id", async (req, res) => {
  try {
    const call = await getTwenty<AgencyCall>('agencyCalls', req.params.id as string);
    res.json(mapCall(call));
  } catch (err: any) {
    res.status(404).json({ error: "Call not found" });
  }
});

// POST /api/calls — log a finished call (browser recording already uploaded)
router.post("/", async (req: AuthRequest, res) => {
  try {
    const {
      direction, status, fromNumber, toNumber, startedAt, endedAt,
      durationSeconds, telnyxCallId, telnyxRecordingId, recordingUrl,
      transcript, transcriptionStatus, summary,
      agencyPhoneId, agencyProspectId, agencyLeadId,
    } = req.body as Partial<AgencyCall>;

    if (!toNumber) {
      res.status(400).json({ error: "toNumber is required" });
      return;
    }

    const payload: Record<string, unknown> = {
      name: `${direction || "OUTBOUND"} ${toNumber} ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      direction: direction || "OUTBOUND",
      status: status || "COMPLETED",
      fromNumber: fromNumber || "",
      toNumber,
      durationSeconds: durationSeconds ?? 0,
    };
    if (startedAt) payload.startedAt = startedAt;
    if (endedAt) payload.endedAt = endedAt;
    if (telnyxCallId) payload.telnyxCallId = telnyxCallId;
    if (telnyxRecordingId) payload.telnyxRecordingId = telnyxRecordingId;
    if (recordingUrl) payload.recordingUrl = recordingUrl;
    if (transcript) payload.transcript = transcript;
    if (transcriptionStatus) payload.transcriptionStatus = transcriptionStatus;
    if (summary) payload.summary = summary;
    if (agencyPhoneId) payload.agencyPhoneId = agencyPhoneId;
    if (agencyProspectId) payload.agencyProspectId = agencyProspectId;
    if (agencyLeadId) payload.agencyLeadId = agencyLeadId;

    const created = await createTwenty<AgencyCall>('agencyCalls', payload);
    log.info(`Call logged: ${created.id} ${payload.direction} ${toNumber}`);

    // Point the phone row at its latest call (traceability; claim stays until release)
    if (agencyPhoneId) {
      try {
        await updateTwenty('agencyPhones', agencyPhoneId as string, { currentCallId: created.id });
      } catch (err: any) {
        log.info(`Could not stamp currentCallId: ${err.message}`);
      }
    }

    res.status(201).json(mapCall(created));
  } catch (err: any) {
    log.error("Failed to log call:", err.message);
    res.status(500).json({ error: "Failed to log call", details: err.message });
  }
});

// PATCH /api/calls/:id — enrich (webhook: recordingUrl/transcript/meeting link)
router.patch("/:id", async (req, res) => {
  try {
    const allowed = [
      "status", "endedAt", "durationSeconds", "telnyxRecordingId", "recordingUrl",
      "transcript", "transcriptionStatus", "summary",
      "meetingUrl", "meetingProvider", "meetingAt", "meetingStatus", "meetingBookingId",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key];
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const updated = await updateTwenty<AgencyCall>('agencyCalls', req.params.id as string, patch);
    res.json(mapCall(updated));
  } catch (err: any) {
    log.error("Failed to update call:", err.message);
    res.status(500).json({ error: "Failed to update call", details: err.message });
  }
});

export default router;
