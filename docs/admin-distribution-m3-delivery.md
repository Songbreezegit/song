# M3 开发与验收记录

开发分支 feat/admin-distribution-m3，基线 e6e2f8ec481dbdc64fe5ae790aceaebab5523414。开发在独立工作树进行。

## 本地回归

使用 Node.js 24.12.0、npm 11.6.2 和 Microsoft Edge 157.0.4341.46。E2E 沿用现有礼账封面 PNG 夹具。浏览器套件使用受控 HTTP 响应，数据库套件使用隔离的 PGlite PostgreSQL，依次应用仓库中的迁移。

| 命令 | 结果 | 用例、时间和退出码 |
| --- | --- | --- |
| npm run lint | PASS | 约 3.0 秒，退出码 0 |
| npm run build | PASS | Vite 构建约 0.9 秒，退出码 0。既有主包大于 500 kB 的提示保留 |
| npm test | PASS | 22 个文件、310 项通过，6.63 秒，退出码 0 |
| npm run test:e2e | PASS | 230 项通过，14.3 分钟，退出码 0 |
| npm run test:security | PASS | 两种 CSP 模式共 16 项通过，39.8 秒，退出码 0 |

M3 本地数据库覆盖四种 JWT 身份与缺失 aal、直接写入和伪造日志拒绝、额外 permissive 策略、创建与报告重放、过期版本、状态限制、审计写入失败回滚、源和素材保护、归档、数据清理及回滚草案。浏览器覆盖三种日历视图、两处创建入口、时区与 DST、冲突恢复、取消、报告及纠正、导出、刷新、分页和主题切换。最后一次表单与样式调整后，M3 专项 E2E 八项复跑通过，36.5 秒，退出码 0。

开发期间，隔离数据库的 RESTRICT 返回 23001，已同时覆盖 23503 和 23001，并验证触发的具体外键。Storage 用例使用仅被本任务引用的对象，以单独验证 M3 外键。清理脚本最初出现变量与列重名，修正后已验证清单外事件会阻断清理。完整命令以上表最终结果为准。

## Staging

| 核验 | 状态 | 证据 |
| --- | --- | --- |
| 项目身份与权限前置 | PASS | song-staging，uartrtcmskyuqxawjqlx，PostgreSQL 17.11。M1/M2 八条迁移已登记，六张分发表强制 RLS，四个 M2 RPC 为 Invoker。读取时 M3 表与私有 schema 尚不存在。 |
| M2 存储 SQL | PASS | 20261110174923 的 SHA-256 为 48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174。20261110175856 的 SHA-256 为 acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21。 |
| 迁移前 Security Advisor | PASS | 两条既有 INFO 涉及 analytics_private 的内部表。 |
| M3 单条迁移 | BLOCKED | 等待独立 Staging 写入批准。 |
| GoTrue TOTP、REST/RPC 并发与事务、Storage、真实浏览器、资源清理 | BLOCKED | 依赖已核验的 M3 迁移。当前阶段未创建测试资源。 |

[M3 原始 SQL](../supabase/migrations/20261112190304_add_distribution_publish_calendar.sql) 为 25,918 字节，SHA-256 为 0bcaa55d9d27da88703fa5d5ce260b19cb8988e89ffc6cdd17b957cfdff5046f。运行说明见 [安全审查](admin-distribution-m3-security.md#staging-执行步骤)。

## 界面截图

截图来自本机 Edge 使用测试夹具。三种尺寸均验证日历和任务详情无横向溢出，并等待圆形主题切换结束。

| 视口 | 浅色 | 深色 |
| --- | --- | --- |
| 1440 px | [日历](distribution/m3-screenshots/distribution-m3-1440-light.png) · [详情](distribution/m3-screenshots/distribution-m3-1440-light-task.png) | [日历](distribution/m3-screenshots/distribution-m3-1440-dark.png) · [详情](distribution/m3-screenshots/distribution-m3-1440-dark-task.png) |
| 390 px | [日历](distribution/m3-screenshots/distribution-m3-390-light.png) | [日历](distribution/m3-screenshots/distribution-m3-390-dark.png) |
| 320 px | [日历](distribution/m3-screenshots/distribution-m3-320-light.png) | [日历](distribution/m3-screenshots/distribution-m3-320-dark.png) |
