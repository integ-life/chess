# 国际象棋学习应用

`chess.integ.life` 的国际象棋 Web 应用。项目沿用中国象棋站的产品结构：统一账号、离线优先棋谱库、分支推演与批注、人机对战、好友房、在线匹配、课程路线、多语言、主题、PWA 和跨设备同步。

棋类内核已替换为标准国际象棋：8×8 棋盘、标准 FEN/UCI、王车易位、吃过路兵、升变、将军、将死与逼和。前后端共享标准开局 perft 基准；服务端引擎使用 Stockfish UCI。

## 本地开发

```sh
make dev
make test
```

前端开发地址为 `http://localhost:5173`，后端默认为 `http://localhost:8080`。生产前端使用相对 `/api`。

## 生产配置

- 站点：`https://chess.integ.life`
- API origin：`https://chess-api.integ.life`
- 引擎：`CHESS_ENGINE=stockfish`
- 引擎路径：`STOCKFISH_PATH` 或 `CHESS_ENGINE_PATH`
- 数据库：`DB_PATH`

GitHub Pages 的 `CNAME`、PWA manifest、同域 API、CORS、Caddy 与 systemd 模板均已按新域名独立配置。
