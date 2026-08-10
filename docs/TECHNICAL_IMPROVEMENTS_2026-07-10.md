# 安全、同步与运行可靠性改进设计

日期：2026-07-10

## 目标

用最小改动解决当前已确认的五类问题：敏感日志、匿名引擎资源占用、LWW 同步误报、认证边界薄弱、关键后端路径缺少测试。保留现有 API 形状、象棋规则、ElephantEye/Pikafish 串行搜索、IndexedDB 离线优先和在线对局恢复行为。

## 非目标

- 不重写在线对局或拆分大文件；行数本身不是改造理由。
- 不改棋规、FEN、ICCS、难度表、棋谱模型和数据库主键。
- 不在本轮迁移到 Cookie 会话、Redis、分布式限流或引擎池。

## 设计

### 1. 日志只保留请求元数据

`requestlog.go` 不再读取或保存请求体、响应体、Authorization、Cookie 或其他完整请求头，只记录时间、方法、路径、状态、耗时、IP 和 User-Agent。状态包装器继续实现 `http.Flusher`，保证 SSE 不受影响。请求日志文件权限由 `0644` 改为 `0600`。

在全局 HTTP middleware 用 `http.MaxBytesReader` 把请求体限制为 1 MiB；已声明更大 `Content-Length` 的请求直接返回 `413`。`http.Server` 增加 `ReadHeaderTimeout` 和 `IdleTimeout`，不设置会截断 SSE 的短 `WriteTimeout`。

验收：注册/登录后日志中不能出现密码、Bearer token 或登录响应 token；超大请求不会被完整读入内存。

### 2. 引擎接口必须登录并限制滥用

`POST /api/engine/move` 和 `GET /api/engine/analyze` 都经过 `requireAuth`。前端分析由原生 `EventSource` 改为带 `Authorization` 的 `fetch` 流读取，继续解析现有 SSE `data:` 事件；FEN 变化和组件卸载时用 `AbortController` 取消请求。

后端增加一个仅用标准库实现的固定窗口 limiter：

- 登录：同一规范化用户名每 5 分钟最多 10 次。
- 注册：同一客户端 IP 每小时最多 5 次。
- 引擎走子：同一用户每分钟最多 30 次。
- 引擎分析：同一用户每分钟最多 6 次。

超限返回 `429`。limiter 定期惰性删除过期桶，不引入 Redis 或第三方限流依赖。引擎内部已有互斥锁，继续作为唯一并发搜索保护，不再叠加第二套搜索队列。

验收：匿名引擎请求返回 `401`；正常登录用户仍可走子和看到流式分析；取消分析会让后端 context 结束并向引擎发送 `stop`。

### 3. 同步只回报真实写入结果

`syncPushResponse` 新增 `conflicts`，games 和 explorations 的 `Upsert*` 只有返回 `applied=true` 才进入 `applied`；`false` 进入 `conflicts`；格式或棋规不合法仍进入 `rejected`。

客户端只清除 `applied` 行的 dirty。若出现 conflict，本轮 pull 使用 `since=0` 拉取完整用户数据，让服务端较新的 LWW 行覆盖本地旧行；数据量增长到全量 pull 成为可测瓶颈时，再让 push 直接返回冲突行。

验收：旧时间戳 push 不改数据库、不进入 applied，客户端不把它误当成功，随后能收敛到服务端版本。

### 4. 密码哈希使用标准实现并兼容旧用户

新密码使用 `golang.org/x/crypto/bcrypt`，cost 使用库默认值。登录时按 hash 前缀识别：bcrypt 直接验证；旧 `sha256:<iterations>:...` 继续验证一次，成功后立即在同一用户行升级为 bcrypt。密码增加 128 字节上限，避免无界哈希开销；错误信息保持统一。

本轮不改变客户端 token 存储和 session schema，避免把安全修复扩大成全量认证重构。

验收：新注册只生成 bcrypt；旧 hash 用户仍能登录并自动升级；错误密码不升级。

### 5. 补最小回归测试

新增少量 Go 测试，覆盖真实风险而不是追求覆盖率数字：

- request logger 不记录密码、Authorization、响应 token，并保留状态码/SSE flush 能力。
- bcrypt 注册、旧 hash 登录升级、错误密码。
- 匿名引擎路由返回 401、限流返回 429。
- sync push 的 applied/conflicts/rejected 三种结果与数据库最终值。
- 在线 match snapshot round-trip 和恢复后参与者隔离继续通过。

前端不新增测试依赖；SSE fetch 解析器保持为小型纯函数并用现有 Vitest 添加一个分块输入测试。保留现有 perft 深度 1-4 作为规则不回归门槛。

## 文档与版本历史

更新 `README.md` 和 `docs/PLAN.md`：删除“单用户无鉴权”等过期描述，补充认证、在线对局、当前引擎与同步冲突语义。用户可见的登录限流、分析鉴权、同步可靠性和部署行为记录到 `frontend/src/changelog.ts`。

## 发布顺序与回滚

1. `make test`、`make build`、`npm run lint`。
2. commit 并 push `main`。
3. 先部署前端：新 fetch-SSE 客户端兼容当前仍公开的旧后端。
4. 再部署后端：此时把分析接口切为必须鉴权不会造成前端中断。
5. 验证前端 `app-version.json`、后端 `/api/health` commit、匿名引擎 `401`、登录后走子与分析、CORS Authorization preflight。

若后端异常，部署脚本使用既有备份回滚二进制；若前端异常，重新发布上一提交。数据库没有破坏性 schema 迁移，bcrypt 升级是逐用户、不可逆但向后兼容的单行更新。
