# 后端部署记录（当前）

## 当前状态

当前生产后端运行在 Snake GCP 的 `chinese-chess.service`，本地构建 Go 二进制后通过 `scripts/deploy-backend-gcp.sh` 发布。

当前文档还持续维护本地开发与运行基线参数（便于复现）。

## 后端本地运行（已落地）

- 入口：`backend/cmd/server/main.go`
- 默认监听端口：`8080`（可通过环境变量 `PORT` 覆盖）
- 默认数据库：`app.db`（可通过环境变量 `DB_PATH` 覆盖）
- 默认引擎：ElephantEye（UCCI），路径 `engines/eleeye`（可通过 `ELEPHANTEYE_PATH` 或 `XIANGQI_ENGINE_PATH` 覆盖）
- Pikafish 路径：`engines/pikafish`（可通过 `PIKAFISH_PATH` 覆盖）
- Pikafish NNUE 路径：`engines/pikafish.nnue`（可通过 `PIKAFISH_NNUE` 覆盖）

```sh
# 1) 获取 Pikafish 引擎文件（如切回 Pikafish 时需要）
./scripts/fetch-pikafish.sh

# 2) 运行后端（开发）
cd backend
go run ./cmd/server

# 3) 生产可执行文件构建（无运行时编译）
cd backend
go build -o bin/server ./cmd/server
PORT=8080 DB_PATH=app.db ./bin/server
```

## Snake GCP 部署（当前）

### 形态

- 产物：本地交叉编译的 `backend/bin/server-linux`
- 发布入口：`scripts/deploy-backend-gcp.sh`
- 远端二进制：`/usr/local/bin/chinese-chess-backend`
- 进程托管：system service `chinese-chess.service`，监听 `:8098`
- 公开 API：`https://chinese-chess.integ.life/api`
- Cloudflare origin：`https://xq-api.songyangyu.com`

公共棋谱抓取与 Pikafish 批量评分只在本机执行，产出 `backend/qipu-dataset.db`。生产机不得运行 `qipu-worker`；后续生产后端只同步已经生成并校验过的 dataset。

### 参考构建与上传流程

```sh
cd backend
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bin/server ./cmd/server
```

上传到 gFlyfy 后，启动参数采用环境变量注入：

- `PORT`：监听端口
- `DB_PATH`：持久化数据库路径（如 `/app/data/app.db`）
- `PIKAFISH_PATH`：Pikafish 可执行文件路径
- `PIKAFISH_NNUE`：NNUE 文件路径

示例启动（命令行约定）：

```sh
PORT=8080 DB_PATH=/app/data/app.db ELEPHANTEYE_PATH=./engines/eleeye ./server
```

### 本地验证（已执行）

- 日期：`2026-07-05`
- 命令：
  - `cd backend`
  - `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bin/server-linux ./cmd/server`
- 结果：构建成功，输出文件生成于 `backend/bin/server-linux`，用于本地交付到 gFlyfy 的可执行产物。

## 前端对接说明（已落地）

- 前端默认 API 前缀是 `/api`
- 本地开发由 Vite 代理到后端（见当前开发配置）
- 生产环境默认使用同域 `/api`，无需设置独立 API hostname。

## Cloudflare 521 排查

Cloudflare 使用 HTTPS 回源；Nginx 的 443 配置使用已有 Origin Certificate：

- `/etc/nginx/origin-certs/xq-api.songyangyu.com.crt`
- `/etc/nginx/origin-certs/xq-api.songyangyu.com.key`

若外部 health 返回 `521`，但远端 `curl http://127.0.0.1:8080/api/health` 正常，依次检查：

```sh
systemctl --user status chinese-chess-backend.service
curl -sS http://127.0.0.1:8080/api/health
sudo nginx -t
ss -ltn | grep ':443'
```

2026-07-10 曾发生 Nginx reload 后 443 server block 被覆盖、只剩 80 的情况；恢复 443 + Origin Certificate 后外部 health 立即回到 `200`。`make deploy-backend` 不修改 Nginx，因此 521 不应直接归因于 Go 二进制。

## 尚缺待补充

- 服务与 Nginx 的自动外部健康监控
- 灾备与数据备份策略（`app.db`）
