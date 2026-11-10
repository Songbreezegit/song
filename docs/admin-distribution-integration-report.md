# 内容分发 M1 云端 Staging 验收报告

**真实云端验收通过。** 2026 年 11 月 9 日至 10 日（北京时间），在现有 `song-staging` 使用 GoTrue 签发的真实会话完成 PostgREST、保存 RPC、Storage 和后台界面验收。完整 runner 退出码为 0。最终 run ID 为 `573bb545-cd1c-427e-9286-a5d2986e6288`。

复验基线为 `e392a1ac8367ccd70939da5b84b507ab98f0607b`，分支为 `feat/admin-distribution-m1`。分支最初与原分支同指 `2470a47a5ec0ee5a8d75c5318be7378daabff820`。历史审查保留在已关闭的 PR #9。验收写入限定于 Staging，GitHub 交付保留为草稿。[PR #10](https://github.com/Songbreezegit/song/pull/10) · [历史 PR #9](https://github.com/Songbreezegit/song/pull/9)

## 项目与版本

| 项目 | 实测信息 |
| --- | --- |
| Staging | `song-staging`，Ref `uartrtcmskyuqxawjqlx`，组织 `hzrxoowmgbfkxtechkoz`，区域 `ap-northeast-1`，`ACTIVE_HEALTHY` |
| 项目初始化 | 2026-11-09 19:24:26 创建，Free 项目当时报价 USD 0/月，本轮复用同一项目 |
| PostgreSQL | `17.11`，数据库 `server_version`，管理面版本 `17.11.0.018` |
| GoTrue | `v2.197.0`，Staging `/auth/v1/health` 返回 HTTP 200 |
| PostgREST | `14.18`，同项目启动日志。REST 根路径对验收会话返回 401，版本由日志独立确认 |
| Storage | `1.89.13`，Staging `/storage/v1/version` 返回 HTTP 200 |
| 验收运行时 | Node.js `24.12.0`，npm `11.6.2`，Supabase JS `2.116.0`，Playwright `1.63.0`，Edge |

