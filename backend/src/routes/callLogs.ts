import { Router, Request, Response } from "express";
import { twentyClient } from "../lib/twenty-client.js";

interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

const router = Router();

// List all call logs
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const logs = await twentyClient.list<any>('agencyCallLogs');
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch call logs", details: err.message });
  }
});

// Get call logs by lead ID
router.get("/lead/:leadId", async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = req.params;
    const logs = await twentyClient.list<any>('agencyCallLogs', {
      filter: JSON.stringify({ field: "leadId", operator: "eq", value: leadId }),
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch call logs", details: err.message });
  }
});

// Get call log by ID
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const callLog = await twentyClient.get<any>('agencyCallLogs', id);
    res.json(callLog);
  } catch (err: any) {
    res.status(404).json({ error: "Call log not found" });
  }
});

// Create a call log
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      lead_id,
      user_id,
      campaign_id,
      direction,
      outcome,
      duration_seconds,
      recording_url,
      transcript,
      notes,
      started_at,
      ended_at,
    } = req.body;

    const payload: any = {
      name: `${direction}: ${outcome}`,
      direction,
      outcome,
      durationSeconds: duration_seconds || 0,
      notes: notes || "",
    };

    if (lead_id) payload.leadId = lead_id;
    if (user_id) payload.userId = user_id;
    if (campaign_id) payload.campaignId = campaign_id;
    if (recording_url) payload.recordingUrl = recording_url;
    if (transcript) payload.transcript = transcript;
    if (started_at) payload.startedAt = started_at;
    if (ended_at) payload.endedAt = ended_at;

    const result = await twentyClient.create<any>('agencyCallLogs', payload);
    res.status(201).json(result.data || result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create call log", details: err.message });
  }
});

export const callLogsRouter = router;
