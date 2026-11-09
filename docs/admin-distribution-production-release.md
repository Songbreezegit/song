# 松屿内容分发 M1 生产发布记录

**生产发布 BLOCKED。** 2026-11-10（北京时间）已完成只读预检、两条 SQL 的静态核对和生产备份验证。生产 SQL 等待单独批准，合并和正式部署仍未执行。

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| P1 仓库、项目和数据库基线 | PASS | 功能分支与已验收提交一致，生产健康，未发现超出已知历史版本差异的应用 schema 漂移 |
| P2 生产数据库备份 | PASS | 五个 schema 的逻辑归档已完整解码，关键对象与权限覆盖核对通过。两件 PNG 单独备份并校验 |
| P3 两条 SQL 静态核对 | PASS | 从验收提交提取原始 Git blob 计算 SHA-256，生产无同名残留 |
| P0 生产写入确认 | BLOCKED | 备份验证已通过，仍需取得对下列两条 SQL 的明确操作确认 |
| P4–P6 执行迁移、数据库安全验收 | BLOCKED | 尚未执行 SQL A 或 SQL B，PT409 与新策略的生产结果待验 |
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
| 安全顾问基线 | 既有 `RLS Enabled No Policy` 为 INFO，`Leaked Password Protection Disabled` 为 WARN。迁移后差异待核对 |

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

## 待确认的 SQL 与预计影响

目标固定为生产 `song`（`vfgmptjfcfgptaqblydd`）。下面的 SHA-256 按验收提交的原始 Git blob 字节计算。核验备份并取得操作确认后，按 A、验证 A、B、验证 B 的顺序执行，逐条确认迁移历史。

| 顺序 | 文件 | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| A | [20261108173132_add_private_distribution_m1.sql](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/migrations/20261108173132_add_private_distribution_m1.sql) | 14,025 | `b61ddb41080441f7591582ecccd80fac494b7988bfcb14f9c4f1ea985f3f9f62` |
| B | [20261109161000_report_distribution_version_conflicts.sql](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/migrations/20261109161000_report_distribution_version_conflicts.sql) | 3,921 | `3aaf6c8e6ec40071cd6c1a91e4fe80ac2c27cff95547172327bb9e261ee8ee77` |

A 在事务中创建四张启用 FORCE RLS 的空表、私有 schema、外键、索引、触发器和保存 RPC。外键引用 `projects` 和 `storage.objects`，执行时可能短暂等待引用表上的锁。已有业务表和数据、管理员名单、MFA 因子、统计和桶设置不在写入范围内。B 在事务中替换同一函数的业务冲突错误码，`SECURITY INVOKER`、空 `search_path`、函数签名、授权和 RLS 沿用 A 的定义。验收先核对 catalog 和只读安全 smoke，再进入合并关口。

事务失败时停在对应步骤，核对迁移历史及已提交对象。若 A 成功而 B 失败，保留新私有表和现有前端，等待修复方案复审。若数据库通过后前端部署异常，回到已记录的稳定 Worker 版本并保留数据库结构。破坏性数据库回滚需要独立备份、审查及所有者另行确认。[M1 回滚 SQL 供审查](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/rollbacks/distribution_m1.sql)

正式管理员密码与 MFA 由所有者在正式站完成。生产临时稿件和账号需要另行明确批准，尤其是归档账号会保留历史。生产 Storage 删除一致性沿用真实 Staging 证据，生产验收范围为权限、元数据和非破坏性访问。
