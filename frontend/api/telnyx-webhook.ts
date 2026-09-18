/**
 * POST /api/telnyx-webhook — Telnyx event receiver (Vercel serverless).
 *
 * Configure on the Telnyx connection as:
 *   https://<vercel-app>/api/telnyx-webhook?token=<TELNYX_WEBHOOK_TOKEN>
 *
 * Env (Vercel project settings, never bundled):
 *   TWENTY_BASE_URL, TWENTY_API_KEY, TELNYX_WEBHOOK_TOKEN
 * Build note: SIP_* vars bake into the SPA at build time (Vite).
 *
 * Handled events:
 *   call.recording.saved                -> attach recording to agencyCalls (by telnyxCallId)
 *   call.recording.transcription.saved  -> attach transcript to agencyCalls
 *   message.received / message.finalized -> acknowledged (SMS pipeline owns these next)
 * Everything else -> 200 + logged.
 */

type VercelReq = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: any;
};

type VercelRes = {
  status: (code: number) => VercelRes;
  json: (body: any) => void;
};

const TWENTY_BASE = (process.env.TWENTY_BASE_URL || "https://twenty.inferencesaver.com").replace(/\/$/, "");
const TWENTY_KEY = process.env.TWENTY_API_KEY || "";
const HOOK_TOKEN = process.env.TELNYX_WEBHOOK_TOKEN || "";

const TW_HEADERS: Record<string, string> = {
  Authorization: `Bearer ${TWENTY_KEY}`,
  "Content-Type": "application/json",
  "User-Agent": "dialer-telnyx-webhook",
};

async function twentyRest(method: string, path: string, payload?: any): Promise<any> {
  const res = await fetch(`${TWENTY_BASE}/rest/${path.replace(/^\//, "")}`, {
    method,
    headers: TW_HEADERS,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twenty ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function unwrapList(payload: any, key: string): any[] {
  const data = payload?.data?.data ?? payload?.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data[key])) return data[key];
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) return v as any[];
  }
  return [];
}

function unwrapItem(payload: any): any {
  const data = payload?.data?.data ?? payload?.data ?? payload;
  if (data && typeof data === "object") {
    for (const v of Object.values(data)) {
      if (v && typeof v === "object" && "id" in (v as object)) return v;
    }
    if ("id" in data) return data;
  }
  return data;
}

async function findCallByTelnyxId(telnyxCallId: string): Promise<any | null> {
  // Small table: page it the same way the backend does (id-ordered walk).
  let cursor: string | undefined;
  for (let page = 0; page < 25; page++) {
    const params = new URLSearchParams({
      limit: "200",
      orderBy: "id[AscNullsFirst]",
      ...(cursor ? { filter: `id[gt]:"${cursor}"` } : {}),
    });
    const json = await twentyRest("GET", `agencyCalls?${params.toString()}`);
    const rows = unwrapList(json, "agencyCalls");
    const hit = rows.find((r: any) => r?.telnyxCallId === telnyxCallId);
    if (hit) return hit;
    if (rows.length < 200) break;
    const ids = rows.map((r: any) => r?.id).filter((id: any) => typeof id === "string");
    if (ids.length === 0) break;
    cursor = ids[ids.length - 1];
  }
  return null;
}

async function handleRecordingSaved(p: any): Promise<string> {
  const callControlId: string | undefined = p?.call_control_id;
  const recordingId: string | undefined = p?.recording_id ?? p?.recording_ids?.[0];
  const urls = p?.recording_urls ?? {};
  const downloadUrl: string | undefined = urls.mp3 ?? urls.wav;
  if (!callControlId) return "missing call_control_id";

  const existing = await findCallByTelnyxId(callControlId);
  if (existing) {
    const patch: Record<string, unknown> = { transcriptionStatus: "PENDING" };
    if (recordingId) patch.telnyxRecordingId = recordingId;
    if (downloadUrl) patch.recordingUrl = downloadUrl;
    await twentyRest("PATCH", `agencyCalls/${existing.id}`, patch);
    return `attached to ${existing.id}`;
  }

  // No browser-logged row (e.g. inbound via shared registration): create one.
  const created = await twentyRest("POST", "agencyCalls", {
    name: `INBOUND ${p?.from ?? "unknown"} ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    direction: "INBOUND",
    status: "COMPLETED",
    fromNumber: p?.from ?? "",
    toNumber: p?.to ?? "",
    telnyxCallId: callControlId,
    ...(recordingId ? { telnyxRecordingId: recordingId } : {}),
    ...(downloadUrl ? { recordingUrl: downloadUrl } : {}),
    transcriptionStatus: "PENDING",
  });
  return `created ${unwrapItem(created)?.id}`;
}

async function handleTranscriptionSaved(p: any): Promise<string> {
  const callControlId: string | undefined = p?.call_control_id;
  const text: string | undefined =
    p?.transcript ?? p?.transcription_text ?? p?.text ?? p?.transcription?.text;
  if (!callControlId) return "missing call_control_id";
  const existing = await findCallByTelnyxId(callControlId);
  if (!existing) return "no matching call row";
  const patch: Record<string, unknown> = { transcriptionStatus: "READY" };
  if (text) patch.transcript = text;
  await twentyRest("PATCH", `agencyCalls/${existing.id}`, patch);
  return `transcript attached to ${existing.id}`;
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  // Shared-secret gate (we control this token; Telnyx has no per-connection secret here)
  const token = req.query?.token;
  const provided = Array.isArray(token) ? token[0] : token;
  if (!HOOK_TOKEN || provided !== HOOK_TOKEN) {
    res.status(401).json({ error: "bad token" });
    return;
  }
  if (!TWENTY_KEY) {
    res.status(500).json({ error: "receiver not configured" });
    return;
  }

  const body = req.body ?? {};
  const data = body?.data ?? body;
  const eventType: string = data?.event_type ?? data?.record_type ?? "unknown";
  const payload = data?.payload ?? {};

  try {
    let result = "ignored";
    if (eventType === "call.recording.saved") {
      result = await handleRecordingSaved(payload);
    } else if (eventType === "call.recording.transcription.saved") {
      result = await handleTranscriptionSaved(payload);
    } else if (eventType === "call.recording.error") {
      const ccid: string | undefined = payload?.call_control_id;
      if (ccid) {
        const existing = await findCallByTelnyxId(ccid);
        if (existing) await twentyRest("PATCH", `agencyCalls/${existing.id}`, { transcriptionStatus: "FAILED" });
      }
      result = "marked failed";
    } else if (eventType === "message.received" || eventType === "message.finalized") {
      result = "acknowledged (sms pipeline owns next)";
    }
    console.log(`telnyx-webhook ${eventType}: ${result}`);
    res.status(200).json({ ok: true, event: eventType, result });
  } catch (err: any) {
    console.error(`telnyx-webhook ${eventType} failed:`, err?.message || err);
    // 500 so Telnyx retries; the failure is logged with the event type
    res.status(500).json({ ok: false, event: eventType, error: String(err?.message || err).slice(0, 200) });
  }
}
