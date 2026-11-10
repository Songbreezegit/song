# 松屿内容分发 M2 生产迁移计划与预检

2026-11-11（北京时间）完成生产只读预检。生产 `song`（`vfgmptjfcfgptaqblydd`）健康，M1 迁移和权限符合预期，生产中未发现 M2 历史或同名对象。M2 新备份和两条写入审批均是后续检查点。

| 检查 | 状态 | 证据 |
| --- | --- | --- |
| 已验收提交、PR 和 `main` | PASS | GitHub PR #11 为开放草稿。来源分支 `feat/admin-distribution-m2` 与验收提交 `91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69` 一致。远端 `main` 为 `ae35d4a39b361ce0cf773e357d652e3aa18142ba`，也是它与功能分支的共同祖先。 |
| 生产项目、M1 历史和安全 | PASS | Management API 与 PostgreSQL 历史一致。M1 存储 SQL 哈希匹配已验收文件，只读 smoke 通过五种 JWT 条件。 |
| M2 两份生产 SQL | PASS | 已从验收提交重新提取并计算 SHA-256，与 Staging 验收使用的原 SQL 一致。 |
| M1 备份复核 | PASS | 两份旧归档均存在且重新计算 SHA-256 匹配回执，文件 ACL 的允许规则仅涉及当前用户和 SYSTEM。 |
| M2 迁移前新备份 | 待执行 | 本轮已确定新备份范围与验证标准。尚未生成 M2 归档，当前路径和已知工具目录中未找到 PostgreSQL 客户端。 |
| 生产迁移、PR 合并、正式发布 | 待审批 | 先验收新备份，再按 A、B、合并和正式发布的顺序独立放行。 |

