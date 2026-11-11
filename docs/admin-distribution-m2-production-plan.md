# 松屿内容分发 M2 生产迁移计划与验收

生产 `song`（`vfgmptjfcfgptaqblydd`）于 2026-11-11 完成只读预检和 M2 迁移前备份，于 2026-11-12（北京时间）完成两条独立获批的生产迁移和数据库验收。PR #11 合并与 Cloudflare 正式发布仍待独立审批。

| 检查 | 状态 | 证据 |
| --- | --- | --- |
| 已验收提交、PR 和 `main` | PASS | GitHub PR #11 为开放草稿。来源分支 `feat/admin-distribution-m2` 与验收提交 `91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69` 一致。远端 `main` 为 `ae35d4a39b361ce0cf773e357d652e3aa18142ba`，也是它与功能分支的共同祖先。 |
| 生产项目、M1 历史和安全 | PASS | Management API 与 PostgreSQL 历史一致。M1 存储 SQL 哈希匹配已验收文件，只读 smoke 通过五种 JWT 条件。 |
| M2 两份生产 SQL | PASS | 已从验收提交重新提取并计算 SHA-256，与 Staging 验收使用的原 SQL 一致。 |
| M1 备份复核 | PASS | 两份旧归档均存在且重新计算 SHA-256 匹配回执，文件 ACL 的允许规则仅涉及当前用户和 SYSTEM。 |
| M2 迁移前新备份 | PASS | 六个 schema 的数据库归档、两件媒体的独立 ZIP 和最终文件的离线复核均通过。见下方回执。 |
| 两条生产迁移与只读验收 | PASS | A、B 各获独立审批，官方 API 各返回 HTTP 200，历史、存储 SQL 哈希、安全与 M1 回归通过。见下方执行回执。 |
| PR 合并与正式发布 | 待审批 | PR #11 仍为开放草稿。先复核生产部署触发器，再按独立关口放行。 |

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

以生产历史中的实际版本和名称为准。迁移前只读预检确认两条 M1 的存储 SQL 哈希与原始 Git blob 匹配，M2 两条均缺失。下表已更新为迁移后的生产实际记录；M2 存储 SQL 哈希见执行回执。

| 名称 | 仓库版本 | 当前生产记录 | Staging 记录供对照 |
| --- | --- | --- | --- |
| `initial_schema` | `20260916000000` | `20260916115042` | |
| `fix_backend_v1` | `20260916044953` | `20260916115056` | |
| `enforce_admin_mfa` | `20261004093439` | `20261004093439` | |
| `add_private_analytics` | `20261007052225` | `20261007052225` | |
| `add_private_distribution_m1` | `20261108173132` | `20261109184705` | `20261109153506` |
| `report_distribution_version_conflicts` | `20261109161000` | `20261109185903` | `20261109161000` |
| `add_distribution_platform_variants` | `20261110100401` | `20261111162431` | `20261110174923` |
| `review_distribution_source_fields` | `20261110114036` | `20261111163231` | `20261110175856` |

M1 生产存储 SQL SHA-256 分别为 `b61ddb41080441f7591582ecccd80fac494b7988bfcb14f9c4f1ea985f3f9f62` 和 `3aaf6c8e6ec40071cd6c1a91e4fe80ac2c27cff95547172327bb9e261ee8ee77`。

## 备份与恢复

| M1 已有归档 | 本次复核 |
| --- | --- |
| `D:\Backups\Songisle\prod-pre-m1-20261110-015921-899ab5a9\song-pre-m1.dump` | 310,092 字节，`PGDMP` 归档头可读，SHA-256 `3da09357c45db240827198ef968c0d5c0a56ae59869a499498cf14c7f5e45fff`。M1 回执记录 PostgreSQL 17.11 的导出、目录读取和完整解码均退出 0，覆盖当时的五个 schema。 |
| `%LOCALAPPDATA%\SongIsle\ProductionBackups\M1-20261110-012551\media-objects.zip` | 3,477,364 字节，SHA-256 `987ab74972824c3ba4a9a98f5fe602a18f7f41a327268acac94d32bbba8735a6`。重新打开 ZIP，两件 PNG 均可读取，共 3,476,452 字节。 |

