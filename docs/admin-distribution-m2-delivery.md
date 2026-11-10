# 内容分发 M2 交付记录

## 开发基线

- 仓库为 `Songbreezegit/song`，交付分支为 `feat/admin-distribution-m2`，交付 HEAD 以 Draft PR 的最后一个提交为准。
- 拉取后的 `origin/main` 为 `ae35d4a39b361ce0cf773e357d652e3aa18142ba`，对应已验收的 M1 合并提交。M2 在独立工作树开发。
- Supabase CLI 3.0.0 创建 M2 迁移 `20261110100401_add_distribution_platform_variants.sql`。Git 中 LF 文件的 SHA-256 为 `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174`。

## 交付范围

内容源编辑器新增平台版本入口。M2 新增目标账号列表、平台稿编辑、规则注册表、预览、差异同步、复制和 JSON 导出。数据库新增两张表、三项 Invoker RPC、约束与 RLS。M1 的内容源和账号沿用原表、版本与权限。现有源草稿删除入口补充级联提示。[工作区说明与各平台规则来源](admin-distribution-m2.md) · [安全、SQL 与 Staging 操作](admin-distribution-m2-security.md)

## 本地测试

| 命令 | 结果 | 验证范围 |
| --- | --- | --- |
| `npm run lint` | PASS | Oxlint |
| `npm run build` | PASS | TypeScript 与 Vite。主入口产物约 630 kB，gzip 后约 195 kB，仍有 Vite 大块提示。 |
| `npm test` | PASS，20 个文件、276 项 | 包含 10 项 M2 应用合同测试和 13 项 M2 PGlite 数据库测试。后者执行实际 PostgreSQL SQL，身份由本地会话提供。 |
| `npm run test:e2e` | PASS，217 项通过、1 项默认跳过 | Edge、实际页面与受控 Supabase HTTP 响应。M1 回归与 10 项 M2 用例通过。既有可选封面用例用本机礼账 PNG 单独补跑，1 项通过。 |
| `npm run test:security` | PASS，14 项 | Edge 下的 Report-Only 和 Enforced CSP、Auth、纯文本预览、安全媒体链接和导出字段。Supabase 响应使用测试夹具。 |
| Staging runner 防护 | PASS，两种拦截 | 本地验证错误 Ref 和缺 Scoped PAT 都在联网前退出。 |
| 回滚草案 | PASS，两种本地场景 | PGlite 验证非空 M2 拒绝回滚，空 M2 可移除新增对象并保留 M1 账号、内容源、关联表和保存 RPC。 |

首轮本地测试发现错误页重试按钮的定位与实际文案不一致，修正后重新运行全量回归。默认沙箱中的两次浏览器运行停在本地服务启动阶段并取消，表中结果取允许回环服务后启动的测试。既有路由降级用例故意阻断懒加载并验证错误边界，产生预期的控制台记录。PGlite 对 `ON DELETE RESTRICT` 的断言核对其 SQLSTATE `23001` 与实际约束名。真实 Storage 删除行为单列验收。

## 云端 Staging

目标为 `song-staging`（`uartrtcmskyuqxawjqlx`）。2026-11-10 的只读复核返回 PostgreSQL 17.11，迁移历史包括 `20261109153506 add_private_distribution_m1`、`20261109161000 report_distribution_version_conflicts`。M1 四张表均强制 RLS，保存 RPC 使用 `PT409`，M2 迁移记录和两张表均尚未出现。

| 检查 | 状态 | 证据或阻塞 |
| --- | --- | --- |
| Staging 项目、M1 迁移与保存 RPC 预检 | PASS | 实际只读数据库查询。 |
| M2 迁移与迁移后只读 smoke | BLOCKED | 等待该项目的 M2 SQL 写入审批。 |
| GoTrue 登录、TOTP 与 REST/RPC 权限 | BLOCKED | 等待迁移和该项目的 Scoped PAT。 |
| 账号稿快照、同步、HTTP 409 与原子回滚 | BLOCKED | 等待真实 API 验收。 |
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

真实 Staging 验收是复审及发布前的必经检查。平台规则只覆盖本地准备及已确认的公开限制，视频素材需要在外部准备。M3 以平台稿 ID、明确版本与账号快照作为后续计划和人工发布记录的接入点。
