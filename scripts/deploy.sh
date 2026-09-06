#!/bin/bash
set -e

echo "=== Open Twenty Dialer - Deploy Script ==="

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
HOSTINGER_DIR="$PROJECT_DIR/hostinger"

echo "Building frontend..."
cd "$FRONTEND_DIR"
npm run build

echo "Copying dist to Hostinger directory..."
mkdir -p "$HOSTINGER_DIR"
rm -rf "$HOSTINGER_DIR"/*
cp -r "$FRONTEND_DIR/dist/"* "$HOSTINGER_DIR/"

echo "Deploying to Hostinger..."
echo "Upload contents of $HOSTINGER_DIR to your Hostinger public_html/"
echo ""
echo "Don't forget to set environment variables in .env.local:"
echo "  VITE_API_URL=https://your-api-domain.com"
echo ""
echo "=== Deployment Complete ==="
