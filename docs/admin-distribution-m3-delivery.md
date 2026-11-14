# M3 开发与验收记录

开发分支 feat/admin-distribution-m3，基线 e6e2f8ec481dbdc64fe5ae790aceaebab5523414。开发在独立工作树进行。

## 首轮审查修复

审查基线为 `34e09758e9cc13b53d60c14e21543f95c78d3864`。增量迁移保护已有任务素材的对象版本和路径。Staging runner 用同一项目的受限管理连接做清理前后读回，并保存每次执行的原始退出码。[增量 SQL](../supabase/migrations/20261113170022_protect_distribution_publish_media.sql) · [设计与执行边界](admin-distribution-m3-security.md#历史素材不可变保护)

本轮 Staging 只读预检通过。预检时数据库登记九条迁移，原始 M3 SQL 哈希一致，`media` 未启用版本管理，管理员 aal2 有 UPDATE 权限，桶、M3 任务和 Auth 数据为空。Security Advisor 仍有两条既有 `analytics_private` INFO。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run lint` / `npm run build` | PASS | 退出码均为 0，构建命令 9.84 秒，保留既有包体积提示 |
| `npm test` | PASS | 22 个文件，317 项，Vitest 7.46 秒，退出码 0 |
| `npm run test:e2e` | PASS | 230 项，零跳过，14.0 分钟，退出码 0 |
| `npm run test:security` | PASS | 16 项，39.9 秒，退出码 0 |
| 历史媒体与清理 | PASS（本地） | 验证版本、路径和归档保护，允许访问时间及自定义元数据更新。覆盖历史路径漂移、M1/M2 素材引用、清理提交前后超时、重复清理、清单外对象及临时凭据删除回执丢失 |
| 真实覆盖、upsert 和移动基线 | FAIL（已复现） | 管理员 aal2 三次操作均成功。UUID 和任务快照不变，覆盖与 upsert 更改字节，移动使原路径失效 |
| 基线 runner 与资源清理 | PASS | 基线探针退出码 0，确认三种允许写入的现象及资源清理。独立只读复核临时账号、Auth、MFA、会话、分发行、历史和 Storage 均清零。临时 Secret API Key 已撤销 |
| Staging 增量迁移 | PASS | 官方单条迁移 API HTTP 200，脚本退出码 0。远端登记 `20261114053707`，存储 SQL 哈希与批准版本一致 |
| 完整真实 runner | PASS | 独立获批后实跑一次，107.26 秒，原始退出码 0。真实 Storage 的覆盖、upsert 和移动均被拒绝，业务及浏览器验证完成 |
| 最终资源及凭据清理 | PASS | 两轮测试资源经独立只读复核均为零，两枚临时 Secret API Key 已撤销。Scoped PAT 已撤销并验证失效，DPAPI 副本已移除 |
| PostgREST 精确版本 | BLOCKED | REST 根端点返回 HTTP 401。管理 API 显示 REST 服务健康，未返回版本字段。实际 REST 权限与并发验证通过 |

本地测试曾误将 UUID 改动断言为触发器的 `42501`。PostgreSQL 先返回既有外键的 `23503`，现断言具体外键名，路径和版本仍独立断言触发器拒绝。

### 2026-11-14 修复前实测

13:32–13:33（Asia/Shanghai），使用 `f488b85534353d48ba01230b5650bed39fc7b37a` 的 runner，run_id 为 `f6a0be01-ec58-4b14-bf40-fd7d04e2cb54`。真实 GoTrue TOTP、M1/M2/M3 SQL smoke 均通过。Storage 版本为 `1.94.2`，桶版本管理为 `DISABLED`。

| 管理员 aal2 操作 | 下载字节 SHA-256 变化 | 路径与对象版本 |
| --- | --- | --- |
| `update()` | `f03ddc09…` → `7416d1fe…` | 原路径保留，Storage 版本改变 |
| `upload(..., { upsert: true })` | `7416d1fe…` → `f03ddc09…` | 原路径保留，Storage 版本再次改变 |
| `move()` | `f03ddc09…` → `f03ddc09…` | 同 UUID 移至 `moved-frozen.webp`，原路径列表缺失，Storage 版本改变 |

三次操作均改变 Storage 服务元数据，任务快照始终保留初始 UUID 和路径。覆盖与 upsert 的字节哈希变化证实内容被替换。移动前后字节相同，读取位置发生变化。原文件 SHA-256 为 `f03ddc0922c34d65c3e83f769805f983ac50521971972a2c4c4db8cc5fdfdc81`，替换文件为 `7416d1fe87f8d6fbb8756f9090b0018578bae3b3dd4c54eec6ad7c0ecb60e7a2`。

清理后，原路径、移动目标和第二个夹具的公开 GET 均返回 HTTP 400 加对象缺失状态 404。独立读回确认测试数据清零及原始 M3 SQL 哈希。

### 2026-11-14 Staging 增量迁移回执

13:37（Asia/Shanghai），获批通道向 `song-staging`（`uartrtcmskyuqxawjqlx`）提交一次 `protect_distribution_publish_media`。原 SQL 3,300 字节，SHA-256 为 `28d22d496fb293bfaa731af6535a24e975ee146440f03de8eae3217a1adb25c9`。提交前未发现 Storage 写锁，数据库存储的原始 M3 哈希仍为 `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396`。

提交后由迁移 API 和 PostgreSQL 目录分别读回增量哈希，迁移历史共十条。触发器已启用，绑定私有函数，所有者为 `postgres`，固定空 `search_path`。`anon`、`authenticated`、`service_role` 及发布写入角色均无该函数的 EXECUTE。三张强制 RLS 表、六条已验证的 RESTRICT 外键及五条原 Storage 策略核对通过。Security Advisor 仅报告迁移前已有的两条 INFO。

### 2026-11-14 完整 Staging 复验

13:57:58–13:59:45（Asia/Shanghai）在 `song-staging`（`uartrtcmskyuqxawjqlx`）运行。测试提交为 `5f08b720179915c55b75f8ffc186e49e8ad4d4c1`，run_id 为 `2407c7eb-b39d-441c-9632-f38cc796ddb8`。启动前与结束后均确认十条迁移、媒体保护触发器和两条 M3 SQL 的存储哈希。Runner 实际用时 107.26 秒，退出码 0。原始 JSONL 与进程回执保存在本机 Git 忽略目录。

| 真实验证 | 结果 | 证据 |
| --- | --- | --- |
| 已引用素材的 `update()`、upsert、`move()` | PASS | 同一管理员 aal2 的三个请求均返回 HTTP 400 / `AccessDenied`，响应匹配媒体保护触发器。每次重新下载，原字节 SHA-256 均为 `f03ddc0922c34d65c3e83f769805f983ac50521971972a2c4c4db8cc5fdfdc81`。对象 UUID、原路径、对象版本、Storage 服务元数据和完整任务快照一致，移动目标未创建 |
| M1/M2 素材兼容和历史引用 | PASS | 两件新图可上传与读取。独立的 M1、M2 关联及仅剩 M3 历史引用时，Storage 删除返回 `ResourceReferenced` 且原字节可读。清理解除引用后，两件图片均可删除 |
| GoTrue、PostgREST 和 RPC | PASS | 三个真实 TOTP 会话，匿名、管理员 aal1 和普通用户 aal2 的越权请求遭拒。M1/M2/M3 SQL smoke 各核对五种身份。覆盖幂等、并发 HTTP 409 / `PT409`、注入审计失败的原子回滚、人工报告和纠正 |
| 真实 Edge | PASS | 任务创建、刷新、日历、历史、素材预览和导出通过。7 次 Auth、20 次 REST、1 次 Storage 请求，REST 含一次任务写入，页面异常为 0 |
| 最终只读核对 | PASS | Auth 用户、MFA 因子、会话、身份、管理员登记、分发数据及引用、日志、Storage 对象、注入的临时审计触发器计数均为 0。三个保留路径的公开 GET 返回 HTTP 400，响应体确认对象缺失。独立复核两轮临时 Secret API Key 均已撤销 |
| Scoped PAT | PASS | 14:02（Asia/Shanghai）同一项目健康接口从 HTTP 200 变为 HTTP 401，本机 DPAPI 交接文件已移除 |

本次真实清理一次提交后读回成功。超时后的只读恢复、重复清理及自定义元数据更新由本地数据库回归覆盖。PostgREST 健康接口返回 HTTP 200 / ACTIVE_HEALTHY，精确版本查询仍受限。[服务健康接口](https://supabase.com/docs/reference/api/v1-get-services-health)

## 本地回归

本节保留首轮开发交付时的验证记录。

使用 Node.js 24.12.0、npm 11.6.2 和 Microsoft Edge 157.0.4341.46。E2E 沿用现有礼账封面 PNG 夹具。浏览器套件使用受控 HTTP 响应，数据库套件使用隔离的 PGlite PostgreSQL，依次应用仓库中的迁移。

| 命令 | 结果 | 用例、时间和退出码 |
| --- | --- | --- |
| npm run lint | PASS | 命令用时 2.24 秒，退出码 0 |
| npm run build | PASS | 命令用时 6.38 秒，Vite 构建约 0.95 秒，退出码 0。既有主包大于 500 kB 的提示保留 |
| npm test | PASS | 22 个文件、313 项通过，Vitest 6.90 秒，退出码 0 |
| npm run test:e2e | PASS | 230 项通过，0 跳过，14.5 分钟，退出码 0 |
| npm run test:security | PASS | 两种 CSP 模式共 16 项通过，43.1 秒，退出码 0 |

M3 本地数据库覆盖四种 JWT 身份与缺失 aal、直接写入和伪造日志拒绝、额外 permissive 策略、创建与报告重放、过期版本、状态限制、审计写入失败回滚、源和素材保护、归档、数据清理及回滚草案。浏览器覆盖三种日历视图、两处创建入口、时区与 DST、冲突恢复、取消、报告及纠正、导出、刷新、分页和主题切换。最后一次表单与样式调整后，M3 专项 E2E 八项复跑通过，36.5 秒，退出码 0。Storage 缺失响应的兼容规则新增两项测试，覆盖已观察到的旧版响应和无关错误。

开发期间，隔离数据库的 RESTRICT 返回 23001，已同时覆盖 23503 和 23001，并验证触发的具体外键。Storage 用例使用仅被本任务引用的对象，以单独验证 M3 外键。清理脚本最初出现变量与列重名，修正后已验证清单外事件会阻断清理。本次复跑的浏览器套件在默认沙箱中因回环访问 EACCES 未启动用例，改用已授权的本机回环运行。

一次完整 E2E 复跑耗时 14.2 分钟，228 项通过，英文 About 页桌面主题动画断言等候 5 秒超时。可选封面用例因未设置 `WORK_COVER_IMAGE` 跳过。该次退出码 1。保持原断言，配置本地礼账 PNG 后两个用例各复跑三次，6 项通过，41.7 秒，退出码 0。随后完整复跑 230 项全部通过。英文 About 页此次超时未复现。

提交后的 SQL 复核发现同名临时表可以覆盖时区查询，导致伪造时区被接受。时区视图已限定为 pg_catalog.pg_timezone_names。新增回归先在原 SQL 重现问题，再验证非法时区拒绝和合法时区通过。

## Staging

以下为 2026-11-13 在 `song-staging`（`uartrtcmskyuqxawjqlx`）的验收快照。测试使用短期项目限定凭据和临时夹具。

| 核验 | 状态 | 证据 |
| --- | --- | --- |
| 项目身份与 M1/M2 基线 | PASS | 迁移前有八条历史，六张分发表强制 RLS，四个 M2 RPC 为 Invoker，两条 M2 存储 SQL 哈希与 M2 验收一致。 |
| `apply_migration` 通道 | FAIL | 已按最终 SQL 哈希批准并调用一次。连接器返回 HTTP 传输错误，未取得数据库执行回执。 |
| M3 单条迁移及目录核对 | PASS | 读回确认原通道未执行。独立获批后，官方 API 提交一次，HTTP 200，退出码 0。远端登记 `20261113062649`，存储 SQL 哈希与批准版本一致。核对三张强制 RLS 表、六个 RESTRICT 外键、策略、约束、索引、公开 Invoker RPC 及受 RLS 约束的审计写入角色。[迁移回执](admin-distribution-m3-staging-migration.md#2026-11-13-staging-回执) |
| Security Advisor | PASS | 迁移前后均只有两条既有 `analytics_private` INFO。 |
| GoTrue 与 RLS | PASS | 两名管理员和一名普通用户分别从密码登录完成真实 TOTP。验证匿名、管理员 aal1、普通用户 aal2 的读取及写入边界，管理员 aal2 仅通过任务 RPC 写入。M1/M2/M3 的 PostgreSQL 只读 smoke 均通过。 |
| PostgREST / RPC | PASS | 同请求重放、同稿多次排期、两个管理员并发只成功一次，冲突返回 HTTP 409 / `PT409`。覆盖快照隔离、显式采用新版、源删除限制、人工回填、纠正事件、取消和归档账号。 |
| 事务回滚 | PASS | 两轮分别对单个请求注入审计写入失败，任务版本保持 3、日志仍为三条，回滚后注入触发器为零。 |
| Storage | PASS | 两件真实 WebP 各 23,488 字节。仅剩任务历史引用时删除返回 `ResourceReferenced`，UUID 及字节保留。解除引用后用 Storage API 删除，公开 GET 及数据库读回确认缺失。 |
| 真实 Edge | PASS | 本机 Vite 连接获批 Staging。管理员 TOTP、任务创建、刷新、日历、审计、素材加载及 JSON 导出均通过。复验记录 7 次 Auth、20 次 REST、1 次 Storage 请求。REST 含一次任务写入，页面异常 0。 |
| PostgREST 精确版本 | BLOCKED | REST 根端点返回 HTTP 401。管理 API 的 REST 健康查询返回 HTTP 200 / ACTIVE_HEALTHY，响应未提供版本。权限、并发与 RPC 功能使用真实 PostgREST 实测通过。[服务健康接口](https://supabase.com/docs/reference/api/v1-get-services-health) |

观察到 GoTrue `v2.197.0`、Storage `1.94.2`、PostgreSQL `17.11`（项目报告构建号 `17.11.0.018`）、Edge `157.0.4341.46`。

### 执行与清理记录

| 本轮运行 | 结果 | 证据 |
| --- | --- | --- |
| `1f6744d1-224f-4a64-b573-23dc4f29dddb` | FAIL，退出码 1 | 13 分 26 秒，含人工检查点。业务检查通过。清理时两件文件已经删除，公开 GET 返回 HTTP 400，响应体为 `404 / NoSuchKey`，被旧断言误报。独立 GET 和数据库读回确认该轮夹具均已清除。 |
| `9c45aa8e-179e-4273-80cf-22c6441b9f3b` | FAIL，退出码 1 | 17 分 50 秒，含人工检查点。业务检查及真实浏览器素材加载通过。连接器清理确认两次过期，runner 清除了三名 Auth 用户和该轮密钥。数据库关联仍在时，两次 Storage 删除按预期被拒绝。 |
| 第二轮限定范围恢复 | PASS | 核对 run_id、任务和素材 UUID、两名原操作者及九条审计请求。Dashboard 单事务删除三条任务、九条日志、四条历史素材关联及本轮源、账号和稿件。Storage 清理约 16 秒，退出码 0，删除两件测试图片后读回清零。 |
| 测试资源最终核对 | PASS | 两轮的 Auth 用户、MFA 因子、会话、身份、管理员登记、账号、源、稿件、任务、日志及 Storage 元数据均无残留。两轮及恢复所用的三枚临时 Secret API Key 均已按 run_id 和 UUID 确认撤销。 |
| Scoped PAT | PASS | 用户在 Supabase 撤销本轮短期令牌。2026-11-13 14:22 UTC 重查同一项目健康接口，由 HTTP 200 变为 HTTP 401。已删除本机 DPAPI 交接副本。 |

完整 runner 两次均以退出码 1 结束，业务验证和最终资源清理由上述独立读回支撑。历史素材引用在正式采用保留策略前持续阻止删除。生产迁移及上线须另行审查。

[原始迁移](../supabase/migrations/20261112190304_add_distribution_publish_calendar.sql) · [安全审查](admin-distribution-m3-security.md#staging-执行步骤) · [回滚草案](../supabase/rollbacks/distribution_m3.sql)

## 界面截图

截图来自本机 Edge 使用测试夹具。三种尺寸均验证日历和任务详情无横向溢出，并等待圆形主题切换结束。

| 视口 | 浅色 | 深色 |
| --- | --- | --- |
| 1440 px | [日历](distribution/m3-screenshots/distribution-m3-1440-light.png) · [详情](distribution/m3-screenshots/distribution-m3-1440-light-task.png) | [日历](distribution/m3-screenshots/distribution-m3-1440-dark.png) · [详情](distribution/m3-screenshots/distribution-m3-1440-dark-task.png) |
| 390 px | [日历](distribution/m3-screenshots/distribution-m3-390-light.png) | [日历](distribution/m3-screenshots/distribution-m3-390-dark.png) |
| 320 px | [日历](distribution/m3-screenshots/distribution-m3-320-light.png) | [日历](distribution/m3-screenshots/distribution-m3-320-dark.png) |
