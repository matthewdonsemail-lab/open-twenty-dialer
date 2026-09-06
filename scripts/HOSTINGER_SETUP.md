# Hostinger Deployment Guide

## Prerequisites
- A Hostinger hosting plan with PHP support
- Domain pointing to your Hostinger server
- Access to Hostinger hPanel

## Steps

### 1. Deploy the Frontend

```bash
cd frontend
npm run build
```

Upload the contents of `frontend/dist/` to your Hostinger `public_html/` directory via FTP/cPanel File Manager or hPanel File Manager.

### 2. Environment Variables

Create a `.htaccess` file in your `public_html/` root with these lines:

```
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
RewriteCond %{REQUEST_URI} !^/api/
RewriteRule ^(.*)$ /index.html [L]
```

Note: The API URL is embedded at build time via `.env.local`. You need to rebuild if you change it.

### 3. Backend Setup

Deploy the backend to your server:

```bash
cd backend
npm install
npm run build
npm run start
```

Or use Docker:

```bash
cp .env.example .env.local
# Edit .env.local with your Twenty credentials
docker compose up -d
```

### 4. Twenty Configuration

1. Ensure you have a Twenty CRM instance running
2. Create API keys for the dialer in Twenty (Settings → API Keys)
3. The dialer will use Twenty credentials for authentication

### 5. Verify

- Visit your domain
- You should see the login page
- Log in with your Twenty credentials

## File Structure for Hostinger

```
public_html/
├── index.html
├── assets/
│   ├── index-*.js
│   ├── index-*.css
│   └── vite.svg
├── .htaccess
└── (all other static assets from dist/)
```
