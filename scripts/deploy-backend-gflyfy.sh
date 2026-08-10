#!/usr/bin/env bash
set -euo pipefail

# 可选参数
# VERSION/BUILD_TIME/COMMIT 可通过环境变量覆盖
HOST="${1:-gFlyfy}"
API_URL="${API_URL:-https://chess-api.songyangyu.com/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-10}"
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=15 -o BatchMode=yes}"
APP_ROOT="/home/songyy/apps/chess/backend"
APP_BASE="/home/songyy/apps/chess"
REMOTE_BIN="${APP_ROOT}/chess-backend"
REMOTE_BACKUP_DIR="${APP_ROOT}/.deploy_backups"
REMOTE_SERVICE="chess-backend.service"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
LOCAL_BIN="${BACKEND_DIR}/bin/server-linux"

VERSION="${VERSION:-$(date -u +%Y%m%d-%H%M%S)}"
BUILD_TIME="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
COMMIT="${COMMIT:-$(git -C "$(cd "$(dirname "$0")/.." && pwd)" rev-parse --short HEAD 2>/dev/null || echo unknown)}"

# 1) 本地构建 Linux x86_64 二进制
cd "$BACKEND_DIR"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
  -ldflags "-X main.version=${VERSION} -X main.buildTime=${BUILD_TIME} -X main.commit=${COMMIT}" \
  -o "${LOCAL_BIN}" \
  ./cmd/server
chmod +x "${LOCAL_BIN}"
cd - >/dev/null

# 2) 上传新包
scp ${SSH_OPTS} "${LOCAL_BIN}" "${HOST}:${REMOTE_BIN}.new"

# 3) 在远端备份旧包、切换新包并重启服务
ssh ${SSH_OPTS} "${HOST}" bash <<EOF_REMOTE
set -euo pipefail
mkdir -p "${REMOTE_BACKUP_DIR}"
mkdir -p "${APP_BASE}/data" "${APP_BASE}/logs" "/home/songyy/.config/systemd/user"
if [ -f "${REMOTE_BIN}" ]; then
  ts="\$(date +%Y%m%d-%H%M%S)"
  mv "${REMOTE_BIN}" "${REMOTE_BACKUP_DIR}/chess-backend.\${ts}"
fi
mv "${REMOTE_BIN}.new" "${REMOTE_BIN}"
chmod +x "${REMOTE_BIN}"
cat > "/home/songyy/.config/systemd/user/${REMOTE_SERVICE}" <<'EOF_SERVICE'
[Unit]
Description=Chinese Chess Backend
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/songyy/apps/chess/backend
Environment=DB_PATH=/home/songyy/apps/chess/data/app.db
Environment=PIKAFISH_PATH=/home/songyy/apps/chess/backend/engines/pikafish-limited
Environment=PIKAFISH_NNUE=/home/songyy/apps/chess/backend/engines/pikafish.nnue
Environment=PORT=8080
ExecStart=/home/songyy/apps/chess/backend/chess-backend
Restart=always
RestartSec=2
StandardOutput=append:/home/songyy/apps/chess/logs/backend.log
StandardError=append:/home/songyy/apps/chess/logs/backend.log

[Install]
WantedBy=default.target
EOF_SERVICE
if systemctl --user status >/dev/null 2>&1; then
  systemctl --user daemon-reload
  systemctl --user enable "${REMOTE_SERVICE}" >/dev/null
  systemctl --user restart "${REMOTE_SERVICE}"
else
  cd "${APP_ROOT}"
  ./start-backend.sh
fi
EOF_REMOTE

# 4) 验证版本信息（加超时，避免命令挂死）
sleep 2
if command -v curl >/dev/null 2>&1; then
  if ! curl -m "${HEALTH_TIMEOUT}" -fsS "${API_URL}" | cat; then
    echo "health check failed or timed out (${HEALTH_TIMEOUT}s)"
    echo "Run manual check: curl ${API_URL}"
    exit 1
  fi
else
  echo "curl not available, please check health with: curl ${API_URL}"
fi
