# twenty-dialer

A browser-based cold calling dialer with direct integration to Twenty CRM. Designed for sales teams to manage outbound calling campaigns with prospects and leads.

[![License: MIT](https://img.shields.io/badge/LICENSE-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

---

## Overview

twenty-dialer is a self-hosted cold calling application that integrates directly with Twenty CRM via REST API. It provides:

- Browser-based softphone via SIP/WebRTC
- Prospect and lead lifecycle management
- Campaign organization with dynamic status options
- Call logging and script management
- Industry tracking for prospects and leads

**Key distinction:** twenty-dialer uses Twenty's `coldCallStatus` field for manual cold calling workflows, separate from the automated SMS/video pipeline.

---

## Features

- **Browser Softphone** — WebRTC/SIP calling directly from the browser
- **Prospect Management** — Full CRUD for cold call targets with industry tracking
- **Lead Management** — Track converted prospects with detailed history
- **Campaign Organization** — Group calls by campaign with status management
- **Call Logging** — Record outcomes, durations, and notes
- **Script Templates** — Objection handling for common scenarios
- **Twenty CRM Sync** — Direct REST API integration with Twenty
- **Dynamic Status Options** — Statuses fetched from Twenty metadata API
- **REST API** — Full API for integrations

---

## Architecture

```mermaid
flowchart TB
    subgraph frontend [Frontend - React/Vite]
        ProspectsPage[Prospects Page]
        LeadsPage[Leads Page]
        CampaignsPage[Campaigns Page]
        Softphone[Softphone UI]
        CallHistory[Call History]
    end

    subgraph backend [Backend - Express/TypeScript]
        API[REST API]
        TwentyClient[Twenty Client]
        Auth[Auth Middleware]
        TelnyxLib[Telnyx SDK Client]
    end

    subgraph twenty [Twenty CRM]
        agencyProspects[agencyProspects]
        agencyLeads[agencyLeads]
        agencyCampaigns[agencyCampaigns]
        agencyScripts[agencyScripts]
        agencyPhones[agencyPhones]
        agencyCalls[agencyCalls]
        Metadata[Metadata API]
    end

    subgraph telnyx [Telnyx]
        SIP[SIP Trunking]
        VoiceAPI[Call Control + Recordings]
        Webhooks[Voice Webhooks]
    end

    ProspectsPage -->|HTTP| API
    LeadsPage -->|HTTP| API
    CampaignsPage -->|HTTP| API
    CallHistory -->|HTTP| API
    Softphone -->|SIP/WebRTC| SIP
    Softphone -->|claim/release| API

    API -->|CRUD| TwentyClient
    API -->|record/reconcile| TelnyxLib
    TwentyClient -->|REST API| agencyProspects
    TwentyClient -->|REST API| agencyLeads
    TwentyClient -->|REST API| agencyCampaigns
    TwentyClient -->|REST API| agencyScripts
    TwentyClient -->|REST API| agencyPhones
    TwentyClient -->|REST API| agencyCalls
    TwentyClient -->|Metadata| Metadata
    TelnyxLib -->|record_start + recordings| VoiceAPI
    Webhooks -->|recording/transcript saved| Receiver[Vercel Receiver]
    Receiver -->|attach recording| agencyCalls
```

### Data Flow

```
User Action (Prospect/Lead/Campaign)
         ↓
    Frontend React UI
         ↓
    REST API (Express)
         ↓
    Twenty Client
         ↓
    Twenty CRM (REST API)
```

### Call Flow (dial → talk → log → recording)

```
Dial → POST /api/twenty/phones/:id/claim (409 if held)
  → agencyCalls row created (IN_PROGRESS)
  → SIP INVITE via Telnyx (wss://sip.telnyx.com:7443)
  → 200 OK: capture X-Telnyx-Call-Control-ID
  → POST /api/calls/:id/record (Telnyx record_start + transcription)
  → state ACTIVE → talk → BYE → row COMPLETED + debugLog
  → Save disposition → PATCH status → POST /api/twenty/phones/:id/release
  → Telnyx call.recording.saved → Vercel receiver attaches mp3
  → call.recording.transcription.saved → transcript attached
  → play any time via GET /api/calls/:id/audio (fresh Telnyx URL, key stays server-side)
```

### Deployments

| Piece | Where | Notes |
|---|---|---|
| SPA (+ Telnyx webhook receiver) | Vercel (`open-twenty-dialer`) | Auto-deploys on push to `main`. Needs project envs: `VITE_API_URL`, `VITE_SIP_*`, `TWENTY_BASE_URL`, `TWENTY_API_KEY`, `TELNYX_WEBHOOK_TOKEN`. `VITE_*` bake in at build time. |
| Express backend | node01 Docker (`dialer-backend`), public via Tailscale Funnel | `~/services/dialer` on node01, same repo. Needs `TWENTY_*`, `TELNYX_API_KEY`, `JWT_SECRET` in its `.env`. |
| Self-contained app | Railcode (`cold-dialer`) | Hono worker + UI in `cold-dialer/`, mirrors the Express routes. |
| Telnyx wiring | Mission Control | Number → messaging profile + voice connection; connection `webhook_event_url` → Vercel receiver; `conversation_persistence: true` for transcripts. |

---

## Isolated Workspaces via Railcode

### What Railcode is

Railcode (https://railcode.dev) is a secure cloud for **internal software**:
every app is a static frontend plus a backend worker deployed and versioned
as one unit, and every viewer must be a signed-in org member — no anonymous
access, no public endpoints. The worker (not the browser) holds authority:
it sees a verified caller (`ctx.user`), keeps per-app secrets, and reaches
the outside world through declared `egress` hosts or org **connectors**.
Cron, KV/file stores, LLM gateway, and email are platform primitives the
worker calls with `@railcode/sdk`.

### How we've implemented it here

`cold-dialer/` is a Railcode apps-v2 app (`hono+vite`) — the isolated,
always-on workspace for this repo. Live (private, owner-only):
`https://cold-dialer.listeningkit.railcode.app/`, embedded in the Twenty
dashboard as an iframe widget.

```mermaid
flowchart LR
    Browser["Browser (org member)"]
    App["Railcode app<br/>static frontend + Hono worker"]
    Conn["org connector 'twenty'<br/>HTTP + bearer"]
    Twenty["Twenty CRM<br/>REST"]
    Dash["Twenty dashboard<br/>iframe widget"]

    Browser --> App
    App -->|"connector('twenty').fetch()"| Conn
    Conn --> Twenty
    Dash -.->|"embeds /dashboard?embed=1"| App
```

- **Twenty access goes through the org `twenty` HTTP connector**
  (`connectors: { twenty: ["*"] }` in `manifest.yaml`, `run_as: app`).
  The worker holds no API key. Critical detail: the connector's base URL
  already ends in `/rest`, so worker paths must NOT add the prefix
  (`/metadata/objects`, never `/rest/metadata/objects` — the doubled path
  400s). See `server/lib/twenty.ts`.
- **Auth is the platform session.** The old JWT/password flow is gone:
  `GET /api/auth/me` returns `ctx.user`; the frontend signs in via the org.
- **Listing the whole collection.** This Twenty version ignores cursor
  params (`startingAfter`/`offset`/`page` all return page 1) and caps pages
  at 200 records. The worker therefore walks `id` strictly ascending
  (`orderBy=id[AscNullsFirst]` + `filter=id[gt]:<last id>`, 200/page,
  bounded) and returns full arrays — the client never paginates. Verified:
  741/741 prospects, zero dupes. See `listTwentyPage()` in
  `server/lib/twenty.ts`.
- **Twenty-grade tables.** Headers reorder with dnd-kit sortable locked to
  the x-axis (Name pinned first, 6px drag activation so clicks keep
  working), drop commits on release with a blue insertion edge and a
  floating overlay, and persist per page. Edge resize handles mutate
  `--col-<key>` CSS variables on the `<table>` directly — zero React
  re-renders mid-drag, 80px min width, persisted on pointer-up. Status
  filtering uses a floating Twenty-style panel (search + dot/check rows),
  not a native select.
- **Styling gotcha (fixed, documented so it stays fixed).** Tailwind
  resolves `content` globs and its config relative to the **process cwd**
  (the app root), not the Vite root — so `tailwind.config.js` lives at
  `cold-dialer/tailwind.config.js` with `./frontend/...` globs. With the
  config inside `frontend/`, Tailwind silently emitted preflight only
  (6.8KB, zero utilities).

```bash
cd cold-dialer
npm install
railcode dev --port 5235      # local frontend + worker
railcode manifest validate
railcode deploy --private     # railcode apps set-access to open to the org
railcode logs app --app cold-dialer   # worker invocations
```

What stays off Railcode: the node01 Express backend (`backend/`, local/dev
use) and anything anonymous — Railcode cannot serve public traffic, so
public funnels live elsewhere (e.g. Vercel).

---

## Twenty CRM Objects

The following custom objects are used in Twenty CRM:

### agencyProspects

Template-site prospect rows. Represents discovered business targets for cold calling.

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Full company name |
| `phone` | TEXT | Primary phone number |
| `email` | TEXT | Business email address |
| `website` | TEXT | Company website URL |
| `fullAddress` | TEXT | Full address (comma-separated) |
| `city` | TEXT | City name |
| `region` | TEXT | State/region |
| `country` | TEXT | Country code (US) |
| `niche` | TEXT | Industry/type (e.g., "Auto Paint & Body Shops") |
| `rating` | NUMBER | Google review rating |
| `reviewCount` | NUMBER | Number of reviews |
| `coldCallStatus` | SELECT | Call status (see Status Mapping below) |
| `outboundState` | TEXT | Call outcome tracking |
| `outboundLabel` | TEXT | Call notes/label |
| `externalId` | TEXT | Source system identifier |
| `utmSource` | TEXT | Campaign source (outbound/inbound) |
| `campaignId` | RELATION | Link to agencyCampaign |

### agencyLeads

Converted prospects that have shown interest.

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Full contact name |
| `contactName` | TEXT | Alternative contact name |
| `email` | TEXT | Email address |
| `phone` | TEXT | Phone number |
| `company` | TEXT | Company name |
| `source` | TEXT | Lead source |
| `note` | TEXT | Call notes |
| `status` | TEXT | Lead status |
| `coldCallStatus` | SELECT | Cold call status |
| `createdById` | TEXT | Campaign ID reference |
| `campaignId` | RELATION | Link to agencyCampaign |

### agencyCampaigns

Campaign definitions for organizing calling efforts.

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Campaign name |
| `status` | SELECT | Campaign status (see Status Mapping below) |
| `campaignType` | SELECT | Campaign type (see Status Mapping below) |
| `note` | TEXT | Campaign notes/settings (JSON) |
| `utmSource` | TEXT | Campaign source tracking |

### agencyScripts

Call scripts linked to campaigns.

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Script name |
| `scriptData` | TEXT | JSON with script content + objection responses |
| `campaignId` | RELATION | Link to agencyCampaign (uses `campaignIdId` in REST API) |

### agencyPhones

Sending numbers (Telnyx inventory mirrored into Twenty). One member holds a
number for the duration of a call — enforced by claim endpoints, visible live
in the dial UI and on Phone Numbers.

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `phoneNumber` | TEXT | E.164 number |
| `name` | TEXT | Display name (e.g. "ListeningKit Philly") |
| `countryCode` | TEXT | ISO alpha-2 (IE/US) |
| `numberType` | SELECT | LONG_CODE / TOLL_FREE / SHORT_CODE |
| `state` | SELECT | ACTIVE / PAUSED / DEGRADED / RETIRED (provisioning) |
| `messagingProfileId` | TEXT | Telnyx messaging profile for SMS |
| `callState` | SELECT | **Claim state:** IDLE / DIALING / ACTIVE |
| `claimedByMemberId` | TEXT | Twenty user id holding the number |
| `claimedByEmail` | TEXT | Holder email (shown in UI) |
| `claimedAt` | DATE_TIME | When the claim started |
| `currentCallId` | TEXT | Latest agencyCalls row for traceability |
| `lastSyncedAt` | TEXT | Last backend sync timestamp |

Claim protocol: `claim` (IDLE → DIALING, 409 `heldBy` when taken) →
`state` (DIALING → ACTIVE on SIP Established) → `release` (→ IDLE, holder-only
unless `force`). Same member may re-claim (idempotent redial).

### agencyCalls

One row per dialed call, from first ring to wrap-up and beyond.

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `direction` | SELECT | INBOUND / OUTBOUND / MISSED |
| `status` | SELECT | IN_PROGRESS / COMPLETED / FAILED / NO_ANSWER / BUSY |
| `fromNumber` / `toNumber` | TEXT | E.164 parties |
| `startedAt` / `endedAt` | DATE_TIME | Call window |
| `durationSeconds` | NUMBER | Talk time |
| `telnyxCallId` | TEXT | Telnyx call-control-id (captured from 200 OK) |
| `telnyxRecordingId` | TEXT | Telnyx recording id |
| `recordingUrl` | TEXT | Last known mp3 URL (expires — play via `/api/calls/:id/audio`) |
| `transcript` | TEXT | Telnyx transcription |
| `transcriptionStatus` | SELECT | NONE / PENDING / READY / FAILED |
| `summary` | TEXT | Agent/AI notes |
| `debugLog` | TEXT | SIP event trail JSON (post-mortem) |
| `meetingUrl` / `meetingProvider` / `meetingAt` / `meetingStatus` / `meetingBookingId` | TEXT / SELECT / DATE_TIME / SELECT / TEXT | Future meeting booked from the call |
| `agencyPhone` / `agencyProspect` / `agencyLead` | RELATION | MANY_TO_ONE links (write via `agencyPhoneId` etc.) |

> Relations via REST metadata must be created with `POST /rest/metadata/fields`
> (the GraphQL path rejects `relationCreationPayload`).

---

## Relations Between Objects

### Campaign Relations

All three custom objects (`agencyProspects`, `agencyLeads`, `agencyScripts`) can be linked to campaigns via the `campaignId` relation field.

### Call Relations

Each `agencyCalls` row links to the number used plus the record dialed:

```typescript
// At dial time (row created IN_PROGRESS):
{ agencyPhoneId: "<agencyPhones id>", agencyProspectId: "<id>" /* or agencyLeadId */ }

// After answer (correlation for recordings + webhooks):
{ telnyxCallId: "v3:..." }
```

**Important:** Twenty uses the `{fieldName}Id` pattern for relation fields in REST API operations:

```typescript
// To link a prospect to a campaign:
{ campaignIdId: "0181d430-880f-4c9e-b919-e224a39df574" }

// To unlink:
{ campaignIdId: null }
```

### Frontend Integration

The `CallScriptViewer` component automatically loads scripts based on the campaign ID from the lead or prospect:

```tsx
// LeadDetailPage.tsx
<CallScriptViewer 
  onClose={() => setShowScript(false)} 
  campaignId={lead?.campaignIdId ?? null} 
/>

// ProspectDetailPage.tsx
<CallScriptViewer 
  onClose={() => setShowScript(false)} 
  campaignId={prospect?.campaignIdId ?? null} 
 />
```

### Creating Relation Fields

To add a new relation field via GraphQL:

```graphql
mutation {
  createOneField(input: {
    field: {
      objectMetadataId: "<object-id>"
      type: RELATION
      name: "campaignId"
      label: "Campaign"
      isNullable: true
      settings: {
        relationType: "MANY_TO_ONE"
        onDelete: "SET_NULL"
        joinColumnName: "campaignIdId"
      }
      relationCreationPayload: {
        targetObjectMetadataId: "<campaign-object-id>"
        targetFieldLabel: "Scripts"
        targetFieldIcon: "IconFileText"
        type: "MANY_TO_ONE"
      }
    }
  }) {
    id
    name
  }
}
```

---

## Status Mapping

### agencyProspects.coldCallStatus

| Value | Display | Meaning |
|-------|---------|---------|
| `NEW` | New | Fresh prospect, no contact made |
| `CONTACTED` | Contacted | Initial contact made |
| `INTERESTED` | Interested | Prospect showed interest |
| `NOT_INTERESTED` | Not Interested | Prospect declined |
| `CALLBACK` | Callback | Scheduled callback needed |
| `CONVERTED` | Converted | Became a lead |
| `DO_NOT_CONTACT` | Do Not Contact | DNC flagged |

### agencyCampaigns.status

| Value | Display | Meaning |
|-------|---------|---------|
| `ACTIVE` | Active | Campaign is running |
| `INACTIVE` | Paused | Campaign is paused |
| `DRAFT` | Draft | Campaign not yet started |

### agencyCampaigns.campaignType

| Value | Display |
|-------|---------|
| `OUTBOUND` | Outbound |
| `INBOUND` | Inbound |
| `BLENDED` | Blended |
| `REFERRAL` | Referral |
| `COLD_CALL` | Cold Call |
| `WEBSITE` | Website |
| `TWENTY_IMPORT` | Twenty Import |
| `OTHER` | Other |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Twenty CRM instance with custom objects configured
- SIP provider (SignalWire, Telnyx, Twilio, or any SIP server)

### Installation

```bash
git clone https://github.com/matthewdonsemail-lab/open-twenty-dialer.git
cd open-twenty-dialer
```

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env.local
# Edit .env.local with your configuration
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with VITE_API_URL=http://localhost:4000
npm run dev
```

Open http://localhost:3000

### Docker Deployment

```bash
docker compose up -d
docker compose exec backend npm run seed
```

---

## Configuration

### Environment Variables

Create `.env.local` in the respective directory:

**Backend (.env.local):**
```env
# Twenty CRM (required)
TWENTY_BASE_URL=https://twenty.inferencesaver.com
TWENTY_API_KEY=your-api-key-here

# Twenty Postgres — for user verification (local dev goes through the SSH
# tunnel because the tailnet ACL blocks direct 5432: localhost:5433 -> node01)
# Tunnel: ssh -L 5433:localhost:5432 -N deepman@100.98.241.63
TWENTY_DATABASE_URL=postgres://twenty:xxx@127.0.0.1:5433/twenty

# Sync settings
SYNC_POLL_INTERVAL_MS=30000

# Backend
PORT=4000
JWT_SECRET=your-jwt-secret-here

# Telnyx (SMS/Voice/Call Control — server-side only, never VITE_)
TELNYX_API_KEY=...
TELNYX_MESSAGING_PROFILE_ID=...
TELNYX_MESSAGING_PROFILE_US=...
TELNYX_WEBHOOK_TOKEN=...   # shared gate for the Vercel receiver (?token=)

# Twenty member login (local testing + scripts)
TWENTY_USER_EMAIL=...
TWENTY_USER_PASSWORD=...
```

**Frontend (.env.local):**
```env
VITE_API_URL=http://localhost:4000
# Telnyx SIP (baked into the SPA bundle at build time)
VITE_SIP_URI=sip:username@sip.telnyx.com
VITE_SIP_PASSWORD=your-sip-password
VITE_SIP_WS_URL=wss://sip.telnyx.com:7443
VITE_SIP_CALLER_ID=+1XXXXXXXXXX
VITE_SIP_PROVIDER=telnyx
```

### SIP Configuration

Works with SignalWire, Telnyx, Twilio, Asterisk, FreeSWITCH, or any SIP server.

See [SIP Providers Guide](docs/sip-providers.md) for detailed setup.

---

## Project Structure

```
open-twenty-dialer/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── lib/               # Twenty client, logger
│   │   ├── middleware/        # Auth middleware
│   │   └── routes/            # REST API routes
│   │       ├── auth.ts
│   │       ├── campaigns.ts
│   │       ├── leads.ts
│   │       ├── prospects.ts
│   │       ├── scripts.ts
│   │       ├── twentyMeta.ts
│   │       └── twentyPhones.ts
│   └── .env.example
├── frontend/                   # React/Vite SPA
│   └── src/
│       ├── components/        # UI components
│       ├── hooks/             # React Query hooks
│       ├── lib/               # API client, utilities
│       └── pages/             # Route pages
│           ├── CampaignPage.tsx
│           ├── LeadDetailPage.tsx
│           ├── LeadsPage.tsx
│           ├── ProspectDetailPage.tsx
│           ├── ProspectPage.tsx
│           └── ScriptsPage.tsx
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Get current user |

### Prospects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prospects` | List all prospects |
| GET | `/api/prospects/:id` | Get single prospect |
| POST | `/api/prospects` | Create prospect |
| PATCH | `/api/prospects/:id` | Update prospect |
| DELETE | `/api/prospects/:id` | Delete prospect |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List all leads |
| GET | `/api/leads/:id` | Get single lead |
| POST | `/api/leads` | Create lead |
| PATCH | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get single campaign |
| POST | `/api/campaigns` | Create campaign |
| PATCH | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |

### Scripts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scripts` | List all scripts |
| GET | `/api/scripts/:id` | Get single script |
| POST | `/api/scripts` | Create script |
| PATCH | `/api/scripts/:id` | Update script |
| DELETE | `/api/scripts/:id` | Delete script |

### Twenty Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/twenty/meta/:object` | Get field metadata for object |
| GET | `/api/twenty/phones` | List available phone numbers (with live claim state) |
| POST | `/api/twenty/phones/:id/claim` | Claim a number (`memberId`, `memberEmail`; 409 `heldBy` when taken) |
| POST | `/api/twenty/phones/:id/state` | Set DIALING/ACTIVE (holder only) |
| POST | `/api/twenty/phones/:id/release` | Release to IDLE (holder only, unless `force`) |

### Calls

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calls` | List calls, newest first |
| GET | `/api/calls/:id` | Get single call |
| POST | `/api/calls` | Log a call (creates `agencyCalls` row) |
| PATCH | `/api/calls/:id` | Update (disposition, recording, transcript, meeting link, debugLog) |
| POST | `/api/calls/:id/record` | Start Telnyx server recording + transcription |
| POST | `/api/calls/:id/reconcile` | Match Telnyx recording by from/to/time when no call-control-id |
| GET | `/api/calls/:id/audio` | Redirect to a fresh Telnyx mp3 (key stays server-side) |

### Diagnostics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health + Twenty config flags |
| GET | `/api/netcheck?host=&port=` | SIP reachability probe (allowlisted hosts only) |
| POST | `/api/telnyx-webhook?token=` | Telnyx events (Vercel serverless, not Express) |

---

## Twenty CRM Setup

### Option 1: Via API (Recommended)

The backend provides an endpoint to automatically create all required Twenty CRM objects and fields:

```bash
# Setup Twenty CRM objects and fields
curl.exe -X POST "http://localhost:4000/api/setup/twenty" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

This will create:
- `agencyProspects` object with `coldCallStatus` and `utmSource` fields
- `agencyLeads` object
- `agencyCampaigns` object with `status` and `campaignType` fields
- `agencyScripts` object

### Option 2: Via GraphQL (Manual)

To set up the required custom objects in Twenty CRM, use the GraphQL metadata API:

```graphql
mutation {
  createOneObject(input: {
    object: {
      nameSingular: "agencyProspect"
      namePlural: "agencyProspects"
      labelSingular: "Prospect"
      labelPlural: "Prospects"
      description: "Cold call prospects"
      icon: "IconBuildingSkyscraper"
      isLabelSyncedWithName: false
    }
  }) {
    id
    nameSingular
  }
}
```

Repeat for `agencyLeads`, `agencyCampaigns`, and `agencyScripts`.

### Adding SELECT Fields

Create SELECT fields using the metadata API. Example for campaign status:

```graphql
mutation {
  createOneField(input: {
    field: {
      objectMetadataId: "<campaign-object-id>"
      type: SELECT
      name: "status"
      label: "Status"
      isNullable: true
      options: [
        { label: "Active", value: "ACTIVE", color: "green", position: 0 }
        { label: "Inactive", value: "INACTIVE", color: "gray", position: 1 }
        { label: "Draft", value: "DRAFT", color: "amber", position: 2 }
      ]
    }
  }) {
    id
    name
  }
}
```

See [Twenty Metadata API Reference](docs/twenty-workflows/metadata-operations.md) for full details.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Troubleshooting

### Twenty CRM API 401/403 Errors

**Problem:** Getting `401 Authorization Required` or `403 Missing authentication token` from Twenty CRM endpoints.

**Solution:** This is almost always an nginx proxy misconfiguration on the server. Check these common issues:

#### 1. Nginx Proxy Port Mismatch (Most Common)

The `auth-guard` container (nginx) must proxy Twenty requests to the correct port.

```nginx
# CORRECT - actual Twenty server port
proxy_pass http://127.0.0.1:3005;
```

**Fix:** Update the nginx config in `/home/deepman/services/auth-guard/nginx.conf` and restart:

```bash
tailscale ssh deepman@node01 "docker restart auth-guard"
```

#### 2. Verify API Key is Valid

Test your API key directly against Twenty:

```bash
curl.exe -s "https://twenty.inferencesaver.com/rest/agencyProspects?limit=1" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Should return `200 OK` with data or empty array, NOT `401` or `403`.

#### 3. Check Twenty Server Status

Ensure Twenty containers are running:

```bash
docker ps | grep twenty
# Should show: twenty-server, twenty-worker, twenty-postgres, twenty-redis
```

If server is down:

```bash
cd /home/deepman/services/twenty
docker compose up -d server
```

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Authorization Required` | Wrong API key or expired token | Generate new key in Twenty UI |
| `403 Missing authentication token` | Nginx not forwarding Authorization header | Check nginx proxy-params.conf |
| `502 Bad Gateway` | Nginx pointing to wrong port | Update proxy_pass to port 3005 |
| `504 Gateway Timeout` | Twenty server not responding | Check if twenty-server container is running |

---

## Documentation

- [SIP Providers Guide](docs/sip-providers.md) — Configure your SIP provider
- [Twenty CRM Integration](docs/twenty-integration.md) — Sync configuration guide
- [Twenty Troubleshooting](docs/twenty-troubleshooting.md) — Common issues and fixes

---

## Future Improvements

### Twenty CRM SDK Integration

**Goal:** Migrate from custom fetch-based implementation to Twenty's official SDK for better type safety and maintainability.

**What we tried:**
1. Installed `twenty-client-sdk` package
2. Attempted to use `RestApiClient` from `twenty-client-sdk/rest`
3. Created TypeScript interfaces in `backend/src/types/twenty.ts`
4. Updated all route handlers to use typed responses

**Why it didn't work:**
- The SDK's `RestApiClient` returns responses in a different format than raw fetch
- Response parsing broke — all queries returned 0 records
- The SDK wraps responses differently than Twenty's native API format

**Lessons learned:**
- Twenty's REST API returns: `{ data: { agencyProspects: [...] }, totalCount: N, pageInfo: {...} }`
- The SDK's response shape didn't match our extraction logic
- For now, keeping the custom fetch-based implementation works reliably

**To try again in the future:**
```bash
# Install the SDK
cd backend
npm install twenty-client-sdk

# Generate typed clients
npx twenty dev:generate-client --remote https://twenty.yourdomain.com --api-key YOUR_KEY
```

**Key findings from the migration attempt:**
- Twenty uses `{fieldName}Id` pattern for relation fields in REST API (e.g., `campaignIdId`)
- GraphQL mutations work for metadata operations (creating objects/fields)
- The `twentyClient` object should export both named functions AND an object wrapper
- Response parsing must handle multiple shapes: direct array, `{ data: [...] }`, `{ data: { objectName: [...] } }`