[Draft PR #11](https://github.com/Songbreezegit/song/pull/11) · [已验收的 Staging 报告](https://github.com/Songbreezegit/song/blob/91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69/docs/admin-distribution-m2-delivery.md#云端-staging)

## 生产只读预检

Management API 确认为 `song`、`ACTIVE_HEALTHY`、`ap-northeast-1`。生产 PostgreSQL 为 `17.6`，托管发行版本为 `17.6.1.166`。已验收的 Staging 为 PostgreSQL 17.11，生产目录已确认 M2 所用的 `xid8`、`pg_current_xact_id()` 和 Storage UUID 主键可用。数据库查询在只读事务内执行，仅记录目录、聚合计数和迁移哈希。

| 范围 | 实际结果 |
| --- | --- |
| 管理员 | 1 条管理员登记，关联 1 个有效 Auth 用户，1 位管理员有已验证 TOTP。仅查聚合值。 |
| 公开业务与设置 | 1 个项目且已发布，0 篇文章，1 条站点设置。 |
| M1 数据 | 分发账号、源内容、目标关联和素材关联均为 0 条。 |
| M1 数据库安全 | 四张表启用并强制 RLS，9 条策略。匿名无表读取权限。`save_distribution_post` 为 `SECURITY INVOKER`，空 `search_path`，`authenticated` 可执行，`anon` 无执行权限，版本冲突使用 `PT409`。M1 的 Storage 外键为 `ON DELETE RESTRICT`。 |
| 统计 | 页面日统计 33 条，内容日统计 5 条，事件收据 7 条，维护记录 1 条。计数为预检时快照。 |
| Storage | 1 个公开 `media` 桶，2 个 PNG 对象，元数据总量 3,476,452 字节。单文件上限 5 MiB，允许 JPEG、PNG、WebP。 |
| M2 同名对象 | 相关表和索引、函数、触发器、命名约束及策略均为 0。 |
| 生产安全 smoke | 使用仓库 M1 只读 smoke。匿名、普通用户 `aal2`、管理员 `aal1`、管理员缺少 `aal`、管理员 `aal2` 五种合成 JWT 条件通过，写入及测试数据均为 0。 |
| Security Advisor | 两条既有统计私表 RLS 无策略提示为 INFO，一条既有泄露密码保护未开启为 WARN。与 M1 发布回执的条目一致。 |

[M1 只读 smoke](https://github.com/Songbreezegit/song/blob/91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69/supabase/tests/distribution_security_smoke.sql) · [无策略 RLS 提示](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) · [泄露密码保护](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### 迁移历史

以生产历史中的实际版本和名称为准。两条 M1 各有一条存储 SQL，按 UTF-8 复算 SHA-256 与验收提交的原始 Git blob 匹配。M2 两条均缺失。后续记录迁移工具生成的生产版本号，核对名称、存储 SQL 和实际对象。

| 名称 | 仓库版本 | 当前生产记录 | Staging 记录供对照 |
| --- | --- | --- | --- |
| `initial_schema` | `20260916000000` | `20260916115042` | |
| `fix_backend_v1` | `20260916044953` | `20260916115056` | |
| `enforce_admin_mfa` | `20261004093439` | `20261004093439` | |
| `add_private_analytics` | `20261007052225` | `20261007052225` | |
| `add_private_distribution_m1` | `20261108173132` | `20261109184705` | `20261109153506` |
| `report_distribution_version_conflicts` | `20261109161000` | `20261109185903` | `20261109161000` |
| `add_distribution_platform_variants` | `20261110100401` | 无 | `20261110174923` |
| `review_distribution_source_fields` | `20261110114036` | 无 | `20261110175856` |

M1 生产存储 SQL SHA-256 分别为 `b61ddb41080441f7591582ecccd80fac494b7988bfcb14f9c4f1ea985f3f9f62` 和 `3aaf6c8e6ec40071cd6c1a91e4fe80ac2c27cff95547172327bb9e261ee8ee77`。

## 备份与恢复

| M1 已有归档 | 本次复核 |
| --- | --- |
| `D:\Backups\Songisle\prod-pre-m1-20261110-015921-899ab5a9\song-pre-m1.dump` | 310,092 字节，`PGDMP` 归档头可读，SHA-256 `3da09357c45db240827198ef968c0d5c0a56ae59869a499498cf14c7f5e45fff`。M1 回执记录 PostgreSQL 17.11 的导出、目录读取和完整解码均退出 0，覆盖当时的五个 schema。 |
| `%LOCALAPPDATA%\SongIsle\ProductionBackups\M1-20261110-012551\media-objects.zip` | 3,477,364 字节，SHA-256 `987ab74972824c3ba4a9a98f5fe602a18f7f41a327268acac94d32bbba8735a6`。重新打开 ZIP，两件 PNG 均可读取，共 3,476,452 字节。 |

上述归档早于 M1 生产迁移，缺少现有 M1 对象及其后续数据。本轮复核了原件和既有离线验证回执，实际数据库恢复仍未演练。新归档须覆盖 M1 已上线后的生产状态。[M1 备份和恢复回执](admin-distribution-production-release.md#备份和恢复边界)

### M2 新备份检查点

1. 在迁移窗口使用 PostgreSQL 17 的可信 `psql`、`pg_dump`、`pg_restore`，记录版本和程序来源。本机尚需定位或准备客户端。以生产 Dashboard 的 Connect 配置为准，优先 Direct `db.vfgmptjfcfgptaqblydd.supabase.co:5432`。Direct 不可达时复核该项目的 Session Pooler、带 Ref 的用户名和 Dashboard CA。使用 `sslmode=verify-full`。连接后只读核对服务器版本、数据库、六个 schema 和两条 M1 存储哈希，再开始导出。密码如需输入，由所有者在本机隐藏提示交接，只存在于专用进程中。记录中只保留连接类型、目标 Ref 与 CA 指纹。[Supabase 连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. 在 `D:\Backups\Songisle\prod-pre-m2-<时间>-<run-id>` 新建受保护目录，复核目录和文件 ACL。以一个 `pg_dump --format=custom` 归档导出六个 schema。覆盖业务、统计、M1 私有函数、可恢复 Auth、迁移历史、Storage 元数据和定义，以及所有者、ACL、RLS、策略、外键、函数和触发器。沿用 M1 的临时 Auth 表数据排除项，保留这些表的定义，以及 `auth.users`、`auth.identities` 和 `auth.mfa_factors` 的数据。后台编辑和素材变更避开备份到迁移的窗口，统计允许正常更新。[pg_dump 选项与快照](https://www.postgresql.org/docs/17/app-pgdump.html)
3. 分别记录预检、导出、`pg_restore --list` 和完整离线解码退出码。核对归档非空，目录中的 schema、表、数据段、函数、策略、ACL 和触发器与生产只读清单匹配，特别检查 M1 四张表及其数据段、`distribution_private`、`supabase_migrations.schema_migrations`、可恢复 Auth 数据与 Storage 元数据。完整解码输出流丢弃，验证后再将 `.partial` 改为最终文件名。记录北京时间、归档大小、SHA-256、命令退出码和覆盖结果，报告仅记录脱敏回执。[pg_restore 目录与读取](https://www.postgresql.org/docs/17/app-pgrestore.html)
4. 将生产媒体文件独立保存到同一受保护的本机备份范围。按当时的桶、对象 UUID、路径、大小和内容类型对账，用 Storage API 只读下载，逐件核对长度和 SHA-256，记录二次读取及清单结果。数据库归档只覆盖对象元数据。新备份与可读性验证全部通过后才送审迁移 A，任一验证失败则停在备份检查点。[Supabase 数据库备份的 Storage 边界](https://supabase.com/docs/guides/platform/backups)

备份命令模板如下。先在专用 PowerShell 进程设置 Dashboard CA、`PGSSLMODE=verify-full`、`PGOPTIONS=-c default_transaction_read_only=on` 和连接超时。以下路径变量在目标和 ACL 验证后赋值，`PGPASSWORD` 由本机隐藏提示设置并在 `finally` 中移除。每条命令成功才执行下一条。

```powershell
& $prodPgDump --format=custom --strict-names --no-password --lock-wait-timeout=10s `
  --schema=public --schema=analytics_private --schema=distribution_private `
  --schema=auth --schema=supabase_migrations --schema=storage `
  --exclude-table-data=auth.sessions --exclude-table-data=auth.refresh_tokens `
  --exclude-table-data=auth.mfa_amr_claims --exclude-table-data=auth.mfa_challenges `
  --exclude-table-data=auth.flow_state --exclude-table-data=auth.saml_relay_states `
  --exclude-table-data=auth.one_time_tokens --exclude-table-data=auth.oauth_authorizations `
  --exclude-table-data=auth.oauth_client_states --exclude-table-data=auth.webauthn_challenges `
  -h db.vfgmptjfcfgptaqblydd.supabase.co -p 5432 -U postgres -d postgres --file=$prodPartial
$prodToc = & $prodPgRestore --list $prodPartial
& $prodPgRestore --exit-on-error --file=- $prodPartial | Out-Null
Get-FileHash -LiteralPath $prodFinal -Algorithm SHA256
```

恢复需在独立、受保护的 Supabase 兼容环境中核对托管角色、扩展、Auth 和 Storage 配置。按归档目录处理目标已存在的托管对象，再验证业务行、迁移历史、Auth 可恢复性、MFA、RLS 和 RPC。恢复后用户需要重新登录。真实文件通过受支持的 Storage 流程恢复，核对文件哈希及路径到对象 UUID 的映射，并验证分发外键在恢复环境仍可解析。解码通过只证明归档可读。恢复到生产须另行制定恢复范围、验证并审批。[Supabase 备份与恢复](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## 两条生产迁移与放行条件

目标固定为生产 `song`（`vfgmptjfcfgptaqblydd`）。以下链接固定到验收提交，哈希按 Git blob 原始字节计算。

| 顺序 | 完整 SQL | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| A | [20261110100401_add_distribution_platform_variants.sql](https://github.com/Songbreezegit/song/blob/91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69/supabase/migrations/20261110100401_add_distribution_platform_variants.sql) | 24,404 | `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174` |
| B | [20261110114036_review_distribution_source_fields.sql](https://github.com/Songbreezegit/song/blob/91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69/supabase/migrations/20261110114036_review_distribution_source_fields.sql) | 10,053 | `acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21` |

首选 M1 已使用的 Supabase 单条迁移工具。每次提交固定 `project_id`、表中迁移名称及经哈希校验的完整 `query`，保留原有 `BEGIN` 和 `COMMIT`。若通道超时或回执不明，先只读核对历史、存储 SQL 和对象。只有确定未执行并获得替代通道独立批准后，才考虑官方 `POST /v1/projects/vfgmptjfcfgptaqblydd/database/migrations`。替代通道使用只限该生产项目的短期 `Migrations Read-write` 凭据，验收后撤销。远端历史由迁移工具登记。通道切换时重新展示完整请求、目标、原 SQL 哈希和失败处理。[官方单条迁移 API](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [迁移详情 API](https://supabase.com/docs/reference/api/v1-get-a-migration)

1. **迁移 A 独立审批。** 先出示新备份回执，复核生产六条基线、A/B 均不存在、M1 哈希和对象一致，安排低活动窗口并检查相关表的长事务。展示 A 完整 SQL、哈希和影响。A 新增平台稿和素材关联两张表、索引、约束、强制 RLS、触发器和三个公开 Invoker RPC。外键引用 M1 和 `storage.objects`，创建时可能短暂等待锁。
2. **A 后验收。** 独立从历史按名称查实际版本和存储 SQL 的 SHA-256，复核 B 仍缺失。核对两张强制 RLS 表、22 个有效约束、七个索引、四条策略、五个启用触发器（含两个可延迟约束触发器）和三个公开 `SECURITY INVOKER` RPC。验证管理员加 `aal2` 的 `USING`/`WITH CHECK`、空 `search_path`、`anon` 无授权、素材 UUID 外键 `RESTRICT` 和平台稿身份唯一键。核对 M1 保存 RPC、策略、约束、既有业务和 Storage 元数据计数及稳定对象指纹。以迁移窗口前只读基线为准，正常业务变更单独记录。
3. **迁移 B 独立审批。** 只有 A 真实登记且 A 后验收通过才展示 B 的 SQL、哈希和影响。B 增加 `source_retained_fields` JSONB 字段及约束，更新 `touch_variant` 和同步 RPC，新增私有核对函数及公开 `retain_distribution_variant_source`。保持原数据和快照，现有同步签名兼容。DDL 需要锁定新建平台稿表。
4. **B 后验收。** 独立读回 B 的实际版本和原 SQL SHA-256，再核对 A 与 M1 历史。验证新增字段非空、默认 `{}`、新增约束已验证，共 23 个约束、七个索引、五个启用触发器、四条 RLS 策略。核对四个公开 RPC 的签名、Invoker、空 `search_path`、授权及 `PT409`，私有核对函数不可通过公开 schema 调用。复跑 M1 与 M2 只读安全 smoke，复查 M1 数据、Storage 元数据、管理员 TOTP 和 Security Advisor 基线差异。生产 SQL smoke 使用合成 claims 并且不插入夹具，真实并发、回滚及拒删证据来自已验收 Staging。[M2 只读 smoke](https://github.com/Songbreezegit/song/blob/91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69/supabase/tests/distribution_m2_security_smoke.sql)

失败或结果不明时停止在对应步骤，保留日志和回执，读回历史、SQL 哈希与实际对象。历史与对象不一致需单独调查。A 已成功而 B 失败时保留 A 和现有生产前端，优先送审向前修复。回滚草案会移除整个 M2，仅供隔离审查，依赖备份、空表和独立审批。任何恢复、历史修复或补偿迁移均需明确方案和审批。[M2 回滚草案](https://github.com/Songbreezegit/song/blob/91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69/supabase/rollbacks/distribution_m2.sql)

## 数据库通过后的合并和发布关口

1. 生产数据库验收通过后，重新核对 PR #11 的 HEAD、`main`、合并预期差异和 GitHub 检查。若验收 SHA 或合并内容漂移，复审后再提交合并请求。记录当前稳定 Worker 版本及流量比例。
2. M1 回执记录 Cloudflare Worker `song` 的生产 `main` 构建使用 `npx wrangler deploy`，会直接切换流量。届时先只读核对当前构建配置和其他发布触发器。若仍自动发布，在合并前单独送审阻断生产自动发布的配置方案，例如经验证将生产命令设为仅上传版本。确认 `main` 合并无法提前切换流量后，再申请 PR #11 合并审批。无法隔离时保持合并关口关闭。[Workers 构建分支](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/) · [Worker 版本和流量](https://developers.cloudflare.com/workers/versions-and-deployments/)
3. 合并后记录实际 `main` SHA 和该 SHA 的构建产物及 Worker 候选版本。核对正式域名、生产 Supabase Ref 与公开客户端配置，出示候选版本、原稳定版本、验证结果和恢复流量方案，再申请 Cloudflare 正式发布审批。获批后将指定版本承接生产流量并核对部署回执。上线后检查公开页面、匿名私有数据拒绝、CSP、管理员本机登录及 MFA 后后台只读页面。若应用异常，保留已验收数据库并按获批方案将流量恢复到之前的稳定版本。[Cloudflare Worker 回滚](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
