#!/usr/bin/env bash
# Start Expo behind a Cloudflare quick tunnel, for when `expo start --tunnel`
# (ngrok) fails with "remote gone away". Needs `cloudflared` on PATH or in
# ~/.local/bin. The tunnel URL changes on every run; this fills it in.
set -euo pipefail

PORT=8081
CLOUDFLARED=$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")
if [ ! -x "$CLOUDFLARED" ]; then
  echo "cloudflared not found. Install it into ~/.local/bin first." >&2
  exit 1
fi

LOG=$(mktemp)
"$CLOUDFLARED" tunnel --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 &
TUNNEL_PID=$!
trap 'kill $TUNNEL_PID 2>/dev/null; rm -f "$LOG"' EXIT

echo "Starting Cloudflare tunnel…"
URL=""
for _ in $(seq 1 30); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "Tunnel didn't start:" >&2
  cat "$LOG" >&2
  exit 1
fi

echo "Tunnel: $URL"
EXPO_PACKAGER_PROXY_URL="$URL" npx expo start --port "$PORT" "$@"