上述归档早于 M1 生产迁移，缺少现有 M1 对象及其后续数据。使用 PostgreSQL 17.11 重新运行 M1 归档的 `pg_restore --list` 和完整离线解码，两项退出码均为 0，目录仍为 495 项。实际数据库恢复仍待隔离演练。[M1 备份和恢复回执](admin-distribution-production-release.md#备份和恢复边界)

### M2 新备份检查点

1. 使用已核验的 PostgreSQL 17 客户端和生产 Dashboard CA，固定连接 Direct `db.vfgmptjfcfgptaqblydd.supabase.co:5432`，采用 `sslmode=verify-full`。连接后只读核对服务器版本、数据库、六个 schema 和两条 M1 存储哈希，再开始导出。Direct 不可达时先复核该项目的 Session Pooler、带 Ref 的用户名和证书，再决定连接方式。所有者通过本机隐藏提示输入口令。[Supabase 连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. 在 `D:\Backups\Songisle\prod-pre-m2-<时间>-<run-id>` 新建受保护目录，复核目录和文件 ACL。以一个 `pg_dump --format=custom` 归档导出六个 schema。覆盖业务、统计、M1 私有函数、可恢复 Auth、迁移历史、Storage 元数据和定义，以及所有者、ACL、RLS、策略、外键、函数和触发器。沿用 M1 的临时 Auth 表数据排除项，保留这些表的定义，以及 `auth.users`、`auth.identities` 和 `auth.mfa_factors` 的数据。后台编辑和素材变更避开备份到迁移的窗口，统计允许正常更新。[pg_dump 选项与快照](https://www.postgresql.org/docs/17/app-pgdump.html)
3. 分别记录预检、导出、`pg_restore --list` 和完整离线解码退出码。核对归档非空，目录中的 schema、表、数据段、函数、策略、ACL 和触发器与生产只读清单匹配，特别检查 M1 四张表及其数据段、`distribution_private`、`supabase_migrations.schema_migrations`、可恢复 Auth 数据与 Storage 元数据。完整解码输出流丢弃，验证后再将 `.partial` 改为最终文件名。记录北京时间、归档大小、SHA-256、命令退出码和覆盖结果，报告仅记录脱敏回执。[pg_restore 目录与读取](https://www.postgresql.org/docs/17/app-pgrestore.html)
4. 将生产媒体文件独立保存到同一受保护的本机备份范围。按当时的桶、对象 UUID、路径、大小和内容类型对账，用 Storage API 只读下载，逐件核对长度和 SHA-256，记录二次读取及清单结果。数据库归档只覆盖对象元数据。新备份与可读性验证全部通过后才送审迁移 A，任一验证失败则停在备份检查点。[Supabase 数据库备份的 Storage 边界](https://supabase.com/docs/guides/platform/backups)

[生产只读备份脚本](../scripts/backup-distribution-m2-production.ps1) 将新归档写入唯一的受保护目录。传入已核验的 PostgreSQL 17 客户端目录、Dashboard CA 路径和 SHA-256。脚本在本机隐藏提示接收口令，只将其传给执行只读连接的客户端子进程。

```powershell
$prodRun = 'prod-pre-m2-' + [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(8)).ToString('yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
pwsh -NoProfile -File .\scripts\backup-distribution-m2-production.ps1 `
  -PgBin $prodPg17Bin -CaFile $prodDashboardCa -CaSha256 $prodReviewedCaSha256 -RunName $prodRun
```

脚本独立检查 `pg_dump`、`pg_restore --list` 和完整离线解码的退出码。用生产目录的 OID 核对 schema、表、例程、RLS、策略、触发器及外键，逐表核对数据段并检查关键 ACL。Storage ZIP 在本机重新打开，核对清单和每件文件的长度及 SHA-256。备份前后比较历史、数据库目录与 Storage 对象路径、UUID 和版本。全部通过才将两份 `.partial` 改为最终文件名，重新计算最终文件的 SHA-256，最后写入 `backup-receipt.json`。只有带 PASS 回执的归档可用作迁移前备份。失败会停止并保留脱敏故障回执。

本机现有路径未找到 PostgreSQL 17。使用 PostgreSQL 官网指向的 EDB 便携 ZIP，归档 SHA-256 `6eabdf00d2893713b75db4336a23c3fdf505f056e217ec6e2e95d901750cfea3`，与 M1 回执一致。实际 `psql.exe`、`pg_dump.exe`、`pg_restore.exe` 位于 `D:\code\song\.worktrees\production-release-report\node_modules\.cache\songisle-m2-pg17-6efceaff\bin`，三者均返回 `17.11`。Dashboard CA 的 SHA-256 为 `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`。本地测试覆盖三条命令非零退出、必需数据段缺失和意外包含已排除的数据段。[PostgreSQL Windows 客户端来源](https://www.postgresql.org/download/windows/) · [EDB 便携归档](https://www.enterprisedb.com/download-postgresql-binaries)

### M2 生产备份回执

**PASS，2026-11-11 10:18:37（北京时间）。** 生产 PostgreSQL `17.6` 通过 Direct、`verify-full` 和 TLS 1.3 连接，客户端会话为只读。前后清单中的六条迁移历史、M1 哈希、归档覆盖对象和 Storage 清单一致。

| 最终文件 | 字节数 | 独立复算 SHA-256 |
| --- | ---: | --- |
| `D:\Backups\Songisle\prod-pre-m2-20261111-024634-b17bc8fc\song-pre-m2.dump` | 346,249 | `72379aa180a1aa23d398a978ae32f75ce54607833e185875e05c9f0b140b5ad5` |
| `D:\Backups\Songisle\prod-pre-m2-20261111-024634-b17bc8fc\media-objects.zip` | 3,350,209 | `0ce264851818e1ecb790c85c7f60924986f276d866d6b2962f8ee8fd72f624a6` |

本机回执为 `D:\Backups\Songisle\prod-pre-m2-20261111-024634-b17bc8fc\backup-receipt.json`。目录和三个最终文件的 ACL 允许当前用户及 SYSTEM 访问。Git 提交只包含脚本和脱敏报告。

| 验证项 | 实际结果 |
| --- | --- |
| 客户端与只读连接 | 三个客户端的版本检查和备份前、后 `psql` 检查退出码均为 `0`。 |
| 归档读取 | `pg_dump`、`pg_restore --list` 和 `pg_restore --exit-on-error --file=-` 均退出 `0`。独立复核对最终文件重新读取目录、完整解码，两项仍退出 `0`。 |
| 数据与定义覆盖 | 六个 schema 共 554 个 TOC 条目，50 张表和 40 个表数据段。14 个关键数据段、34 个例程、34 条策略、38 项 RLS、15 个触发器、37 项外键及关键 ACL 均通过核对。 |
| 独立 Storage ZIP | 两件对象合计 3,476,452 字节。备份前后对象路径、UUID、大小、类型与版本清单一致。重新打开最终 ZIP，逐件核对路径到 UUID 的映射、长度及 SHA-256。对象级清单位于 ZIP 的 `manifest.json`。 |

### 托管依赖与恢复边界

| 范围 | 隔离恢复时的核对 |
| --- | --- |
| PostgreSQL 和角色 | 目标使用兼容 PostgreSQL 17 的 Supabase 环境。源端核对了 `postgres`、`pg_database_owner`、`supabase_admin`、`supabase_auth_admin`、`supabase_storage_admin`、`anon`、`authenticated` 和 `service_role`。保留对象所有者和 ACL，集群级角色口令和服务器参数由目标环境单独配置。 |
| 扩展和托管对象 | 本机回执记录了 `extensions` 中的 `pg_stat_statements 1.11`、`pgcrypto 1.3`、`uuid-ossp 1.1`，`pg_catalog` 中的 `plpgsql 1.0`，以及 `vault` 中的 `supabase_vault 0.3.1`。这些宿主 schema 在六个导出范围之外，由兼容目标环境提供。按 TOC 处理目标已存在的托管对象，并验证 SQL 函数、触发器、约束与 RLS。 |
| Auth | 验证用户、身份、MFA 因子的可恢复性。临时会话等十张表仅保留结构，恢复后需要重新登录。Auth 配置、签名及外部身份提供商凭据由目标环境单独管理。 |
| Storage | SQL 归档提供元数据，ZIP 提供实际对象字节和路径到 UUID 的清单。通过受支持的 Storage 流程恢复文件，校验哈希并处理重新上传产生的 UUID 映射，最后验证分发外键。 |
| 迁移历史和业务 | 比对历史及存储 SQL、M1 业务数据、管理员权限和 RPC。目录读取和完整解码用于证明归档可读，实际恢复仍需在独立环境演练。生产恢复须另行审查和批准。 |

[Supabase 备份与恢复](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

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

## 生产迁移执行回执

2026-11-12（北京时间）在生产 `song`（`vfgmptjfcfgptaqblydd`）完成 A 和 B。两条 SQL 均取得独立写入批准，保留验收提交中原有的 `BEGIN` / `COMMIT`，通过官方单条迁移 API 各提交一次。平台登记生产版本；只读查询独立复核两条记录均各存一份完整 SQL，UTF-8 SHA-256 与上表所列原始 Git blob 一致。

| 顺序 | API 回执时间（北京时间） | 生产迁移记录 | API | 存储 SQL SHA-256 |
| --- | --- | --- | --- | --- |
| A | 2026-11-12 00:24:30 | `20261111162431` | HTTP 200 | `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174` |
| B | 2026-11-12 00:32:31 | `20261111163231` | HTTP 200 | `acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21` |

A 的连接器确认超时及随后传输中断均通过只读查询确认未写入。切换至已获批的官方 API 后，首次历史 GET 返回 403，随后本机脚本的列表解析问题也在提交前停止。解析修复通过离线验证；项目、历史、备份指纹和锁复核通过后才发出 A。B 发出前独立核对七条历史、A 的存储 SQL 哈希和平台稿表锁。最终八条迁移记录中，原六条及 A 均保持原状。

| 验收 | 结果 |
| --- | --- |
| A 数据库目录 | PASS。两张空表启用并强制 RLS，22 个已验证约束（含四个外键）、七个有效索引、五个启用触发器、四条策略和三个公开 `SECURITY INVOKER` RPC。素材外键仍为 `ON DELETE RESTRICT`。 |
| B 数据库目录 | PASS。`source_retained_fields` 为非空 JSONB，默认 `{}`，对象检查已验证。共 23 个约束；A 已有表、索引、触发器、策略和公开 RPC 授权保持。四个公开 RPC 均为 Invoker、空 `search_path`，匿名无执行权。核对同步和保留模式的入口、私有核对函数以及来源与平台稿的 `PT409` 版本检查。 |
| 生产只读权限 smoke | PASS。A、B 后均核对匿名、普通用户 `aal2`、管理员 `aal1`、管理员缺少 `aal`、管理员 `aal2` 五种合成 JWT 条件。B 额外探测同步、保留 RPC 共十次：四种不满足权限的条件返回 `42501`，管理员 `aal2` 进入参数校验并返回预期的 `22023`。均在只读事务中执行，未插入夹具或写业务数据。 |
| M1 与原业务 | PASS。两次 M1 只读回归各通过五种条件，`save_distribution_post` 仍为 Invoker、保留 `PT409`。原有业务与 Storage 的九个关系指纹均匹配迁移前快照。有效管理员及已验证 TOTP 聚合值不变，仍为两件 PNG、3,476,452 字节的 Storage 元数据；实际文件字节的验证见备份回执。 |
| Security Advisor | PASS。两条既有 INFO（`analytics_private.event_receipts`、`analytics_private.maintenance` 启用 RLS 无策略）及一条既有 WARN（泄露密码保护未开启）不变，没有 M2 新条目。 |

真实 GoTrue、PostgREST 并发和事务回滚、Storage 引用保护与浏览器操作仍以 Staging 的实测报告为依据。本轮生产验收仅使用只读探测，未做数据库恢复演练。原备份保留在受保护的本机目录。短期 Scoped PAT 未写入本机文件，使用结束后本机进程释放凭据，用户已确认在 Supabase 撤销。

数据库检查点已通过。GitHub 只读复核显示 PR #11 仍为开放草稿，来源提交与验收基线一致，目标仍为 `main`。合并、Cloudflare 部署配置和正式发布均未执行。

## 数据库通过后的合并和发布关口

1. 生产数据库验收通过后，重新核对 PR #11 的 HEAD、`main`、合并预期差异和 GitHub 检查。若验收 SHA 或合并内容漂移，复审后再提交合并请求。记录当前稳定 Worker 版本及流量比例。
2. 2026-11-11（北京时间）只读核对 Cloudflare Worker `song` 的 Builds 设置。生产分支为 `main`，部署命令为 `npx wrangler deploy`，当前配置下合并 `main` 会触发正式部署。非生产分支的版本命令为 `npx wrangler versions upload`。数据库通过后复核构建与其他发布触发器。如需变更自动部署配置，先在受控环境单独验证候选方案，记录预期流量、恢复方法和验收结果，再申请该配置的独立批准。验证 `main` 合并与生产流量切换可以独立控制后，才送审 PR #11 合并。[Workers 构建分支](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/) · [Worker 版本和流量](https://developers.cloudflare.com/workers/versions-and-deployments/)
3. 合并后记录实际 `main` SHA 和该 SHA 的构建产物及 Worker 候选版本。核对正式域名、生产 Supabase Ref 与公开客户端配置，出示候选版本、原稳定版本、验证结果和恢复流量方案，再申请 Cloudflare 正式发布审批。获批后将指定版本承接生产流量并核对部署回执。上线后检查公开页面、匿名私有数据拒绝、CSP、管理员本机登录及 MFA 后后台只读页面。若应用异常，保留已验收数据库并按获批方案将流量恢复到之前的稳定版本。[Cloudflare Worker 回滚](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
