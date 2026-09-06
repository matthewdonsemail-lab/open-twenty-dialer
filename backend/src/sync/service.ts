import type { SyncConfig } from "./config.js"
import * as leadsSync from "./leads.js"
import * as campaignsSync from "./campaigns.js"
import * as prospectsSync from "./prospects.js"
import * as callLogsSync from "./callLogs.js"
import * as inbound from "./inbound.js"

export interface SyncState {
  lastOutboundSyncAt: string | null
  lastInboundSyncAt: string | null
  outboundQueueLength: number
  inboundQueueLength: number
  errors: string[]
}

export interface SyncService {
  init(): Promise<void>
  runOutboundOnce(): Promise<SyncState>
  runInboundOnce(): Promise<inbound.InboundSyncResult>
  onWebhook(payload: unknown): Promise<void>
  getState(): SyncState
}

type PendingOp =
  | { type: "lead-create"; payload: unknown }
  | { type: "lead-update"; id: string; payload: unknown }
  | { type: "lead-delete"; id: string }
  | { type: "campaign-create"; payload: unknown }
  | { type: "campaign-update"; id: string; payload: unknown }
  | { type: "campaign-delete"; id: string }
  | { type: "calllog-create"; payload: unknown }
  | { type: "calllog-delete"; id: string }

export class SyncServiceImpl implements SyncService {
  private config: SyncConfig
  private state: SyncState = {
    lastOutboundSyncAt: null,
    lastInboundSyncAt: null,
    outboundQueueLength: 0,
    inboundQueueLength: 0,
    errors: [],
  }
  private queue: PendingOp[] = []
  private running = false

  constructor(config: SyncConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    console.log("[sync] initializing sync service")
    await Promise.allSettled([
      leadsSync.ensureAgencyLeadObject(this.config),
      prospectsSync.ensureAgencyProspectObject(this.config),
      campaignsSync.ensureAgencyCampaignObject(this.config),
    ])
    console.log("[sync] sync service initialized")
  }

  enqueue(op: PendingOp): void {
    this.queue.push(op)
    this.state.outboundQueueLength = this.queue.length
  }

  async runOutboundOnce(): Promise<SyncState> {
    if (this.queue.length === 0) {
      this.state.lastOutboundSyncAt = new Date().toISOString()
      return this.state
    }

    this.running = true
    const errors: string[] = []
    const nextBatch = [...this.queue]
    this.queue = []

    for (const op of nextBatch) {
      try {
        switch (op.type) {
          case "lead-create":
            await leadsSync.createAgencyLead(this.config, op.payload as any)
            break
          case "lead-update":
            await leadsSync.updateAgencyLead(this.config, op.id, op.payload as any)
            break
          case "lead-delete":
            await leadsSync.deleteAgencyLead(this.config, op.id)
            break
          case "campaign-create":
            await campaignsSync.createAgencyCampaign(this.config, op.payload as any)
            break
          case "campaign-update":
            await campaignsSync.updateAgencyCampaign(this.config, op.id, op.payload as any)
            break
          case "campaign-delete":
            await campaignsSync.deleteAgencyCampaign(this.config, op.id)
            break
          case "calllog-create":
            await callLogsSync.syncCallLog(this.config, op.payload as any)
            break
          case "calllog-delete":
            await callLogsSync.deleteCallLogSync(this.config, op.id)
            break
        }
      } catch (err: any) {
        errors.push(`[${op.type}] ${err?.message || String(err)}`)
      }
    }

    this.state.lastOutboundSyncAt = new Date().toISOString()
    this.state.outboundQueueLength = this.queue.length
    this.state.errors = errors.slice(-20)
    this.running = false
    return this.state
  }

  async runInboundOnce(): Promise<inbound.InboundSyncResult> {
    const [leadsResult, prospectsResult] = await Promise.all([
      inbound.pollLeads(this.config, this.state.lastInboundSyncAt),
      inbound.pollProspects(this.config, this.state.lastInboundSyncAt),
    ])
    this.state.lastInboundSyncAt = new Date().toISOString()
    
    const result: inbound.InboundSyncResult = {
      created: leadsResult.created + prospectsResult.created,
      updated: leadsResult.updated + prospectsResult.updated,
      errors: [...leadsResult.errors, ...prospectsResult.errors],
    }
    
    if (result.errors.length > 0) {
      this.state.errors = [...result.errors.slice(-10), ...this.state.errors]
    }
    return result
  }

  async onWebhook(payload: unknown): Promise<void> {
    console.log("[sync] webhook received, will process on next poll")
  }

  getState(): SyncState {
    return { ...this.state }
  }

  get isRunning(): boolean {
    return this.running
  }
}
