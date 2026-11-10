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

目标为 `song-staging`（`uartrtcmskyuqxawjqlx`）。2026-11-10 的只读复核返回 PostgreSQL 17.11，迁移历史包括 `20261109153506 add_private_distribution_m1`、`20261109161000 report_distribution_version_conflicts`。M1 四张表均强制 RLS，保存 RPC 使用 `PT409`，M2 迁移记录和两张表均尚未出现。

| 检查 | 状态 | 证据或阻塞 |
| --- | --- | --- |
| Staging 项目、M1 迁移与保存 RPC 预检 | PASS | 实际只读数据库查询。 |
| M2 迁移与迁移后只读 smoke | BLOCKED | 已提交该项目的两条最终 SQL 及哈希审批，等待明确授权。 |
| GoTrue 登录、TOTP 与 REST/RPC 权限 | BLOCKED | 等待迁移和该项目的 Scoped PAT。 |
| 账号稿快照、部分同步、保留和仅版本确认、HTTP 409 与原子回滚 | BLOCKED | 等待真实 API 验收。 |
| 独立 Storage 引用、拒删保留字节、解除引用后删除 | BLOCKED | 等待真实 Storage 验收。 |
| 隔离后台创建、刷新与导出 | BLOCKED | 等待真实浏览器和 GoTrue 验收。 |
| 本轮测试资源清理 | BLOCKED | 真实流程尚未启动，没有本轮测试账号、对象或临时 Secret API Key。 |

## 截图索引

截图来自本机 Edge、模拟 Supabase 数据与真实页面渲染。

| 视口 | 浅色 | 深色 |
| --- | --- | --- |
| 1440 px | [桌面浅色](distribution/m2-screenshots/distribution-m2-1440-light.png) | [桌面深色](distribution/m2-screenshots/distribution-m2-1440-dark.png) |
| 390 px | [手机浅色](distribution/m2-screenshots/distribution-m2-390-light.png) | [手机深色](distribution/m2-screenshots/distribution-m2-390-dark.png) |
| 320 px | [窄屏浅色](distribution/m2-screenshots/distribution-m2-320-light.png) | [窄屏深色](distribution/m2-screenshots/distribution-m2-320-dark.png) |

## 发布前检查

真实 Staging 验收仍是发布门槛。若某个环境已用旧同步逻辑覆盖过完整核对快照，增量迁移会保留现有数据，从当前快照继续记录后续进度，已丢失的字段基线无法可靠重建。本次只读复核时 Staging 尚无 M2 记录。视频素材准备和平台规则限制见 [工作区说明](admin-distribution-m2.md#平台规则来源)。
