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
    end

    subgraph backend [Backend - Express/TypeScript]
        API[REST API]
        TwentyClient[Twenty Client]
        Auth[Auth Middleware]
    end

    subgraph twenty [Twenty CRM]
        agencyProspects[agencyProspects]
        agencyLeads[agencyLeads]
        agencyCampaigns[agencyCampaigns]
        agencyScripts[agencyScripts]
        Metadata[Metadata API]
    end

    ProspectsPage -->|HTTP| API
    LeadsPage -->|HTTP| API
    CampaignsPage -->|HTTP| API
    Softphone -->|SIP/WebRTC| Provider[SIP Provider]

    API -->|CRUD| TwentyClient
    TwentyClient -->|REST API| agencyProspects
    TwentyClient -->|REST API| agencyLeads
    TwentyClient -->|REST API| agencyCampaigns
    TwentyClient -->|REST API| agencyScripts
    TwentyClient -->|Metadata| Metadata
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

---

## Relations Between Objects

### Campaign Relations

All three custom objects (`agencyProspects`, `agencyLeads`, `agencyScripts`) can be linked to campaigns via the `campaignId` relation field.

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

# Twenty Postgres — for user verification
TWENTY_DATABASE_URL=postgres://dialer_ro:your-password@node01:5432/twenty

# Sync settings
SYNC_POLL_INTERVAL_MS=30000

# Backend
PORT=4000
JWT_SECRET=your-jwt-secret-here
```

**Frontend (.env.local):**
```env
VITE_API_URL=http://localhost:4000
VITE_SIP_URI=sip:your-extension@your-domain.sip.signalwire.com
VITE_SIP_PASSWORD=your-password
VITE_SIP_WS_URL=wss://your-domain.sip.signalwire.com
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
| GET | `/api/twenty/phones` | List available phone numbers |

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
