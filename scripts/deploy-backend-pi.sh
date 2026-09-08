#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PI_HOST="${PI_HOST:-pi}"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

[[ "$(ssh "$PI_HOST" hostname)" == "songyy-pi" ]]
[[ "$(ssh "$PI_HOST" uname -m)" == "aarch64" ]]
[[ -z "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=all)" ]] || {
  echo "Clean committed checkout required" >&2
  exit 1
}

COMMIT="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD)"
VERSION="${VERSION:-git-$COMMIT}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
BINARY="$BUILD_DIR/chess-backend"

(
  cd "$ROOT_DIR/backend"
  go test ./cmd/server ./internal/api ./internal/chess ./internal/engine ./internal/store
  CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath \
    -ldflags "-s -w -X main.version=${VERSION} -X main.buildTime=${BUILD_TIME} -X main.commit=${COMMIT}" \
    -o "$BINARY" ./cmd/server
)

scp "$BINARY" "$ROOT_DIR/deploy/chess.service" "$PI_HOST:/tmp/"
ssh "$PI_HOST" "set -euo pipefail
  test -x /usr/games/stockfish
  sudo -n test -r /etc/chess.env
  sudo -n test -f /var/lib/chess/app.db
  sudo -n sqlite3 -readonly /var/lib/chess/app.db 'PRAGMA quick_check;' | grep -qx ok
  stamp=\$(date -u +%Y%m%dT%H%M%SZ)
  sudo -n -u chess sqlite3 /var/lib/chess/app.db \".backup /var/lib/chess/pre-deploy-\${stamp}.db\"
  if sudo -n test -x /usr/local/bin/chess-backend; then
    sudo -n cp -p /usr/local/bin/chess-backend /usr/local/bin/chess-backend.previous
  fi
  sudo -n install -o root -g root -m 0755 /tmp/chess-backend /usr/local/bin/chess-backend
  sudo -n install -o root -g root -m 0644 /tmp/chess.service /etc/systemd/system/chess.service
  sudo -n systemctl daemon-reload
  sudo -n systemctl enable --now chess.service
  sudo -n systemctl restart chess.service
  sudo -n systemctl is-active --quiet chess.service
  health=\$(curl --retry 10 --retry-connrefused --retry-delay 1 --fail --silent http://127.0.0.1:8102/api/health)
  printf '%s\n' \"\$health\"
  [[ \"\$health\" == *'\"commit\":\"$COMMIT\"'* ]]
"
