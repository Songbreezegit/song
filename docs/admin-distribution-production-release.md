# 松屿内容分发 M1 生产发布记录

**生产数据库验收 PASS。** 2026-11-10（北京时间）完成生产备份、两条获批 SQL 和只读安全验收。网站合并、Cloudflare 部署及正式冒烟将单独记录。

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| P1 仓库、项目和数据库基线 | PASS | 功能分支与已验收提交一致，生产健康，未发现超出已知历史版本差异的应用 schema 漂移 |
| P2 生产数据库备份 | PASS | 五个 schema 的逻辑归档已完整解码，关键对象与权限覆盖核对通过。两件 PNG 单独备份并校验 |
| P3 两条 SQL 静态核对 | PASS | 从验收提交提取原始 Git blob 计算 SHA-256，迁移前生产无同名残留 |
| P0 生产写入确认 | PASS | 所有者分别批准 A 和 B，工具按项目 Ref 应用两份原始 SQL |
| P4–P6 执行迁移、数据库安全验收 | PASS | A、B 的生产历史及 SQL 哈希已复核，PT409 与权限确认，五种身份只读 smoke 通过，无新增安全顾问项 |
| P7–P9 上线检查、合并和 Cloudflare 部署 | BLOCKED | 草稿 PR #10 保持开放，正式部署仍为原版本 |
| P10 正式环境冒烟 | BLOCKED | 只记录了旧版公共 HTTP 基线，正式管理员登录和 M1 冒烟待发布后执行 |

## 仓库和当前部署

