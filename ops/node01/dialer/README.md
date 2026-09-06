# Open Twenty Dialer — Deployment to node01

## Quick Start

```bash
# 1. Copy the dialer directory to node01
scp -r ops/node01/dialer deepman@node01:~/services/

# 2. SSH into node01
tailscale ssh deepman@node01

# 3. Navigate to the dialer directory
cd ~/services/dialer

# 4. Create .env file with your credentials
cat > .env << 'EOF'
TWENTY_API_KEY=your-twenty-api-key-here
JWT_SECRET=your-random-secret-string-here
EOF

# 5. Build and start the containers
docker compose up -d --build

# 6. Verify it's running
docker compose ps
```

## Access Points

Once deployed, the dialer is accessible at:

- **Frontend**: `http://node01.tail4fcf85.ts.net:3000` (via Tailscale)
- **Backend API**: `http://node01.tail4fcf85.ts.net:4000/api/health`

## Iframe Embedding in Twenty

To embed the dialer inside Twenty as an iframe:

```html
<iframe 
  src="https://node01.tail4fcf85.ts.net:3000" 
  width="100%" 
  height="800px"
  frameborder="0"
  allowfullscreen
></iframe>
```

The nginx config already sets the proper CSP headers for iframe embedding.

## Tailscale Serve (Optional)

For a cleaner URL, you can use `tailscale serve`:

```bash
# On node01
tailscale serve --bg http://localhost:3000
```

This exposes the dialer at `http://dialer.tail4fcf85.ts.net` (tailnet-only).

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TWENTY_BASE_URL` | Your Twenty instance URL | Yes |
| `TWENTY_API_KEY` | Twenty API key for sync operations | Yes |
| `TWENTY_DATABASE_URL` | Postgres connection (auto-configured) | Yes |
| `PORT` | Backend port (default: 4000) | No |
| `JWT_SECRET` | Secret for signing JWT tokens | Yes |
| `SYNC_POLL_INTERVAL_MS` | How often to sync with Twenty | No |

## Troubleshooting

### Connection Refused to Postgres

If you see "ECONNREFUSED" errors, ensure:
1. The dialer container is on the same Docker network as Twenty (`twenty_default`)
2. The Postgres password is correct in the `.env` file

### CORS Errors

The frontend should proxy API requests through nginx. If you see CORS errors:
1. Check that the frontend is accessing `/api/` paths (not direct backend URLs)
2. Verify the nginx proxy configuration

### Authentication Failures

If login fails with "Invalid credentials":
1. Verify the email exists in Twenty (`admin@inferencesaver.com` by default)
2. Check that the password matches Twenty's password (not a separate dialer password)
3. Ensure the Twenty API key has read access to the user table

## Updating the Dialer

```bash
cd ~/services/dialer
git pull origin main
docker compose down
docker compose up -d --build
```
