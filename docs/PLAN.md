# 中国象棋学习应用 — 实施计划 (v1)

## 进度

- [x] M1 规则引擎 + 可玩棋盘（纯前端，双人热座）
- [x] M2 Go 后端 + Pikafish 引擎 + 人机对战（难度 1-10）
- [x] M3 保存/读取棋谱
- [x] M4 棋局推演 + 批注
- [x] M5 动态打分（评分条）
- [x] M6 PWA 离线 + 同步

## Context

全新项目（目录为空）。目标：一个学习中国象棋的 Web 应用，功能包括：保存/读取棋谱、1~10 难度人机对战、棋局推演（每步可加批注、可随时保存）、红黑局势动态打分。

**已确认的决策**：
- 前端 React + TypeScript + Tailwind CSS，SVG 自绘棋盘；PWA，离线仅支持推演+笔记，联网后同步
- 后端 Go，SQLite（`modernc.org/sqlite` 纯 Go 驱动，免 CGO），Bearer token 账号认证与用户级数据隔离
- 引擎：运行时可选 **ElephantEye**（默认，UCCI）或 **Pikafish**（UCI + NNUE），由 Go 后端以单个长驻子进程管理。统一使用限深/限时 + MultiPV 候选实现 1~10 难度，并从引擎评分输出动态打分

## 仓库结构

```
chinese-chess/
├── Makefile                        # dev / build / test / fetch-engine
├── scripts/fetch-pikafish.sh       # 下载 macOS arm64 二进制 + pikafish.nnue → backend/engines/（gitignore）
├── shared/perft-fixtures.json      # perft 期望值，Go 与 TS 测试共用
├── backend/
│   ├── go.mod                      # module chinese-chess/backend
│   ├── cmd/server/main.go          # :8080
│   ├── engines/                    # pikafish 二进制 + nnue（gitignore）
│   └── internal/
│       ├── xiangqi/                # 规则模块：board.go movegen.go fen.go perft.go + tests
│       ├── engine/                 # uci.go manager.go difficulty.go
│       ├── store/                  # db.go migrations/0001_init.sql games.go explorations.go
│       └── api/                    # router.go(stdlib 1.22 路由) games.go explorations.go engine.go sync.go
└── frontend/
    └── src/
        ├── xiangqi/                # 客户端规则引擎：types position movegen fen notation + perft.test
        ├── components/             # board/Board.tsx PieceGlyph EvalBar MoveList VariationTree NoteEditor
        ├── pages/                  # LibraryPage PlayPage ExplorePage ViewerPage
        ├── stores/                 # zustand: playStore exploreStore syncStore
        ├── api/                    # client.ts analysis.ts(fetch SSE + Bearer token)
        └── offline/                # db.ts(idb) syncQueue.ts useOnline.ts
```

开发：`make dev` = Go :8080 + Vite :5173（proxy `/api`，SSE 可透传）。

## 核心约定（前后端/引擎共享）

- **局面交换格式**：标准象棋 FEN。起始局面 `rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1`（大写=红，`w`=红走）
- **着法存储/传输格式**：ICCS/UCI 坐标（如 `h2e2`），与 Pikafish 原生一致，无需转换层
- **棋盘内部表示**：90 元素扁平数组，`index = rank*9 + file`，Go/TS 完全一致
- **中文纵线记法**（炮二平五）仅为前端显示层：`frontend/src/xiangqi/notation.ts`

## 后端设计

### 规则模块（从零实现）
调研结论：无可靠维护的 Go 象棋规则库（仅有无测试的玩具项目）。规则量小（~500 行：7 兵种、九宫/过河限制、蹩马腿、塞象眼、炮隔子打、白脸将），Go 与 TS 各实现一份，用同一 perft fixtures 互验。已知起始局面 perft：d1=44, d2=1920, d3=79666, d4=3290240, d5=133312995。
v1 范围：合法着法生成、将军/绝杀/困毙判定。**推迟**：长将/长捉裁决、重复局面判和。

