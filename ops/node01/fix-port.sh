#!/bin/bash
set -e

# Find what's using port 3000 and kill it
echo "Checking port 3000..."
PID=$(lsof -ti:3000 2>/dev/null || echo "")
if [ -n "$PID" ]; then
    echo "Killing process $PID using port 3000"
    kill -9 $PID 2>/dev/null || true
    sleep 2
fi

# Also check for any nginx processes on port 3000
NGINX_PIDS=$(pgrep -f "nginx.*3000" 2>/dev/null || echo "")
if [ -n "$NGINX_PIDS" ]; then
    echo "Killing nginx processes"
    killall nginx 2>/dev/null || true
    sleep 1
fi

echo "Port 3000 should be free now"
netstat -tlnp 2>/dev/null | grep :3000 || echo "Port 3000 is free"
