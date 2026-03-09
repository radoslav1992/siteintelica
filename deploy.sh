#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="siteintelica"
HOST="127.0.0.1"
PORT=4321

echo "==> Pulling latest changes..."
cd "$APP_DIR"
git pull --ff-only

echo "==> Installing dependencies..."
npm ci --omit=dev

echo "==> Building production bundle..."
npm run build

echo "==> Restarting $APP_NAME process..."
if command -v pm2 &>/dev/null; then
  pm2 describe "$APP_NAME" &>/dev/null && pm2 restart "$APP_NAME" \
    || pm2 start dist/server/entry.mjs --name "$APP_NAME" -- --host "$HOST" --port "$PORT"
  pm2 save
else
  # Fallback: kill existing process and start fresh
  pkill -f "node.*dist/server/entry.mjs" 2>/dev/null || true
  sleep 1
  HOST="$HOST" PORT="$PORT" nohup node dist/server/entry.mjs > /tmp/${APP_NAME}.log 2>&1 &
  echo "    PID: $!"
fi

echo "==> Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "==> Deploy complete. App running on $HOST:$PORT"