### 引擎管理（engine/manager.go）
所有用户共享单个当前选定引擎进程，不做池。要点：
- 启动：`uci`→`uciok`，`setoption name EvalFile`，`Threads 2`，`isready`
- **串行化**：所有请求过一把互斥锁；一个 goroutine 独占 stdout 扫描
- **关键不变量**：上一个 `bestmove` 未返回前绝不发下一个 `go`；取消 = 发 `stop` 并等 `bestmove`
- 超时/崩溃：per-request deadline = movetime+3s；超时或进程退出则 kill→重启→重新初始化→返回 503
- 每次 `go` 前都重设 `Skill Level`：对弈走子用难度表，分析/打分请求恒 20

### 难度映射（difficulty.go，数据表便于调参）

> 实测（2026-01 版 Pikafish）已移除 `Skill Level`/`UCI_LimitStrength`/`UCI_Elo` 选项，
> 改为自行实现（即 Stockfish Skill Level 的内部原理）：**限深/限时 + MultiPV 候选 + 分差窗口内随机选着**。

| 等级 | go 命令 | MultiPV | 选着窗口（距最佳，cp） |
|---|---|---|---|
| 1 | `go depth 1` | 12 | 700（几乎全随机） |
| 2 | `go depth 2` | 8 | 500 |
| 3 | `go depth 3` | 6 | 350 |
| 4 | `go depth 4` | 5 | 250 |
| 5 | `go depth 6` | 4 | 180 |
| 6 | `go depth 8` | 3 | 120 |
| 7 | `go depth 10 movetime 800` | 3 | 80 |
| 8 | `go depth 14 movetime 1500` | 2 | 40 |
| 9 | `go movetime 2500` | 1 | 最佳 |
| 10 | `go movetime 4000` | 1 | 最佳 |

选着：取最终深度各 multipv 的分数，在 `best - margin` 窗口内均匀随机挑一个。

### API

```
GET/PUT/DELETE /api/games, /api/games/{id}          # PUT=upsert（客户端 UUID），服务端用 xiangqi 包校验着法；DELETE=墓碑
GET/PUT/DELETE /api/explorations, /api/explorations/{id}
POST /api/engine/move        # 需登录；{fen, level} → {bestMove, scoreCp?, scoreMate?, pv[]}（顺带返回评分，供对弈页评分条用）
GET  /api/engine/analyze?fen # 需登录；fetch 读取 SSE，逐条转发 info；客户端 Abort→context.Done→发 stop
POST /api/sync/push          # {games[], explorations[]} → {applied[], conflicts[], rejected[], serverTime}
GET  /api/sync/pull?since=   # 增量拉取，含墓碑；client 用返回的 serverTime 作下次 since
GET  /api/health
```

**流式选 SSE 不选 WebSocket**：分析纯单向下行，服务端只需 `http.Flusher`，零依赖。客户端使用原生 `fetch` 携带 Bearer token 并解析 SSE；换局面或卸载时用 `AbortController` 取消旧连接。

认证入口和引擎入口使用进程内固定窗口限流：同用户名登录 10 次/5 分钟、同 IP 注册 5 次/小时、同用户走子 30 次/分钟、分析 6 次/分钟。引擎内部仍只用原有互斥锁串行搜索。全局请求体上限 1 MiB；请求日志只保留时间、方法、路径、状态、耗时、IP 和 User-Agent。

### SQLite schema（migrations/0001_init.sql，WAL）

```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,                -- 客户端 UUID
  title TEXT NOT NULL DEFAULT '',
  red_player TEXT NOT NULL DEFAULT '', black_player TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '*',   -- '1-0'|'0-1'|'1/2-1/2'|'*'
  initial_fen TEXT NOT NULL,
  moves TEXT NOT NULL DEFAULT '[]',   -- ICCS 字符串 JSON 数组
  source TEXT NOT NULL DEFAULT 'play',-- 'play'|'manual'
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,  -- unix ms
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE explorations (
  id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '',
  root_fen TEXT NOT NULL, game_id TEXT,      -- 可选：从某棋谱某局面 fork
  tree TEXT NOT NULL,                        -- 整棵变着树 JSON（见下）
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_games_updated ON games(updated_at);
CREATE INDEX idx_explorations_updated ON explorations(updated_at);
```

