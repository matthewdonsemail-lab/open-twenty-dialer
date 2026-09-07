---
title: "Twenty CRM Troubleshooting Guide"
tags: [troubleshooting, twenty, nginx, api]
status: active
created: 2026-09-07
---

# Twenty CRM Integration Troubleshooting

## Common Issues and Fixes

### 1. Nginx Proxy Port Misconfiguration (Most Common)

**Symptom:** Getting `502 Bad Gateway` or requests not reaching Twenty server.

**Root Cause:** The `auth-guard` nginx container was pointing to port `13000` instead of `3005`.

**Fix:**
1. Update nginx config at `/home/deepman/services/auth-guard/nginx.conf`
2. Change all instances of `proxy_pass http://127.0.0.1:13000;` to `proxy_pass http://127.0.0.1:3005;`
3. Restart the container: `docker restart auth-guard`

**Example nginx config:**
```nginx
server {
    listen 3000 default_server;
    
    # Proxy API endpoints to Twenty
    location ~ ^/(rest|graphql|metadata|webhooks)(/|$) {
        proxy_pass http://127.0.0.1:3005;  # NOT 13000
        include /etc/nginx/proxy-params.conf;
    }
    
    location / {
        auth_basic "Internal Administration";
        auth_basic_user_file /etc/nginx/htpasswd;
        proxy_pass http://127.0.0.1:3005;  # NOT 13000
        include /etc/nginx/proxy-params.conf;
    }
}
```

### 2. API Key Authentication Failures

**Symptom:** `401 Authorization Required` or `403 Missing authentication token`

**Check API Key Validity:**
```bash
# Test from node01
curl -s "http://localhost:3005/rest/agencyProspects?limit=1" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Test via nginx proxy
curl -s "https://twenty.inferencesaver.com/rest/agencyProspects?limit=1" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**If API key is invalid/expired:**
1. Log into Twenty UI: `https://twenty.inferencesaver.com`
2. Go to Settings → API Keys
3. Create new key with appropriate expiration
4. Update `.env.local`:
   ```env
   TWENTY_API_KEY=new-key-here
   ```

### 3. Twenty Server Not Running

**Check container status:**
```bash
# On node01
docker ps | grep twenty
```

**Should show:**
- `twenty-server` (Up)
- `twenty-worker` (Up)
- `twenty-postgres` (Up, healthy)
- `twenty-redis` (Up, healthy)

**If server is down:**
```bash
cd /home/deepman/services/twenty
docker compose up -d server
```

### 4. Empty Agency Objects

**Symptom:** API returns empty arrays for `agencyProspects`, `agencyPhones`, etc.

**This is normal** - custom objects need to be created in Twenty first:
1. Log into Twenty UI
2. Go to Settings → Custom Objects
3. Create: `agencyProspects`, `agencyLeads`, `agencyCampaigns`, `agencyPhones`
4. Add fields as needed

### 5. Database Connection Issues

**Test PostgreSQL connection:**
```bash
docker exec twenty-postgres psql -U twenty -d twenty -c "SELECT 1;"
```

**Check schemas:**
```bash
docker exec twenty-postgres psql -U twenty -d twenty -c "\dn"
```

**Expected schemas:**
- `core` - Twenty core tables
- `public` - System tables
- `workspace_*` - Workspace-specific data

### Quick Diagnostic Script

```bash
#!/bin/bash
echo "=== Twenty CRM Status Check ==="
echo ""
echo "1. Container Status:"
docker ps | grep twenty
echo ""
echo "2. API Key Test:"
curl -s -o /dev/null -w "%{http_code}" \
  "https://twenty.inferencesaver.com/rest/agencyProspects?limit=1" \
  -H "Authorization: Bearer $TWENTY_API_KEY"
echo ""
echo ""
echo "3. Nginx Config Check:"
docker exec auth-guard cat /etc/nginx/nginx.conf | grep -A2 "location ~ ^/(rest|graphql)"
echo ""
echo "4. Database Connection:"
docker exec twenty-postgres psql -U twenty -d twenty -c "SELECT count(*) FROM agencyProspects;" 2>&1 | head -3
```

## Files Reference

| File | Location | Purpose |
|------|----------|---------|
| Nginx Config | `/home/deepman/services/auth-guard/nginx.conf` | Reverse proxy rules |
| Proxy Params | `/home/deepman/services/auth-guard/proxy-params.conf` | Headers config |
| Htpasswd | `/home/deepman/services/auth-guard/htpasswd` | Basic auth users |
| Twenty Env | `/home/deepman/services/twenty/.env.local` | Server configuration |
| Dialer Env | `.env.local` | Backend API configuration |

## Common Commands

```bash
# View Twenty server logs
tailscale ssh deepman@node01 "docker logs twenty-server --tail 50"

# View nginx logs
tailscale ssh deepman@node01 "docker logs auth-guard --tail 50"

# Restart services
tailscale ssh deepman@node01 "docker restart auth-guard twenty-server"

# Check API keys in database
tailscale ssh deepman@node01 'docker exec twenty-postgres psql -U twenty -d twenty -c "SELECT id, name, expiresAt FROM core.apiKey;"'
```

## Notes

- The Twenty API uses JWT tokens for authentication
- API keys expire and need to be regenerated
- Custom objects (`agencyProspects`, `agencyPhones`, etc.) must be created in Twenty UI first
- The nginx proxy adds authentication layer (`auth_basic`) for security
