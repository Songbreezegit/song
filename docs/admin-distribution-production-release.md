# 松屿内容分发 M1 生产发布记录

**生产发布 BLOCKED。** 2026-11-10（北京时间）已完成只读预检和两条 SQL 的静态核对。当前缺少能验证恢复内容的生产数据库备份，生产 SQL、合并和正式部署均处于等待状态。

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| P1 仓库、项目和数据库基线 | PASS | 功能分支与已验收提交一致，生产健康，未发现超出已知历史版本差异的应用 schema 漂移 |
| P2 生产数据库备份 | BLOCKED | Free 项目没有托管备份。本机没有现成的受信任数据库连接或备份工件 |
| P3 两条 SQL 静态核对 | PASS | 从验收提交提取原始 Git blob 计算 SHA-256，生产无同名残留 |
| P0 生产写入确认 | BLOCKED | 需先验证备份，再取得对下列两条 SQL 的操作确认 |
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

生产 Supabase 的 Backups 页面显示 Free 套餐没有托管备份。当前 PowerShell 环境没有 `pg_dump`、`pg_restore`、`psql` 或 Supabase CLI，未发现已有的 libpq 连接配置。数据库 SSL 强制开关关闭，当前不满足 Supabase 临时数据库访问的前提。生产连接和认证设置保持原样。[Supabase 备份说明](https://supabase.com/docs/guides/platform/backups) · [临时访问前提](https://supabase.com/docs/guides/platform/temporary-access)

生产数据库逻辑备份的文件路径、大小、SHA-256、导出命令、退出码和可读性均为 **BLOCKED**。待所有者使用现有受信任连接将备份保存在 Git 仓库外的受保护目录。备份需包含 `public` 和统计结构及数据、可恢复的 Auth 管理数据、策略与授权、迁移历史和 Storage 元数据。收到工件后只在本机检查文件和归档清单，记录哈希及验证结果。数据库归档的 Storage 部分只能恢复元数据，实际图片恢复依赖单独的对象副本或独立存储备份。

对象复制为 **BLOCKED**。自动审批拒绝把上述两件生产 PNG 下载到拟用的本机备份目录，理由是复制批次与具体目的地尚未获明确授权。只读取得的对象数量及大小是清单证据，文件副本未生成。

## 待确认的 SQL 与预计影响

目标固定为生产 `song`（`vfgmptjfcfgptaqblydd`）。下面的 SHA-256 按验收提交的原始 Git blob 字节计算。核验备份并取得操作确认后，按 A、验证 A、B、验证 B 的顺序执行，逐条确认迁移历史。

| 顺序 | 文件 | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| A | [20261108173132_add_private_distribution_m1.sql](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/migrations/20261108173132_add_private_distribution_m1.sql) | 14,025 | `b61ddb41080441f7591582ecccd80fac494b7988bfcb14f9c4f1ea985f3f9f62` |
| B | [20261109161000_report_distribution_version_conflicts.sql](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/migrations/20261109161000_report_distribution_version_conflicts.sql) | 3,921 | `3aaf6c8e6ec40071cd6c1a91e4fe80ac2c27cff95547172327bb9e261ee8ee77` |

A 在事务中创建四张启用 FORCE RLS 的空表、私有 schema、外键、索引、触发器和保存 RPC。外键引用 `projects` 和 `storage.objects`，执行时可能短暂等待引用表上的锁。已有业务表和数据、管理员名单、MFA 因子、统计和桶设置不在写入范围内。B 在事务中替换同一函数的业务冲突错误码，`SECURITY INVOKER`、空 `search_path`、函数签名、授权和 RLS 沿用 A 的定义。验收先核对 catalog 和只读安全 smoke，再进入合并关口。

事务失败时停在对应步骤，核对迁移历史及已提交对象。若 A 成功而 B 失败，保留新私有表和现有前端，等待修复方案复审。若数据库通过后前端部署异常，回到已记录的稳定 Worker 版本并保留数据库结构。破坏性数据库回滚需要独立备份、审查及所有者另行确认。[M1 回滚 SQL 供审查](https://github.com/Songbreezegit/song/blob/b2a21ae36a97428c096ec7a8b9e69cadd69238c8/supabase/rollbacks/distribution_m1.sql)

正式管理员密码与 MFA 由所有者在正式站完成。生产临时稿件和账号需要另行明确批准，尤其是归档账号会保留历史。生产 Storage 删除一致性沿用真实 Staging 证据，生产验收范围为权限、元数据和非破坏性访问。