变着树整棵存 JSON 文档（不拆节点表）：每个账号内 LWW 按整行同步，v1 不做节点级合并。

### 同步协议
客户端生成 UUID ⇒ 纯 upsert。Push：`incoming.updated_at > existing.updated_at` 才应用（LWW），返回值区分真实写入 `applied`、旧版本 `conflicts` 和非法棋谱 `rejected`。客户端只清除 applied 的 dirty；出现 conflict 时以 `since=0` 拉取当前账号全量数据，使服务端较新行覆盖本地冲突行。Pull 平时仍按 `since` 增量含墓碑，并以服务端 `serverTime` 作为下次游标。

## 前端设计

### 路由
| 路由 | 页面 | 功能 |
|---|---|---|
| `/` | LibraryPage | 棋谱/推演两个 tab，列表/打开/删除/新建 |
| `/play` | PlayPage | 难度 1-10、选边、棋盘、着法表、评分条、认输/悔棋/保存棋谱 |
| `/games/:id` | ViewerPage | 打谱回放（←/→ 键），评分条，「从此局面开始推演」fork |
| `/explore/:id?` | ExplorePage | 自由推演：变着树面板、批注编辑器、保存推演 |

### 棋盘（Board.tsx，SVG）
`viewBox 0 0 900 1000`，棋子落交叉点；网格、九宫斜线、楚河汉界、炮兵位标记。棋子 = 圆 + 文字（帥仕相馬車炮兵/將士象馬車砲卒）。交互：点选→合法点提示（TS movegen）→点落；上一步高亮；被将军红圈脉冲。棋盘提供经典轻量、紫檀木雕、量子霓虹、星河鎏金四套 SVG/CSS 主题，本机持久化选择；网页背景、导航、卡片和表单会跟随棋盘主题联动。经典主题不使用装饰滤镜或动画，作为低资源 fallback。v1 不做拖拽。

### 客户端规则引擎（src/xiangqi/）
离线推演必须本地校验 ⇒ TS 完整实现合法着法；后端 Go 在持久化/引擎调用时二次校验（纵深防御）。共享 perft fixtures 保证两份实现一致。
核心类型：`Square = 0..89`；`Position { board: (Piece|null)[]; turn: Color }`；API：`legalMoves / makeMove / inCheck / isCheckmate / toFEN / fromFEN / moveToICCS`。

### 记法模块（notation.ts）
`moveToChinese(posBefore, move)`：红方九~一右到左汉字、黑方 1~9 左到右阿拉伯数字；平/进/退；斜行子（馬相仕）用目标线；前/后消歧（多兵同线用前/中/后，3+ 兵极端情形推迟）。中文记法**解析**（导入方向）推迟。

### 变着树模型（推演核心，exploreStore.ts）

```ts
interface VariationNode { id: string; move: string | null; note: string; children: VariationNode[] }  // children[0]=主线，root.move=null
interface VariationTree { rootFen: string; root: VariationNode }
```

store 持有 `{tree, currentNodeId, dirty}`，当前局面由根路径重放推导（路径短，v1 不缓存）。动作：`playMove`（同着法子节点已存在则直接进入）、`goto`、`setNote`（失焦/防抖自动存 store）、`promoteVariation`、`deleteSubtree`、`save()`（任意节点可点「保存推演」，始终存整棵树 → idb + 标 dirty）。
`VariationTree.tsx` 渲染缩进嵌套着法列表（ChessBase 风格），选中节点的批注显示在 `NoteEditor.tsx`。

### 状态管理
zustand（轻量、可在 React 外用于同步队列）。服务端/引擎调用全部收敛在 `api/`，组件内不发请求。

