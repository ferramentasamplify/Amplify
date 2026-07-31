#!/usr/bin/env bash
set -euo pipefail

REPO="/root/.openclaw/workspaces/retencao-gabriel/amplify-hub"
SOURCE="$REPO/scripts/build-growth-funnels.js"
ECON_ACQ_SOURCE="$REPO/scripts/build-creator-economics-acquisition.js"
ECON_SOURCE="$REPO/scripts/build-creator-economics.js"
STATE_DIR="/var/lib/amplify-hub"
DEST="$STATE_DIR/growth-funnels-live.json"
ECON_ACQ_DEST="$STATE_DIR/creator-economics-acquisition.json"
ECON_DEST="$STATE_DIR/creator-economics-live.json"
CID="$(docker ps --filter name=n8n_n8n --format '{{.ID}}' | python3 -c 'import sys; print(sys.stdin.readline().strip())')"

if [[ -z "$CID" ]]; then
  echo "n8n container not found" >&2
  exit 1
fi

cleanup() {
  docker exec -u 0 "$CID" rm -f /tmp/build-growth-funnels.js /tmp/build-creator-economics-acquisition.js /tmp/growth-funnels-live.json /tmp/creator-economics-acquisition.json /tmp/creds.json /tmp/bitrix-workflow.json /tmp/export.log >/dev/null 2>&1 || true
  rm -f "$DEST.tmp" "$ECON_ACQ_DEST.tmp" "$ECON_DEST.tmp"
}
trap cleanup EXIT

install -d -m 755 "$STATE_DIR"
docker cp "$SOURCE" "$CID":/tmp/build-growth-funnels.js >/dev/null
docker cp "$ECON_ACQ_SOURCE" "$CID":/tmp/build-creator-economics-acquisition.js >/dev/null
docker exec -u 0 "$CID" chmod 644 /tmp/build-growth-funnels.js /tmp/build-creator-economics-acquisition.js
docker exec "$CID" sh -lc 'set -e; n8n export:credentials --all --decrypted --output=/tmp/creds.json >/tmp/export.log 2>&1; n8n export:workflow --id=A9nStriNOS9QGqOz --output=/tmp/bitrix-workflow.json >>/tmp/export.log 2>&1; FUNNEL_SNAPSHOT_OUTPUT=/tmp/growth-funnels-live.json BITRIX_WORKFLOW_PATH=/tmp/bitrix-workflow.json node /tmp/build-growth-funnels.js; node /tmp/build-creator-economics-acquisition.js > /tmp/creator-economics-acquisition.json'

docker cp "$CID":/tmp/growth-funnels-live.json "$DEST.tmp" >/dev/null
docker cp "$CID":/tmp/creator-economics-acquisition.json "$ECON_ACQ_DEST.tmp" >/dev/null
chmod 644 "$DEST.tmp" "$ECON_ACQ_DEST.tmp"

TIKTOK_REPORTS_DIR="$REPO/data/tiktok-shop-reports/downloads" \
CREATOR_ECONOMICS_ACQUISITION="$ECON_ACQ_DEST.tmp" \
CREATOR_ECONOMICS_OUTPUT="$ECON_DEST.tmp" \
node "$ECON_SOURCE"
chmod 644 "$ECON_DEST.tmp"

mv -f "$DEST.tmp" "$DEST"
mv -f "$ECON_ACQ_DEST.tmp" "$ECON_ACQ_DEST"
mv -f "$ECON_DEST.tmp" "$ECON_DEST"
echo "growth funnels snapshot refreshed: $DEST"
echo "creator economics snapshot refreshed: $ECON_DEST"