本轮通过项目级 Scoped PAT 使用 Management API。数据库操作使用指定 Ref 的 Supabase 连接和控制台，未使用 Supabase CLI 连接远程数据库。[Scoped PAT 权限](https://supabase.com/docs/guides/platform/personal-access-tokens)

## 实际迁移

| 仓库文件 | Staging 迁移记录 |
| --- | --- |
| `20260916000000_initial_schema.sql` | `20261109123623 initial_schema` |
| `20260916044953_fix_backend_v1.sql` | `20261109123854 fix_backend_v1` |
| `20261004093439_enforce_admin_mfa.sql` | `20261109152820 enforce_admin_mfa`，执行前核实唯一管理员的 TOTP 已 verified |
| `20261007052225_add_private_analytics.sql` | `20261109152838 add_private_analytics` |
| `20261108173132_add_private_distribution_m1.sql` | `20261109153506 add_private_distribution_m1`，历史复查确认只执行一次 |
| `20261109161000_report_distribution_version_conflicts.sql` | `20261109161000 report_distribution_version_conflicts`，核对 Staging 独有迁移记录后，在其 SQL Editor 的同一事务替换函数并记录版本 |

后续迁移执行前后，数据库中实际函数正文只差 `40001` 到 `PT409`。函数签名、所有者、EXECUTE 授权、`SECURITY INVOKER`、空 `search_path` 和策略摘要均一致。四张分发表仍启用 RLS 与 FORCE RLS，四条 restrictive MFA 策略和 Storage `RESTRICT` 外键均已核实。五种上下文的数据库 smoke 通过，写入与新增测试记录均为零。[SQL 与权限审查](admin-distribution-security.md)

## 真实 HTTP 与界面结果

| 检查 | 结果与证据 |
| --- | --- |
| GoTrue MFA | PASS。管理员和普通用户都以密码获得 aal1，通过真实 TOTP 注册、challenge 与 verify 获得已签发的 aal2。另取管理员独立 aal1 会话，核对身份、级别和唯一管理员登记 |
| 匿名 PostgREST/RPC | PASS。四表读写及 RPC 共 17 项，均为 HTTP 401 / `42501` |
| 普通用户 aal2、管理员 aal1 | PASS。各 17 项，受限查询或更新返回零行，写入由 RLS 或关联触发器拒绝，RPC 均返回 403 / `42501`。复查两份草稿及关联均保持一致 |
| 管理员 aal2 | PASS。能创建、修改、归档账号，创建及删除草稿，查询 PostgREST 嵌套账号/素材关联。直接物理删除账号返回 403 / `42501` |
| RPC 版本冲突与原子性 | PASS。过期版本返回 409 / `PT409`，当前稿件及两类关联保持一致。非法素材关联返回 409 / `23503`，稿件、版本及关联一起回滚 |
| 账号归档 | PASS。首次 PATCH 以服务器时间归档并停用。四种恢复或编辑 PATCH 均返回 `55000`，原有目标关联保留，新增归档目标返回 `23503` |
| Storage 引用保护 | PASS。上传 23,488 字节 WebP。引用时删除返回 HTTP 400 / `ResourceReferenced`，原对象 UUID 保留，绕开下载缓存后仍以 HTTP 200 取得逐字节相同的文件 |
| Storage 解除引用 | PASS。通过 RPC 解除引用后删除成功，列表中对象消失，下载返回 HTTP 400 且响应体为 404，残留媒体关联为零 |
| 真实后台冒烟 | PASS。独立 Vite 只连接 Staging。真实登录、TOTP、创建账号、带目标和图片保存草稿、刷新恢复、未保存提示、归档只读及深浅主题切换均通过。记录 Auth 10 次、REST 29 次、Storage 9 次请求，未处理异常为零 |

## 失败路径与清理

- 主动中断 run `7dd42e98-ac50-4e00-8a46-7920faae8e44` 在创建两个临时用户及运行专用密钥后停在管理员登记检查点。退出码 1 符合预期。两个用户在 GoTrue 返回不存在，密钥 UUID 与完整运行标记在 Management API 查询中均已消失。
- 首次完整运行将两种受限身份的关联 INSERT 都期待为 `42501`。实测 `BEFORE` 触发器先检查受 RLS 隐藏的关联对象，返回表对应的 409 / `23503`。修订探针匹配精确的触发器消息，并加入第二份草稿和两个关联集合的回读断言。[PostgreSQL 17 策略与触发器顺序](https://www.postgresql.org/docs/17/sql-createpolicy.html)
- 原 RPC 的业务版本冲突使用 `40001`，实际调用超时。Staging 日志在约 54 秒内记录了 53 次同一错误消息，数据库回读确认最新稿件及关联仍在。PostgREST 14 会重试该 SQLSTATE。后续迁移改用 `PT409`，真实 HTTP 复验通过。前端保留旧错误码兼容。[Supabase 关于 40001 重试的说明](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)
- 中断或失败运行遗留的测试稿件、账号及 WebP 按 Project Ref、run ID、资源 UUID 和精确标记清理。完整复验后的两条归档记录也按相同方式清理。一个清理专用密钥的首次撤销遇到 HTTP 429，限流窗口后按原 UUID 和运行标记重试成功。runner 补充一次有界的 429 清理重试，回归验证等待窗口及其他密钥保持不变。
- 退出后独立核对本轮 10 个临时密钥全部撤销。Staging 的测试用户、Auth 会话、TOTP 因子、管理员登记、分发账号、稿件、关联和媒体对象均为零。保留项目与六条迁移，本机加密 PAT 副本已删除。强制终止或持续不可达时，可按脱敏日志中的项目、运行标记和资源 UUID 核对残留。[隔离复验与清理步骤](admin-distribution-storage-acceptance.md)

## 仓库回归

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | PASS |
| `npm run build` | PASS，保留 Vite 主包体积提示 |
| `npm test` | PASS，253 项，含 13 项凭据清理回归与 5 项关联拒绝响应回归 |
| `npm run test:e2e` | PASS，208 项，12.5 分钟 |
| `npm run test:security` | PASS，12 项，覆盖 CSP Report-Only 和 Enforced |

首次 Vitest 启动因 Windows 沙箱临时目录中 Vite 转译文件不可见报 `ENOENT`，8 个测试文件未进入用例。使用可访问的本机临时目录重跑后全部通过。上述仓库回归与 Staging 实际请求分别记录，生产迁移及正式部署仍需另行批准。

[本机容器验收历史](https://github.com/Songbreezegit/song/blob/b400f0779a0eab76fcfd96d292956f30221a3a70/docs/admin-distribution-integration-report.md)
