#!/bin/bash
# Trigger Radar Digest – Scanner + OpenClaw Webhook
# Cron: 0 8,20 * * * cd /path/to/openclaw && ./scripts/trigger-radar-digest.sh
#
# Required in openclaw/.env: OPENCLAW_HOOKS_TOKEN, TELEGRAM_CHAT_ID
# OpenClaw Config: hooks.enabled=true, hooks.token

set -e
cd "$(dirname "$0")/.."

# Load env (if present)
if [ -f .env ]; then
  set -a
  . .env
  set +a
fi

SIGNAL_RADAR_DIR="${SIGNAL_RADAR_DIR:-$(dirname "$(pwd)")/signal-radar}"
OPENCLAW_URL="${OPENCLAW_URL:-http://127.0.0.1:18789}"

if [ -z "$OPENCLAW_HOOKS_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "Missing: OPENCLAW_HOOKS_TOKEN or TELEGRAM_CHAT_ID in .env" >&2
  exit 1
fi

# 1. Scanner
echo "Running scanner..."
cd "$SIGNAL_RADAR_DIR"
docker-compose run --rm signal-radar
cd - > /dev/null

# 2. Digest via OpenClaw Webhook (docker exec – host curl may reset with gateway)
echo "Triggering digest..."
docker exec openclaw curl -sS -X POST "http://127.0.0.1:18789/hooks/agent" \
  -H "Authorization: Bearer $OPENCLAW_HOOKS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Create a 24h signal digest. Call get_signals with since_days:1, limit:20. Format each: Relevance X/10 | Pain Y/10, Title, Insight (1 sentence), Emotion, Link. Reply ONLY with the formatted digest.\",\"name\":\"Radar Digest\",\"deliver\":true,\"channel\":\"telegram\",\"to\":\"$TELEGRAM_CHAT_ID\"}"

echo ""
echo "Digest webhook sent (202 = OK)."
