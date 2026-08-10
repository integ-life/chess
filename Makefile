.PHONY: dev dev-frontend dev-backend build test test-frontend test-backend fetch-engine qipu-once qipu-start qipu-stop qipu-status deploy-backend

QIPU_DATASET_DB ?= $(CURDIR)/backend/qipu-dataset.db
QIPU_SOURCES_DIR ?= $(CURDIR)/backend/qipu-sources

# 并行起前后端（后端 M2 起可用）
dev:
	$(MAKE) -j2 dev-frontend dev-backend

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && go run ./cmd/server

build:
	cd frontend && npm run build
	cd backend && go build -o bin/server ./cmd/server
	cd backend && go build -o bin/qipu-worker ./cmd/qipu-worker

test: test-frontend test-backend

test-frontend:
	cd frontend && npm test

test-backend:
	cd backend && go test ./...

# 下载 Pikafish 二进制 + NNUE 权重到 backend/engines/
fetch-engine:
	./scripts/fetch-pikafish.sh

# 仅在本机拉取、分类并评分，结果写入可独立同步的 SQLite dataset
qipu-once:
	cd backend && DB_PATH="$(QIPU_DATASET_DB)" QIPU_SOURCES_DIR="$(QIPU_SOURCES_DIR)" go run ./cmd/qipu-worker -once

qipu-start:
	cd backend && go build -o bin/qipu-worker ./cmd/qipu-worker
	@cd backend && if [ -f qipu-worker.pid ] && kill -0 "$$(cat qipu-worker.pid)" 2>/dev/null; then \
		echo "qipu worker already running pid=$$(cat qipu-worker.pid)"; \
	else \
		nohup env DB_PATH="$(QIPU_DATASET_DB)" QIPU_SOURCES_DIR="$(QIPU_SOURCES_DIR)" ./bin/qipu-worker > qipu-worker.log 2>&1 & echo $$! > qipu-worker.pid; \
		echo "qipu worker started pid=$$(cat qipu-worker.pid)"; \
	fi

qipu-stop:
	@cd backend && if [ -f qipu-worker.pid ] && kill -0 "$$(cat qipu-worker.pid)" 2>/dev/null; then \
		kill "$$(cat qipu-worker.pid)" && echo "qipu worker stopped"; \
	else echo "qipu worker is not running"; fi; rm -f qipu-worker.pid

qipu-status:
	@cd backend && if [ -f qipu-worker.pid ] && kill -0 "$$(cat qipu-worker.pid)" 2>/dev/null; then \
		echo "qipu worker running pid=$$(cat qipu-worker.pid)"; \
	else echo "qipu worker is not running"; fi; tail -n 12 qipu-worker.log 2>/dev/null || true

# 编译并部署到远端 gFlyfy（含版本注入 + 重启 + 健康检查）
deploy-backend:
	./scripts/deploy-backend-gcp.sh