- 仓库 `Songbreezegit/song`，`main` 为 `38d27ae2f43764e6a97b0a879d17aac1edcd3966`。
- `feat/admin-distribution-m1` 及 PR #10 的 HEAD 为 `b2a21ae36a97428c096ec7a8b9e69cadd69238c8`。功能分支领先 6 个提交，落后 0 个。GitHub 确认可合并，PR 仍为草稿。该提交的 lint、build、253 项单元、208 项 E2E、12 项浏览器安全测试及真实 Staging 验收记录有效。[PR #10](https://github.com/Songbreezegit/song/pull/10) · [已验收的 Staging 报告](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/docs/admin-distribution-integration-report.md)
- Cloudflare Worker `song` 连接 `Songbreezegit/song`。控制台显示生产分支 `main` 使用 `npm run build` 和 `npx wrangler deploy`，非生产分支使用 `npx wrangler versions upload`。当前稳定版本 `f3b60489-fe7c-4c63-b304-277f1eaf6470` 对应 `38d27ae`，控制台显示其承担 100% 流量。[生产构建回执](https://github.com/Songbreezegit/song/runs/128780579873) · [Cloudflare 分支构建规则](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
- 正式站 `/`、`/zh/`、`/zh/work`、`/zh/notes`、`/admin/login` 的 HTML 均返回 HTTP 200。后台登录 HTML 含强制 CSP、`X-Frame-Options: DENY` 和 `Cache-Control: no-store`。这些是旧版 HTTP 基线，正式上线后的登录和功能冒烟另行验收。[正式站](https://songisle.xyz/)

## 生产数据库基线

生产项目 `song`，Ref `vfgmptjfcfgptaqblydd`，`ACTIVE_HEALTHY`，PostgreSQL `17.6`，平台发行版本 `17.6.1.166`。数据库只读快照时间为 2026-11-10 01:25:51（北京时间）。

| 项目 | 结果 |
| --- | --- |
| 管理员和 Auth | 1 条管理员登记关联 1 个有效 Auth 用户，已验证 TOTP 为 1 |
| 业务内容 | 1 个已发布项目，0 篇文章，1 条站点设置 |
| 统计 | 31 条页面日统计、5 条内容日统计、15 条事件收据及 1 条维护记录。统计会随真实访问更新 |
| Storage | `media` 桶公开，单文件上限 5 MiB，接受 JPEG、PNG、WebP。目录中 2 件 PNG，合计 3,476,452 字节 |
| 已有结构、RLS 和 ACL | 与已验收 Staging 的应用基线相比，8 张已有应用表的列、约束、索引、触发器和 ACL 一致，25 条策略及 3 个已有函数一致。`storage.objects.id` 为 UUID 主键，`auth.users.id` 为 UUID |
| M1 残留 | 四张分发表及同名对象、私有 schema、函数、策略、触发器、迁移记录均未发现 |
| 安全顾问基线 | 既有 `RLS Enabled No Policy` 为 INFO，`Leaked Password Protection Disabled` 为 WARN。迁移后差异见后文 |

[无策略 RLS 提示](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) · [泄露密码保护](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

生产已有迁移记录如下。前两条与仓库文件时间戳的差异符合既有记录，本轮计划沿用原历史。

| 实际版本 | 名称 |
| --- | --- |
| `20260916115042` | `initial_schema` |
| `20260916115056` | `fix_backend_v1` |
| `20261004093439` | `enforce_admin_mfa` |
| `20261007052225` | `add_private_analytics` |

## 备份和恢复边界

**P2 PASS。** 2026-11-10（北京时间）通过生产 `song`（`vfgmptjfcfgptaqblydd`）的 Direct 连接导出。客户端使用 Dashboard 提供的 CA 并以 `verify-full` 校验证书和主机名。只读预检核对了 PostgreSQL `17.6`、五个目标 schema、四条现有生产迁移，以及 M1 对象未创建。Free 项目没有托管备份，本次使用 PostgreSQL 原生逻辑归档。[Supabase 备份说明](https://supabase.com/docs/guides/platform/backups) · [PostgreSQL 导出说明](https://www.postgresql.org/docs/17/app-pgdump.html)

| 项目 | 结果 |
| --- | --- |
| 数据库归档 | `D:\Backups\Songisle\prod-pre-m1-20261110-015921-899ab5a9\song-pre-m1.dump`，310,092 字节 |
| 数据库归档 SHA-256 | `3da09357c45db240827198ef968c0d5c0a56ae59869a499498cf14c7f5e45fff` |
| 导出和验证时间 | 2026-11-10 01:59:47 开始导出，2026-11-10 02:00:14 完成验证（北京时间） |
| 客户端与退出状态 | `psql`、`pg_dump`、`pg_restore` 均为 PostgreSQL `17.11`。只读预检、导出、`pg_restore --list`、离线全量解码的退出码均为 `0` |
| 归档覆盖 | 495 个目录项。与生产目录核对了五个 schema、46 张表、36 个表数据段、31 个函数及其他例程、11 个触发器、25 条策略、34 个 RLS 项及 70 个 ACL 项，无缺失 |
| Storage 文件 ZIP | `%LOCALAPPDATA%\SongIsle\ProductionBackups\M1-20261110-012551\media-objects.zip`，3,477,364 字节。2 件 PNG 的实际文件共 3,476,452 字节，已重新打开 ZIP 逐件核对长度及 SHA-256 |
| Storage ZIP SHA-256 | `987ab74972824c3ba4a9a98f5fe602a18f7f41a327268acac94d32bbba8735a6` |

实际导出命令如下。密码由所有者在本机 PowerShell 隐藏提示输入，仅传给运行中的客户端进程，未写入命令、文件或日志。以下 `--file` 为同目录临时归档名，通过验证后改为最终文件名。

```powershell
pg_dump --format=custom --strict-names --no-password --lock-wait-timeout=10s `
  --schema=public --schema=analytics_private --schema=auth `
  --schema=supabase_migrations --schema=storage `
  --exclude-table-data=auth.sessions --exclude-table-data=auth.refresh_tokens `
  --exclude-table-data=auth.mfa_amr_claims --exclude-table-data=auth.mfa_challenges `
  --exclude-table-data=auth.flow_state --exclude-table-data=auth.saml_relay_states `
  --exclude-table-data=auth.one_time_tokens --exclude-table-data=auth.oauth_authorizations `
  --exclude-table-data=auth.oauth_client_states --exclude-table-data=auth.webauthn_challenges `
  -h db.vfgmptjfcfgptaqblydd.supabase.co -p 5432 -U postgres -d postgres `
  --file='D:\Backups\Songisle\prod-pre-m1-20261110-015921-899ab5a9\song-pre-m1.dump.partial'
```

归档包含 `public` 和 `analytics_private` 业务及统计数据、`auth.users`、`auth.identities`、`auth.mfa_factors` 等可恢复的 Auth 数据、迁移历史，以及 Storage 桶与对象元数据。保留 RLS、策略、对象权限和所有者定义。命令中列出的十张 Auth 表只保留定义，恢复后需要重新登录。完整恢复仍需兼容的 Supabase 版本、托管角色、扩展和 Auth 配置。归档已完整解码到本机空流，未执行数据库恢复。[Supabase 恢复说明](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

数据库里的 Storage 元数据不能恢复图片字节。独立 ZIP 中的清单记录对象路径、UUID、长度和散列。若需恢复图片，应通过受支持的 Storage API 在隔离环境验证上传、内容类型、对象映射和哈希。未执行对象恢复。两个归档均复算了最终 SHA-256，NTFS 访问规则仅授予当前 Windows 用户和 SYSTEM。归档与详细回执留在本机，临时凭据和运行脚本已清理。

首次导出和归档清单检查通过，离线读取因遗漏 `--file` 参数失败，临时归档未保留。修正后以 `pg_restore --file=- --exit-on-error` 完整读取复跑归档并校验通过。两次均无生产写入。

## 已批准的 SQL 与影响

目标固定为生产 `song`（`vfgmptjfcfgptaqblydd`）。下面的 SHA-256 按验收提交的原始 Git blob 字节计算。备份已重新校验并保留。两次获批写入均提交下列原始 SQL，实际历史版本见后文。

| 顺序 | 文件 | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| A | [20261108173132_add_private_distribution_m1.sql](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/migrations/20261108173132_add_private_distribution_m1.sql) | 14,025 | `b61ddb41080441f7591582ecccd80fac494b7988bfcb14f9c4f1ea985f3f9f62` |
| B | [20261109161000_report_distribution_version_conflicts.sql](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/migrations/20261109161000_report_distribution_version_conflicts.sql) | 3,921 | `3aaf6c8e6ec40071cd6c1a91e4fe80ac2c27cff95547172327bb9e261ee8ee77` |

A 在事务中创建四张启用 FORCE RLS 的空表、私有 schema、外键、索引、触发器和保存 RPC。外键引用 `projects` 和 `storage.objects`，执行时可能短暂等待引用表上的锁。已有业务表和数据、管理员名单、MFA 因子、统计和桶设置不在写入范围内。B 在事务中替换同一函数的业务冲突错误码，`SECURITY INVOKER`、空 `search_path`、函数签名、授权和 RLS 沿用 A 的定义。验收先核对 catalog 和只读安全 smoke，再进入合并关口。

事务失败时停在对应步骤，核对迁移历史及已提交对象。若 A 成功而 B 失败，保留新私有表和现有前端，等待修复方案复审。若数据库通过后前端部署异常，回到已记录的稳定 Worker 版本并保留数据库结构。破坏性数据库回滚需要独立备份、审查及所有者另行确认。[M1 回滚 SQL 供审查](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/rollbacks/distribution_m1.sql)

正式管理员密码与 MFA 由所有者在正式站完成。生产临时稿件和账号需要另行明确批准，尤其是归档账号会保留历史。生产 Storage 删除一致性沿用真实 Staging 证据，生产验收范围为权限、元数据和非破坏性访问。

## 生产迁移与只读安全验收

**P4–P6 PASS。** 目标为 `song`（`vfgmptjfcfgptaqblydd`）。在各自明确审批后，依次用 Supabase 的迁移工具执行 A、验收 A、执行 B、验收 B。首次 B 确认卡过期后，只读确认 B 未执行、A 未变化，再完成新的确认。生产复核时间 2026-11-10 03:00:04（北京时间）。

| 迁移 | 仓库版本 | 生产历史实际版本 | 数据库内 SQL 与已批准文件 |
| --- | --- | --- | --- |
| A | `20261108173132` | `20261109184705 add_private_distribution_m1` | 字节数和 SHA-256 完全一致 |
| B | `20261109161000` | `20261109185903 report_distribution_version_conflicts` | 字节数和 SHA-256 完全一致 |

生产历史中的两条新版本由迁移工具分配，原有四条记录保留。后续应通过版本与名称映射识别这两条已执行迁移，避免因文件时间戳不同而重跑或擅改历史。

- A 验证了 `distribution_accounts`、`distribution_posts`、`distribution_post_targets`、`distribution_post_media` 四张空表。四张表均启用并强制 RLS；9 条策略、6 个外键、4 个触发器、13 个索引通过核对。`storage.objects` 外键是 `ON DELETE RESTRICT`，账号仅支持归档。
- B 后逐字比对 RPC 定义，唯一差异是版本冲突从 `40001` 改为 `PT409`。`SECURITY INVOKER`、空 `search_path`、签名、`EXECUTE` 授权、所有分发表 RLS 和约束保持不变。生产只读验收未制造冲突写入；真实 HTTP 409 已在 Staging 验收。
- 原有 8 张应用表的结构和 ACL、25 条既有策略、3 个既有函数和 Storage 主键未变化。项目、文章、站点设置、管理员和两件 Storage 对象的行指纹均与迁移前一致；统计计数、管理员资格和已验证 TOTP 数量也一致。
- 运行验收提交上的 [只读安全 smoke](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/tests/distribution_security_smoke.sql)，SHA-256 为 `bb26497cc1c1c4503e585f0343790f38d307027677afd87ca9658d5b198bbffb`。在只读事务中模拟匿名、普通用户 aal2、管理员 aal1、管理员缺少 aal、管理员 aal2，五种身份均符合预期；未插入测试数据，未执行生产写入。
- Security Advisor 与迁移前对比无新增项。既有两条统计私表 [RLS 无策略提示](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)（INFO）和一条 [泄露密码保护未开启](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)（WARN）保持原样。
