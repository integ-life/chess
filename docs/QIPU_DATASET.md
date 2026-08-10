# 本地公共棋谱 Dataset

## 边界

- 拉取社区源、合法着法校验和 Pikafish 批量评分只在本机运行。
- 产物是 `backend/qipu-dataset.db`；源文件在 `backend/qipu-sources/`。两者均不提交 Git。
- 生产后端未来只同步已经生成并校验过的 dataset，不运行 qipu worker。

## 数据源

| Source ID | 内容 | 格式 |
| --- | --- | --- |
| `chasoft-community` | Vietcotuong 社区库，开局/中局/残局/题库/精选/赛事等 7 类 | DhtmlXQ |
| `cglemon-wxf` | 世界象棋联合会 41,743 局 | ICCS PGN |
| `cglemon-dpxq` | 东萍棋谱仓库约 99,771 局 | ICCS PGN |

每个来源保存 URL、本地路径、格式、revision 和最后拉取时间。每条 provenance 还保存源内 key、原始 URL、内容版本和完整 metadata JSON。

导入时会把 DhtmlXQ 的左上角坐标转换为内部 ICCS 红方底线坐标，并把“和局”统一记为 draw。PGN 中单盘非法棋局会写入 worker 日志后跳过；同一文件的后续合法棋局仍会继续导入。

## 为什么不是普通 prefix tree

普通前缀树只能合并完全相同的走子前缀，无法合并不同走子顺序到达的同一局面。Dataset 使用共享局面图：

- `qipu_positions`：规范化 FEN 唯一，同一 state 只存一份；局面引擎评分也只存一份。
- `qipu_edges`：`from_position + move + to_position` 唯一，相同开局分支共享边。
- `qipu_game_edges`：每盘棋只保存按 ply 排序的共享 edge 引用。
- `qipu_games`：`initial_fen + moves` 指纹唯一，跨来源重复棋局只存一盘。
- `qipu_game_sources`：同一棋局可关联多个来源，并保留各自 metadata。

重复局面可能形成环，因此严格说这是 position graph，而不是树；从起始局面按 edge 展开时仍可当作开局 prefix tree 查询。

## 本地运行

```sh
make qipu-start
make qipu-status
make qipu-stop
```

一次性跑到当前数据追平可用 `make qipu-once`。默认每盘抽样 5 个着法、Pikafish depth 8；已分析的相同 position 会直接复用。

## 导出前端目录快照

评分未完成时，资源页只使用分类、metadata、着法和 provenance，不导出任何引擎字段：

```sh
node scripts/export-qipu-catalog.mjs
```

脚本从每类前八个主要合集中各选一盘 metadata 较完整、长度适中的 canonical game，生成 `frontend/src/qipu/catalog-data.json`。完整 dataset 仍保持本地只读边界；这个小型快照只负责分类浏览和进入推演，不代替后续正式同步。

## 常用检查

```sh
sqlite3 backend/qipu-dataset.db '
SELECT "sources", COUNT(*) FROM qipu_sources UNION ALL
SELECT "games", COUNT(*) FROM qipu_games UNION ALL
SELECT "provenances", COUNT(*) FROM qipu_game_sources UNION ALL
SELECT "positions", COUNT(*) FROM qipu_positions UNION ALL
SELECT "edges", COUNT(*) FROM qipu_edges UNION ALL
SELECT "analyzed", COUNT(*) FROM qipu_games WHERE analyzed_at > 0;'
```
