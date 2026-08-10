#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTANCE="${GCE_INSTANCE:-integ-prod}"
ZONE="${GCE_ZONE:-asia-southeast1-b}"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

git -C "$ROOT_DIR" diff --quiet
git -C "$ROOT_DIR" diff --cached --quiet

COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
VERSION="${VERSION:-$(date -u +%Y%m%d-%H%M%S)}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

cd "$ROOT_DIR/backend"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath \
  -ldflags "-s -w -X main.version=${VERSION} -X main.buildTime=${BUILD_TIME} -X main.commit=${COMMIT}" \
  -o "$BUILD_DIR/chess-backend" ./cmd/server

gcloud compute scp --zone "$ZONE" --tunnel-through-iap \
  "$BUILD_DIR/chess-backend" \
  "$ROOT_DIR/deploy/chess.service" \
  "$ROOT_DIR/deploy/chess-api.caddy" \
  "$INSTANCE:/tmp/"

gcloud compute ssh "$INSTANCE" --zone "$ZONE" --tunnel-through-iap --command='set -euo pipefail
  test -x /usr/games/stockfish
  sudo cp /usr/local/bin/chess-backend /usr/local/bin/chess-backend.previous
  sudo install -m 0755 /tmp/chess-backend /usr/local/bin/chess-backend
  sudo install -m 0644 /tmp/chess.service /etc/systemd/system/chess.service
  sudo install -m 0644 /tmp/chess-api.caddy /etc/caddy/sites-enabled/chess-api.caddy
  sudo caddy validate --config /etc/caddy/Caddyfile
  sudo systemctl daemon-reload
  sudo systemctl restart chess
  sudo systemctl reload caddy
  curl --fail --silent http://127.0.0.1:8102/api/health
  echo'

curl --fail --silent --show-error https://chess.integ.life/api/health
echo
