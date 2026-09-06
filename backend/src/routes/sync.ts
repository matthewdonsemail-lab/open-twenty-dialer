import { Router, Request, Response } from "express"
import db from "../db/database.js"
import { authMiddleware, AuthRequest } from "../middleware/auth.js"
import { loadSyncConfig } from "../sync/config.js"
import { SyncServiceImpl } from "../sync/service.js"

const router = Router()
router.use(authMiddleware)

// Reuse a single service instance for the lifetime of the process
let syncService: SyncServiceImpl | null = null

function getService(): SyncServiceImpl {
  if (!syncService) {
    const config = loadSyncConfig()
    syncService = new SyncServiceImpl(config)
  }
  return syncService
}

// POST /api/sync/webhook — receives webhooks from Twenty
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    await getService().onWebhook(req.body)
    res.status(200).json({ received: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sync/status — returns sync state
router.get("/status", (_req: Request, res: Response) => {
  const state = getService().getState()
  res.json({
    lastOutboundSyncAt: state.lastOutboundSyncAt,
    lastInboundSyncAt: state.lastInboundSyncAt,
    outboundQueueLength: state.outboundQueueLength,
    inboundQueueLength: state.inboundQueueLength,
    errors: state.errors,
    isRunning: getService().isRunning,
  })
})

// POST /api/sync/poll — manual trigger for outbound sync
router.post("/poll", async (_req: Request, res: Response) => {
  try {
    const state = await getService().runOutboundOnce()
    res.json({ state })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sync/inbound — manual trigger for inbound sync
router.post("/inbound", async (_req: Request, res: Response) => {
  try {
    const result = await getService().runInboundOnce()
    res.json({ 
      result,
      lastInboundSyncAt: getService().getState().lastInboundSyncAt 
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sync/leads — list leads synced from Twenty
router.get("/leads", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT id, first_name, last_name, email, phone, status, sync_id, created_at FROM leads ORDER BY created_at DESC").all()
  res.json(rows)
})

export default router
