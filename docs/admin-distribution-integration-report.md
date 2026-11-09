# 内容分发 M1 云端 Staging 验收报告

基线为 `b400f0779a0eab76fcfd96d292956f30221a3a70`。抓取远程引用后，`codex/distribution-m1` 工作树干净，分支 HEAD 与基线一致。

**本轮结论 BLOCKED。** 独立 Staging 已创建并完成前两条真实迁移。当前 Supabase 连接可管理项目和执行 SQL，但本地验收进程缺少仅限 Staging 的 Scoped PAT，尚未进入临时用户初始化。生产迁移前置条件因此为 **BLOCKED**。

## 项目与预检

| 检查 | 结论 | 证据 |
| --- | --- | --- |
| Organization | PASS | `Songbreezegit's Org`，`hzrxoowmgbfkxtechkoz`，Free |
| 新项目身份 | PASS | `song-staging`，Ref `uartrtcmskyuqxawjqlx`，`ap-northeast-1`，`ACTIVE_HEALTHY` |
| API 地址 | PASS | `https://uartrtcmskyuqxawjqlx.supabase.co`，由管理工具返回 |
| 创建时间 | PASS | 2026-11-09 19:24:26（北京时间） |
| 新增费用 | PASS | 平台报价 USD 0/月，使用 Free 默认计算配置 |
| 生产和旧项目状态 | PASS | 创建前后分别保持 `vfgmptjfcfgptaqblydd` 为 `ACTIVE_HEALTHY`，`ttbjtymyuoqkuntcqgob` 为 `INACTIVE` |
| 验收进程的 Staging 凭据 | BLOCKED | 等待只授权该 Ref 的 Scoped PAT。公开密钥及临时 Auth Admin 专用密钥由 runner 在运行时从该项目获取 |

本轮云端写入为创建 Staging 和两条已核对 Ref 的迁移。原生产项目及暂停项目仅进行了管理面状态查询。Staging 保留供后续阶段复验。[Free 项目计费](https://supabase.com/docs/guides/platform/billing-on-supabase) · [Scoped PAT 权限](https://supabase.com/docs/guides/platform/personal-access-tokens)

## 真实服务版本

| 服务 | 结论 | 版本与来源 |
| --- | --- | --- |
| PostgreSQL | PASS | `17.11`，数据库 `current_setting('server_version')`。管理面发布版本为 `17.11.0.018` |
| GoTrue | PASS | `v2.197.0`，Staging `auth_logs` 版本字段 |
| PostgREST | PASS | `14.18`，Staging `postgrest_logs` |
| Storage | PASS | `1.89.13`，`GET /storage/v1/version` 返回 HTTP 200 和纯文本版本 |

版本检查属于服务识别。Storage 版本首次按 JSON 解析失败，按纯文本重读后确认实际版本。

## 迁移

| 仓库文件 | 结论 | 云端执行证据 |
| --- | --- | --- |
| `20260916000000_initial_schema.sql` | PASS | Staging 迁移历史 `20261109123623 initial_schema`，实际查到 `projects`、`articles` 和 `media` |
| `20260916044953_fix_backend_v1.sql` | PASS | Staging 迁移历史 `20261109123854 fix_backend_v1`，基础表 RLS、ACL 和 Storage 桶配置已复查 |
| `20261004093439_enforce_admin_mfa.sql` | BLOCKED | 先完成唯一临时管理员的真实 TOTP 绑定 |
| `20261007052225_add_private_analytics.sql` | BLOCKED | 等待前序迁移 |
| `20261108173132_add_private_distribution_m1.sql` | BLOCKED | 等待前序迁移 |

前两条使用 Supabase 迁移工具逐条应用，表和策略由 SQL 实际读取。已确认 `projects`、`articles`、`site_settings`、`admin_users` 的 RLS，匿名无管理员表读取权限，登录角色无管理员表插入权限。公开 `media` 桶限制为 5 MiB，接受 JPEG、PNG、WebP。托管迁移历史使用平台记录的时间戳。

## 云端功能验收

| 检查 | 结论 | 当前阻塞 |
| --- | --- | --- |
| 真实 GoTrue 临时用户初始化、密码登录、TOTP 注册与验证、JWT 签发和身份核验 | BLOCKED | 缺少 Staging Auth Admin 初始化和项目自检所需的 Scoped PAT |
| 四张分发表 RLS、FORCE RLS、策略、RPC invoker、FK 和触发器，以及只读 smoke | BLOCKED | M1 迁移尚未执行 |
| `anon` 四表读写和 RPC 边界 | BLOCKED | 等待迁移及真实 HTTP 探针 |
| 普通用户 aal2 四表读写和 RPC 边界 | BLOCKED | 等待真实用户会话 |
| 管理员 aal1 四表读写和 RPC 边界 | BLOCKED | 等待独立真实会话 |
| 管理员 aal2 读写、账号物理删除受限和合法保存 | BLOCKED | 等待真实管理员会话 |
| RPC 版本冲突、关联失败回滚、归档 REST PATCH 和历史关联、PostgREST 嵌套查询 | BLOCKED | 等待真实 HTTP 探针 |
| Storage WebP 上传、引用拒删、元数据及下载字节一致、解除引用删除和残留查询 | BLOCKED | 等待真实 Storage 与分发关联 |
| 独立 Vite 连接 Staging 的真实界面冒烟 | BLOCKED | 等待真实账号和素材 |
| 测试数据和凭据清理 | BLOCKED | 尚未创建测试用户、运行专用 API key 或媒体对象 |
| 生产迁移前置条件 | BLOCKED | 真实云端权限、原子保存、Storage 一致性和界面结果均待验收 |

未执行用例的 P1、P2 判定保持 BLOCKED。阻塞类型为运行时授权。最终只读查询确认 Staging 目前没有临时 Auth 用户、业务管理员或媒体测试对象。

## 本轮代码回归

| 命令 | 结论 | 结果 |
| --- | --- | --- |
| `npm run lint` | PASS | 无警告 |
| `npm run build` | PASS | Vite 保留主包体积提示 |
| `npm test` | PASS | 235 项 |
| `npm run test:e2e` | PASS | 208 项，13.6 分钟 |
| `npm run test:security` | PASS | 12 项 |

云端 runner 通过语法、RFC 6238 参考向量和四项离线目标拒绝检查。上表为本轮仓库回归，云端功能状态以上一节为准。既有本地验收脚本仍保留环回地址限制。

收到项目范围内的 Scoped PAT 后，从临时 Auth 用户初始化继续，使用已有 `uartrtcmskyuqxawjqlx` 和迁移历史。[Staging 复验步骤](admin-distribution-storage-acceptance.md#云端-staging)

上轮本机受阻记录仍可查阅。[本机验收记录](https://github.com/Songbreezegit/song/blob/b400f0779a0eab76fcfd96d292956f30221a3a70/docs/admin-distribution-integration-report.md)
