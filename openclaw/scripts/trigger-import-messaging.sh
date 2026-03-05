#!/bin/bash
# Import messaging/*.md → Postgres messaging table
# Uses signal-radar container (has Node + pg)
#
# Usage:
#   ./scripts/trigger-import-messaging.sh         # Upsert
#   ./scripts/trigger-import-messaging.sh --replace  # Clear, then import

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  . .env
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set (in .env)" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SIGNAL_RADAR_DIR="${SIGNAL_RADAR_DIR:-$(dirname "$(pwd)")/signal-radar}"
NETWORK="${SCANNER_NETWORK:-radar-net}"

docker run --rm \
  -v "$SCRIPT_DIR/../messaging:/messaging:ro" \
  -v "$SCRIPT_DIR/import-messaging.js:/app/import-messaging.js:ro" \
  --network "$NETWORK" \
  -e DATABASE_URL \
  -e MESSAGING_DIR=/messaging \
  -w /app \
  signal-radar_signal-radar \
  node import-messaging.js "$@"
