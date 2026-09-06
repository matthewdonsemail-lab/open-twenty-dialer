import Database, { type Database as DatabaseType } from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "cold-dialer.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables (idempotent with IF NOT EXISTS)
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'manager')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'outbound' CHECK (type IN ('outbound', 'inbound', 'blended')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    settings TEXT,
    created_by TEXT,
    sync_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'callback', 'converted', 'do_not_contact')),
    source TEXT,
    campaign_id TEXT,
    assigned_to TEXT,
    tags TEXT,
    notes TEXT,
    dnc INTEGER NOT NULL DEFAULT 0,
    last_called_at TEXT,
    call_count INTEGER NOT NULL DEFAULT 0,
    sync_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS call_scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    content TEXT,
    objection_responses TEXT,
    campaign_id TEXT,
    created_by TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id TEXT PRIMARY KEY,
    lead_id TEXT,
    user_id TEXT,
    campaign_id TEXT,
    direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
    outcome TEXT NOT NULL CHECK (outcome IN ('no_answer', 'answered', 'busy', 'voicemail', 'dnc', 'wrong_number', 'disconnected')),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    recording_url TEXT,
    notes TEXT,
    transcript TEXT,
    sip_call_id TEXT,
    started_at TEXT,
    ended_at TEXT,
    sync_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    type TEXT NOT NULL CHECK (type IN ('sales_call', 'demo', 'follow_up', 'consultation', 'check_in')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dnc_list (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    reason TEXT,
    source TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'callback', 'converted', 'do_not_contact')),
    source TEXT,
    campaign_id TEXT,
    assigned_to TEXT,
    tags TEXT,
    notes TEXT,
    dnc INTEGER NOT NULL DEFAULT 0,
    last_contacted_at TEXT,
    contact_count INTEGER NOT NULL DEFAULT 0,
    sync_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Run migrations for existing databases
const migrations = [
  `ALTER TABLE leads ADD COLUMN sync_id TEXT`,
  `ALTER TABLE campaigns ADD COLUMN sync_id TEXT`,
  `ALTER TABLE call_logs ADD COLUMN sync_id TEXT`,
];

for (const migration of migrations) {
  try {
    db.exec(migration);
  } catch (err) {
    // Ignore "already exists" errors - column may already be present
    const errMsg = String(err);
    if (!errMsg.includes('already exists') && !errMsg.includes('duplicate column')) {
      console.warn('[db] migration warning:', err);
    }
  }
}

// Create indexes
const indexStatements = [
  'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)',
  'CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)',
  'CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id)',
  'CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to)',
  'CREATE INDEX IF NOT EXISTS idx_leads_sync_id ON leads(sync_id)',
  'CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON call_logs(lead_id)',
  'CREATE INDEX IF NOT EXISTS idx_call_logs_user ON call_logs(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_call_logs_sync_id ON call_logs(sync_id)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id)',
  'CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_dnc_phone ON dnc_list(phone)',
  'CREATE INDEX IF NOT EXISTS idx_campaigns_sync_id ON campaigns(sync_id)',
  'CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status)',
  'CREATE INDEX IF NOT EXISTS idx_prospects_phone ON prospects(phone)',
  'CREATE INDEX IF NOT EXISTS idx_prospects_campaign ON prospects(campaign_id)',
  'CREATE INDEX IF NOT EXISTS idx_prospects_sync_id ON prospects(sync_id)',
];

for (const stmt of indexStatements) {
  try {
    db.exec(stmt);
  } catch {}
}

console.log('[db] database initialized and migrated');

export default db;