### 评分条（EvalBar.tsx）
红方占比 = `sigmoid(cp/400)`（分数恒红方视角），数字标注 `+0.8` / `M4`。
数据源：`useAnalysis(fen)` hook —— 带 Authorization 的 fetch 连 `/api/engine/analyze` 并解析 SSE，FEN 变化 300ms 防抖后重连。用于 Viewer/Explore（可开关「引擎分析」）；PlayPage 直接复用 `/api/engine/move` 顺带返回的分数（避免引擎争用）。离线时隐藏。

### PWA + 离线 + 同步
- `vite-plugin-pwa`（generateSW）：预缓存 app shell；`/api/games*`、`/api/explorations*` NetworkFirst；`/api/engine/*` NetworkOnly
- **IndexedDB（idb）是前端主存储**：object stores `games`/`explorations`（镜像服务端行含 updatedAt/deleted）+ `meta`(lastSyncAt)。所有页面先读写 idb —— 离线是默认路径而非特例
- `syncQueue.ts`：行级 dirty 标记；`sync()` = push 所有 dirty → pull since → 本地 LWW 应用 → 清标记。触发时机：应用启动、`online` 事件、每次保存后。`useOnline()` 驱动顶栏在线/离线状态点
- 离线能力矩阵（UI 强制）：推演+批注+浏览已存内容 = 完整可用；人机对战+评分条 = 禁用并提示

## 里程碑（每个独立可验证）

1. **M1 规则 + 可玩棋盘（纯前端）**：Vite 脚手架 + `src/xiangqi/*` + Board.tsx，双人热座页。验证：perft(1..4) 过 fixtures + 专项用例（蹩马腿/塞象眼/象不过河/白脸将/炮打隔子/将杀）；浏览器手动下完整一局
2. **M2 后端 + 引擎 + 人机对战**：fetch-pikafish.sh、Go xiangqi 包（perft 对齐）、engine 包、`POST /api/engine/move`、PlayPage 接难度 1-10。验证：`go test ./...`；curl 返回合理着法+分数；1 级 vs 10 级实测强度差；kill -9 引擎进程确认自动重启
3. **M3 保存/读取棋谱**：SQLite + games CRUD + LibraryPage + ViewerPage（中文记法着法表）。验证：curl 全 CRUD 含墓碑；浏览器存局→刷新→回放
4. **M4 推演 + 批注**：exploreStore + ExplorePage + VariationTree/NoteEditor + explorations API + Viewer fork 入口。验证：建 3 分支树带批注→保存→刷新结构完整；分支导航/升变/删除
5. **M5 动态打分**：SSE analyze + useAnalysis + EvalBar。验证：`curl -N` 见流式 depth/score；断开 curl 确认服务端发 `stop`；单方多一车确认正负号方向正确
6. **M6 PWA 离线 + 同步**：vite-plugin-pwa + idb 层 + sync 端点/队列 + 在线状态 UI。验证：DevTools 离线下建推演写批注→联网自动 push 落库；双浏览器模拟双设备离线改同一推演→LWW 后写胜出；删除经墓碑传播

## 明确推迟（v2+）
长将/长捉裁决与重复判和；XQF/DhtmlXQ/PGN 导入导出（v1 导出=JSON）；中文记法解析；开局库/云评估/MultiPV；节点级合并；拖拽走子/音效动画；让子 UI（schema 已通过 initial_fen 支持）

## 关键文件
- `frontend/src/xiangqi/movegen.ts` — 全应用正确性锚点（perft 验证，镜像到 Go）
- `backend/internal/engine/manager.go` — Pikafish 生命周期/串行化/难度/崩溃恢复
- `frontend/src/stores/exploreStore.ts` — 变着树模型，推演功能核心
- `backend/internal/store/migrations/0001_init.sql` — 含同步元数据的 schema
- `frontend/src/offline/syncQueue.ts` — idb 优先存储 + LWW 同步
