/**
 * GET /api/diag-env — temporary build/env diagnostic (lengths only, no values).
 * DELETE THIS FILE once the SIP bake issue is resolved.
 */
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }
  const len = (v: string | undefined) => (v === undefined ? "missing" : v.length);
  res.status(200).json({
    build: "diag-1",
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,
    vars: {
      TWENTY_BASE_URL: len(process.env.TWENTY_BASE_URL),
      TWENTY_API_KEY: len(process.env.TWENTY_API_KEY),
      TELNYX_WEBHOOK_TOKEN: len(process.env.TELNYX_WEBHOOK_TOKEN),
    },
  });
}
