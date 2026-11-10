# 内容分发 M2 交付记录

## 开发基线

- 仓库为 `Songbreezegit/song`，交付分支为 `feat/admin-distribution-m2`，交付 HEAD 以 Draft PR 的最后一个提交为准。
- 拉取后的 `origin/main` 为 `ae35d4a39b361ce0cf773e357d652e3aa18142ba`，对应已验收的 M1 合并提交。M2 在独立工作树开发。
- 本轮以远端 M2 的 `b53cf7f6d4367dabb0a6ac489fbbfc91068a63a5` 为审查基线，沿用 [Draft PR #11](https://github.com/Songbreezegit/song/pull/11)。
- Supabase CLI 3.0.0 生成 `20261110114036_review_distribution_source_fields.sql`，在 `20261110100401_add_distribution_platform_variants.sql` 之后执行。两条 Git LF 文件的哈希和应用顺序见 [迁移核对](admin-distribution-m2-security.md#真实-staging-验收步骤)。

## 交付范围

M2 支持按账号独立的平台稿、规则检查、预览、差异同步、复制与 JSON 导出。本轮修复将源快照改为逐字段核对，未选择的差异可在同一源版本继续处理。明确保留平台稿值、确认仅版本变化与同步都通过原子 RPC 写入。M1 沿用原表和权限。[工作区说明与规则来源](admin-distribution-m2.md) · [安全、SQL 与 Staging 操作](admin-distribution-m2-security.md)

## 本地测试

| 命令 | 结果 | 验证范围 |
| --- | --- | --- |
| `npm run lint` | PASS | Oxlint |
| `npm run build` | PASS | TypeScript 与 Vite。主入口产物约 630 kB，gzip 后约 195 kB，仍有 Vite 大块提示。 |
| `npm test` | PASS，20 个文件、282 项 | 包含 11 项 M2 应用合同测试和 18 项 M2 PGlite 数据库测试。后者执行 PostgreSQL SQL，身份由本地会话提供。 |
| `npm run test:e2e` | PASS，222 项通过，零跳过 | Edge、实际页面与受控 Supabase HTTP 响应。包含 14 项 M2 用例，既有封面用例使用本机礼账 PNG。 |
| `npm run test:security` | PASS，14 项 | Edge 下的 Report-Only 和 Enforced CSP、Auth、纯文本预览、安全媒体链接和导出字段。Supabase 响应使用测试夹具。 |
| Staging runner 防护 | PASS，两种拦截 | 本地验证错误 Ref 和缺 Scoped PAT 都在联网前退出。 |
| 回滚草案 | PASS，两种本地场景 | PGlite 验证非空 M2 拒绝回滚，空 M2 可移除新增对象并保留 M1 账号、内容源、关联表和保存 RPC。 |

审查回归覆盖同一源版本先同步正文再同步标题、保留精修标题、仅推广目标变化、连续源更新、源或稿件并发冲突、媒体顺序与原封面说明、失败后保留编辑器与勾选项。数据库测试还验证旧 M2 数据增量升级、确认条件和待发布校验导致的原子回滚。浏览器冲突回归用受控请求模拟另一会话在请求期间修改。既有路由降级用例故意阻断懒加载，日志中的加载错误已由测试验证为预期行为。

## 云端 Staging

2026-11-11（UTC+08:00）在 `song-staging`（`uartrtcmskyuqxawjqlx`）完成二次审查提交 `3acd6f8d7d0124349f42922ba4b25f7b4d4e972a` 的真实集成验收。项目为 `ACTIVE_HEALTHY`，区域为 `ap-northeast-1`。PostgreSQL 为 17.11，托管数据库镜像为 `17.11.0.018`。M1 历史为 `20261109153506 add_private_distribution_m1` 与 `20261109161000 report_distribution_version_conflicts`。M1 四张表均强制 RLS，保存 RPC 使用 `PT409`。

| 顺序 | 完整 SQL | Git LF 文件 SHA-256 | 审批及远端记录 |
| --- | --- | --- | --- |
| 1 | [新增平台稿与独立素材](../supabase/migrations/20261110100401_add_distribution_platform_variants.sql) | `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174` | PASS，官方单条迁移 API 返回 HTTP 200，远端登记为 `20261110174923 add_distribution_platform_variants` |
| 2 | [新增字段核对、保留和确认](../supabase/migrations/20261110114036_review_distribution_source_fields.sql) | `acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21` | PASS，官方单条迁移 API 返回 HTTP 200，远端登记为 `20261110175856 review_distribution_source_fields` |

两条 SQL 分别获批后按顺序执行。分别读回数据库历史中存储的完整 SQL，SHA-256 与 Git 文件一致。第 1 条核对两张表、22 个约束、七个索引、五个触发器、四条策略和三个公开 RPC。第 2 条核对非空 JSONB 字段 `source_retained_fields`、默认值 `{}`、新增约束和核对函数。最终两张 M2 表均强制 RLS，共有 23 个约束、七个索引、五个启用触发器和四条策略。四个公开 RPC 均为 `SECURITY INVOKER`，`search_path` 为空，`authenticated` 可执行，`anon` 无执行权限。安全顾问只返回一组既有的 INFO，涉及两张 `analytics_private` 表。[安全与验收步骤](admin-distribution-m2-security.md#真实-staging-验收步骤) · [迁移 2 回执](admin-distribution-m2-staging-migration-2.md#执行回执)

原 MCP 通道两次独立确认过期，一次请求传输失败。随后获批切换到官方单条迁移 API，使用仅限 Staging 的迁移 Scoped PAT。API 生成的远端版本号见上表，本地文件仍按仓库版本顺序排列。[原通道调查与迁移 1 命令](admin-distribution-m2-staging-channel.md)

### 真实测试与资源清理

执行 `node scripts/verify-distribution-m2-staging.mjs`，run ID 为 `b8c5ca72-f357-4ed6-aabb-22b3d94bb090`，退出码为 `0`。下表区分真实服务请求、使用合成 JWT claims 的只读 SQL smoke 和版本探测。此前的本地回归结果见上方，本轮交付仅更新验收文档。

| 检查 | 状态 | 证据或阻塞 |
| --- | --- | --- |
| Staging 项目、M1 迁移与保存 RPC 预检 | PASS | 已执行真实只读数据库查询和安全顾问基线检查。 |
| 原 MCP 迁移执行通道 | FAIL | 两次独立确认超时，一次请求传输失败，三次均未执行迁移。 |
| 官方单条迁移 API | PASS | 两条分别返回 HTTP 200，按序核对历史、存储 SQL 哈希、对象和权限。 |
| 只读数据库安全 smoke | PASS | SQL 验证五种条件，包括管理员缺失 `aal` 的情形，未执行写入。 |
| 真实 GoTrue 和 PostgREST 权限 | PASS | 临时管理员与普通用户均经密码登录、TOTP 注册和验证获得签发的 `aal2`。匿名、管理员 `aal1`、普通用户 `aal2` 的 REST/RPC 越权访问均被拒绝，管理员 `aal2` 成功生成和保存平台稿。 |
| 同平台独立保存与源更新隔离 | PASS | 两个账号各自生成快照，重复请求返回同一稿件。一稿可独立修改文案、标签、封面和素材顺序，另一稿保持初始内容。源更新保留人工修改。 |
| 同版部分同步、明确保留、仅元数据确认 | PASS | 源标题和正文同时变化时先同步正文，标题仍可随后采纳。只修改推广目标可确认版本。后续源更新可明确保留手工正文。 |
| 多次源更新、双版本冲突和原子回滚 | PASS | 过期源版本和过期稿件版本均返回 HTTP 409 / `PT409`。并发保存只提交一次。无效媒体外键返回 `23503`，版本、文案与素材关联完整保留。 |
| 真实 Storage 引用与删除 | PASS | 独立平台稿引用触发 `ResourceReferenced`，对象 UUID 与绕过缓存读取的文件字节保持一致，解除引用后删除成功。 |
| 真实 Edge 浏览器创建、保存、刷新与导出 | PASS | 隔离 Vite 使用实际 GoTrue 密码及 TOTP 登录，保存后刷新并下载第 2 版 JSON，核对稿件和账号 UUID、版本与文案。实际请求数为 Auth 6、REST 16、Storage 7，页面异常 0。 |
| 服务版本 | PASS / BLOCKED | GoTrue `v2.197.0` 与 Storage `1.89.13` 返回 HTTP 200。PostgREST 版本探测 `/rest/v1/` 返回 HTTP 401，未取得版本号。 |
| 本轮测试资源清理 | PASS | 独立查询确认 Auth 用户、MFA 因子、会话、身份、管理员登记、分发账号和源、目标及素材关联、平台稿和素材关联、Storage 对象计数均为 0。Management API 按本轮 UUID 和运行标记复核临时 Secret API Key 数为 0。 |
| 两枚临时 Scoped PAT 清理 | PASS | 用户在 Supabase 控制台撤销本轮验收和迁移令牌。两枚令牌从列表消失，原有只读端点均返回 HTTP 401，本机对应的两份 DPAPI 副本已删除。 |

## 截图索引

截图来自本机 Edge、模拟 Supabase 数据与真实页面渲染。

| 视口 | 浅色 | 深色 |
| --- | --- | --- |
| 1440 px | [桌面浅色](distribution/m2-screenshots/distribution-m2-1440-light.png) | [桌面深色](distribution/m2-screenshots/distribution-m2-1440-dark.png) |
| 390 px | [手机浅色](distribution/m2-screenshots/distribution-m2-390-light.png) | [手机深色](distribution/m2-screenshots/distribution-m2-390-dark.png) |
| 320 px | [窄屏浅色](distribution/m2-screenshots/distribution-m2-320-light.png) | [窄屏深色](distribution/m2-screenshots/distribution-m2-320-dark.png) |

## 发布前检查

真实 Staging 功能验收与资源清理通过，生产迁移及发布需独立审查和批准。若某个环境已用旧同步逻辑覆盖过完整核对快照，增量迁移会从现有快照继续记录，已丢失的字段基线无法可靠重建。Staging 两张 M2 表在验收前为空，清理后本轮数据计数均为 0。视频素材准备和平台规则限制见 [工作区说明](admin-distribution-m2.md#平台规则来源)。
