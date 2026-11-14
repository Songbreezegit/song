# 松屿内容分发 M3 生产迁移预检与执行方案

## 审查基线

| 项目 | 2026-11-15 预检结果（北京时间） |
| --- | --- |
| M3 | `feat/admin-distribution-m3`、验收提交 `8de09e348349c148c79fad5694d89006b5673eb7`。PR #13 为开放的 Draft，GitHub 报告 `MERGEABLE`，该 HEAD 的 Workers Builds 为 `SUCCESS` |
| 主分支 | `e6e2f8ec481dbdc64fe5ae790aceaebab5523414`，是 M3 验收提交的直接合并基线。报告分支由此创建，只提交本文 |
| 生产目标 | Supabase `song`，Project Ref `vfgmptjfcfgptaqblydd`，东京 `ap-northeast-1`，项目状态 `ACTIVE_HEALTHY`，PostgreSQL `17.6`（托管构建 `17.6.1.166`） |
| Staging 对照 | `song-staging`，Project Ref `uartrtcmskyuqxawjqlx`，PostgreSQL `17.11`。本次通过已有 Supabase 连接只读检查历史和目录 |

本轮范围是只读预检、备份方案和执行方案。产品功能固定在验收提交。新备份、两条生产 SQL、PR 合并和正式切流均待各自审批。
[PR #13](https://github.com/Songbreezegit/song/pull/13) · [M3 验收记录](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-delivery.md)

## 生产数据库与迁移历史

`BEGIN READ ONLY` 读取 `supabase_migrations.schema_migrations`。以下为生产登记版本及每条 `statements[1]` 的 UTF-8 字节 SHA-256。每条记录均存一段 SQL。

| 生产登记版本 | 迁移名 | 生产存储 SHA-256 | 对照结果 |
| --- | --- | --- | --- |
| `20260916115042` | `initial_schema` | `59dcfaed06cf78ba341afd4a81af89baefa51e19943fd4cc6d48b534818619ea` | 与 M2 上线前归档一致 |
| `20260916115056` | `fix_backend_v1` | `a5700ce7695b2458b69c60cb84d79f991616d7653a18f2d440f55ef8271de24e` | 与 M2 上线前归档一致 |
| `20261004093439` | `enforce_admin_mfa` | `e3c3121d0957697728fbd35c18c27e618ecbd5cb2d8a61ee107e7fac1b131a8e` | 与 M2 上线前归档一致 |
| `20261007052225` | `add_private_analytics` | `73bc5ba4c0a12abbf01eaae65497c0de31332e2f072625c6eed7a48e10218bc4` | 与 M2 上线前归档一致 |
| `20261109184705` | `add_private_distribution_m1` | `b61ddb41080441f7591582ecccd80fac494b7988bfcb14f9c4f1ea985f3f9f62` | 与 Git 原始文件及 M2 上线前归档一致 |
| `20261109185903` | `report_distribution_version_conflicts` | `3aaf6c8e6ec40071cd6c1a91e4fe80ac2c27cff95547172327bb9e261ee8ee77` | 与 Git 原始文件及 M2 上线前归档一致 |
| `20261111162431` | `add_distribution_platform_variants` | `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174` | 与 Git 原始文件及 M2 生产回执一致 |
| `20261111163231` | `review_distribution_source_fields` | `acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21` | 与 Git 原始文件及 M2 生产回执一致 |

前四条存储 SQL 的哈希与验收提交内的同名文件不同，换行转换也无法解释差异。用 `pg_restore --data-only` 离线读取 M2 上线前归档的迁移历史后，确认其前六条的版本、名称和哈希均与当前生产一致。后续预检应使用表内实际生产基线和新备份读回，保持既有八条历史原样。
[M2 生产迁移及备份报告](https://github.com/Songbreezegit/song/blob/e91fe126c1747ad5080f80efc969ae42ccb14f5d/docs/admin-distribution-m2-production-plan.md)

- 生产历史为八条。M3 三张表、私有 schema、写入角色、公开 RPC 和 Storage 保护触发器均尚未安装。M2 的 `source_retained_fields`、源锁定辅助函数、保存与同步 RPC 在位。预检连接角色具备创建角色、授予所需成员关系和在 `storage.objects` 上建立外键与触发器的权限，并具有 `BYPASSRLS`。在实际迁移通道重新核对数据库执行角色。
- 00:31 的聚合快照中，`admin_users` 有 1 条且关联现有 Auth 用户，该管理员有 1 个已验证 TOTP 因子。业务有项目 1（已发布 1）、文章 0、站点设置 1、统计日记录 36。M1 有矩阵账号 1、内容源 1、目标关联 1、素材关联 1。M2 平台稿及平台稿素材关联都是 0。统计及业务数量为当时读数，执行时按获批窗口重取。
- M1 和 M2 只读安全 smoke 均通过五种事务内身份检查。六张分发表强制 RLS，现有公开 RPC 使用 `SECURITY INVOKER`，`anon` 无执行权。检查使用合成 claims 和现有目录，未执行业务写入。
[M1 smoke](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/tests/distribution_security_smoke.sql) · [M2 smoke](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/tests/distribution_m2_security_smoke.sql)
- Security Advisor 记录现有 `analytics_private.event_receipts`、`analytics_private.maintenance` 两条 RLS 无策略 INFO，以及 Auth 泄露密码检查未启用 WARN。迁移前后按相同范围比对 Advisor。
[RLS 无策略说明](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) · [Auth 泄露密码检查](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Storage 和维护窗口

生产和 Staging 的 Storage `/version` 均返回 `1.94.2`。两端 `storage.migrations` 最新均为 `80 / revoke-extra-lifecycle-postgres-grants`，所需列的类型一致。生产仅有 `media` 桶，`public = true`，`versioning_status = DISABLED`，上限 5 MiB，允许 JPEG、PNG、WebP。`storage.objects` 有 UUID 主键、`bucket_id` 与 `name`、`version` 文本、`metadata` 与 `user_metadata` JSONB、`archived_at`、`is_delete_marker` 和 `is_versioned`。当前记录使用 `archived_at IS NULL` 的桶/路径唯一索引。原有 `protect_objects_delete` 和 `update_objects_updated_at` 触发器已启用。
[生产 Storage 版本](https://vfgmptjfcfgptaqblydd.supabase.co/storage/v1/version) · [Staging Storage 版本](https://uartrtcmskyuqxawjqlx.supabase.co/storage/v1/version)

| 公开对象（脱敏别名） | 实际 HEAD | 字节 | 已知引用 |
| --- | --- | ---: | --- |
| `media-01` | `200 image/png` | 1,870,785 | 一条 M1 素材关联，一条项目记录含公开媒体路径 |
| `media-02` | `200 image/png` | 1,605,667 | 分发关系及项目、文章、站点设置的公开路径扫描未命中 |

两件共 3,476,452 字节，数据库及公开 HEAD 的类型和长度一致。两条对象均有 `version`，均为现行且非版本化对象，归档和删除标记均为 0。M1/M2 的 UUID 外键已验证，删除规则为 `RESTRICT`，无孤立或归档素材关联。项目、文章、设置的字符串扫描只覆盖当前库内可识别的标准公开路径。备份覆盖全部对象。

`storage.objects` 启用 RLS。五条策略允许公开读取 `media`，并将正常 Auth 用户的 INSERT、UPDATE、DELETE 限定到该桶的管理员 `aal2`。匿名、非管理员 `aal2`、管理员 `aal1`、管理员缺少 `aal`、管理员 `aal2` 的只读策略谓词检查通过。`service_role` 有 `BYPASSRLS`，历史保护在对象更新触发器中执行。隔离 Staging 的 runner 退出 `0`，覆盖、upsert、移动均返回 `400 / AccessDenied`，对象 UUID、原路径、版本、实际字节与任务快照一致。新上传、引用时删除拒绝、解除引用后删除也已实测。生产预检只读目录、策略及 HEAD，生产文件字节备份留待下一检查点。
[Staging Storage 实测](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-delivery.md#2026-11-14-完整-staging-复验)

00:31 和 00:45 的两次只读快照未见相关关系的冲突锁、等待锁的其他客户端或其他用户事务。过去 24 小时（11-14 00:35 至 11-15 00:35）API 网关日志记录 6 个对象接口请求，其中 0 个使用 POST、PUT、PATCH 或 DELETE。按小时采样，03:00–03:30 可作为下一次低写入候选窗口，尚未预约。日志覆盖的是观测到的网关请求，私有访问路径、直连和之后的流量以临执行检查为准。安排窗口时确认站点维护人员可用且可暂停后台编辑和媒体写入，核对东京地区服务状态。A 前后及 B 前立即查 `pg_locks`、活动事务、写入排队、桶状态和目录。若窗口冲突或出现阻塞，重新选窗口。
[Supabase 状态](https://status.supabase.com/) · [PostgreSQL 锁冲突矩阵](https://www.postgresql.org/docs/17/explicit-locking.html)

## 新备份检查点

已离线复核 M2 上线前留存目录 `D:\Backups\Songisle\prod-pre-m2-20261111-024634-b17bc8fc`。本机 `psql`、`pg_dump`、`pg_restore` 实际版本均为 `17.11`。数据库归档 `song-pre-m2.dump` 为 346,249 字节，SHA-256 `72379aa180a1aa23d398a978ae32f75ce54607833e185875e05c9f0b140b5ad5`，`pg_restore --list` 和完整离线解码均退出 `0`。独立 `media-objects.zip` 为 3,350,209 字节，SHA-256 `0ce264851818e1ecb790c85c7f60924986f276d866d6b2962f8ee8fd72f624a6`，可打开并读取两件对象。旧归档早于 M2 迁移。M3 执行需用包含 M2 平台稿与引用的新生产归档。

1. 申请一次生产只读备份授权，范围包括 `song` 的数据库和届时确认的 `media` 对象字节，目的地为新建的 `D:\Backups\Songisle\prod-pre-m3-<北京时间>-<随机后缀>`。验证目录及归档 ACL 仅允许本机当前操作者及 SYSTEM。重查 PostgreSQL 客户端绝对路径、版本、生产 Dashboard TLS CA 与指纹。优选 Direct 连接 `db.vfgmptjfcfgptaqblydd.supabase.co:5432`。如直连不可达，核对 Dashboard 给出的 Session Pooler 端点及项目限定用户名。连接使用 `sslmode=verify-full`、经确认的生产 CA 和 `default_transaction_read_only=on`。密码由用户在本机隐藏提示交接，仅供该客户端进程使用，结束后清除临时凭据。
2. 复用 M2 PowerShell 模板的进程隔离、校验与落盘流程。先把生产基线更新为本文八条历史、M2 表和 RPC、M3 对象缺失及此时的 Storage 清单。原模板的前置条件为六条历史和 M2 对象缺失。用 `pg_dump --format=custom` 导出 `public`、`analytics_private`、`distribution_private`、`auth`、`supabase_migrations`、`storage` 同一数据库快照。保留 schema、表、数据、ACL、所有者、RLS、索引、外键、函数和触发器。验证 `auth.users`、`auth.identities`、`auth.mfa_factors` 可恢复数据及其定义。沿用模板中排除现有临时 Auth 表数据的清单，保留各表定义并写入回执。关键表覆盖两张 M2 表及数据段、`source_retained_fields`、四张 M1 表、生产迁移历史和 Storage 元数据。
[M2 备份模板与 Auth 排除清单](https://github.com/Songbreezegit/song/blob/e91fe126c1747ad5080f80efc969ae42ccb14f5d/scripts/backup-distribution-m2-production.ps1) · [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
3. 数据库先写 `.dump.partial`。逐项检查 `pg_dump`、`pg_restore --list`、`pg_restore --exit-on-error --file=-` 完整离线解码均退出 `0`，离线解码 SQL 直接丢弃。核对输出非空，用目录 OID 校验关键定义及逐表数据段（含空的 M2 表）。同时核对归档保存的八条历史哈希、M1/M2 RLS 与 ACL、函数和触发器所需条目。保留退出码与计数。
[pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
4. 实际对象字节通过同一生产项目的官方 Storage 读取接口单独下载。用桶、UUID、正确编码的路径、对象 `version`、MIME、字节数和 SHA-256 建立私有清单，复核长度、可用时比对 ETag，并独立复读对象字节和数据库身份。ZIP 解压读取时核对相对路径、UUID 对应关系、字节数和 SHA-256。数据库与对象存储分别读取，在维护窗口让业务与媒体编辑保持静止，前后读取历史、对象/关联清单及业务基线。正常统计增量单独记录。发现对象替换、清单漂移、路径冲突、额外桶或校验失败时停止并复核。
[Supabase 备份与实际 Storage 文件范围](https://supabase.com/docs/guides/platform/backups)
5. 所有验证通过后才将两份 `.partial` 晋升为最终文件，对实际存在的最终文件重新计算 SHA-256。生成本机 `backup-receipt.json`，记录生产 Ref、时间、工具路径及版本、退出码、覆盖、文件路径、大小、哈希和 Storage 清单校验。任一步失败即停止并记 `FAIL`，缺少完整 `PASS` 回执的文件保持无效。归档、完整对象清单、Auth 数据和凭据留在受保护的本机目录，Git 只收录脱敏回执。新备份复核 PASS 后才提交迁移 A 的执行审批。

恢复需要独立审查。六个 schema 的逻辑归档依赖目标平台托管角色及成员关系、`extensions` 中的 `pgcrypto`、`uuid-ossp`、`pg_stat_statements`、`vault` 中的 `supabase_vault`、Auth/Storage 所有权及服务配置。备份时记录名称、版本、依赖及必要权限，角色口令留在原环境。GoTrue 签名密钥、外部 OAuth/SMTP、会话、Storage 的实际文件和 CDN 缓存各有恢复边界。隔离演练先建立兼容的托管依赖，再按官方 Storage 接口恢复文件并核对字节。通过 API 重新上传可能分配新 UUID，需在恢复业务引用前逐个核对 ID 映射、业务外键及公开路径。离线解码已验证旧归档可读，完整恢复演练尚未执行。

## 固定 SQL 与执行顺序

两条原始 SQL 从 M3 验收 Git 对象按 UTF-8 字节取出，与 `song-staging` 的 `statements[1]` 存储内容独立校验一致。审批提交时保留原文件 BOM/换行状态与 `BEGIN` / `COMMIT`，再次校验 SHA-256、字节数、目标 Ref。Supabase 为单条迁移分配的登记版本按生产回执记录。

| 顺序 | 原始 SQL | 字节 | SHA-256 | Staging 实际登记 |
| --- | --- | ---: | --- | --- |
| A | [20261112190304_add_distribution_publish_calendar.sql](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/migrations/20261112190304_add_distribution_publish_calendar.sql) | 25,929 | `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396` | `20261113062649` |
| B | [20261113170022_protect_distribution_publish_media.sql](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/migrations/20261113170022_protect_distribution_publish_media.sql) | 3,300 | `28d22d496fb293bfaa731af6535a24e975ee146440f03de8eae3217a1adb25c9` | `20261114053707` |

计划采用在 M2 生产和 M3 Staging 已验收的官方单条迁移接口 `POST https://api.supabase.com/v1/projects/vfgmptjfcfgptaqblydd/database/migrations`。请求体只含 `name` 和原文件的 `query`。各步骤分别授权并单次提交，使用新交接且仅限生产 `song`、最短可用有效期的 `Migrations (Read-write)` Scoped PAT。读回通过管理 API 与 SQL 目录交叉核验。客户端超时或 HTTP 回执不明时，先只读确认历史、SQL 哈希、对象与挂起事务。原 SQL 内事务保护 DDL，平台文档未承诺请求历史记录与内嵌 `COMMIT` 的同一提交边界。历史与对象不一致即停止。此流程保留历史原样，禁止全量推送、重置、手工补记历史或盲目重试。换通道时重新说明执行目标及影响并单独送审。两条完成后核验并撤销生产临时令牌。
[单条迁移 API](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [读取迁移历史 API](https://supabase.com/docs/reference/api/v1-list-migration-history)

### A 创建发布任务、审计与关联

A 的单个事务创建 `distribution_publish_tasks`、`distribution_publish_task_media`、`distribution_publish_logs`，建立索引、任务版本与审计幂等约束，以及六条 `ON DELETE RESTRICT` 外键。新增私有 schema 和 `NOLOGIN NOBYPASSRLS` 的最小权限写入角色。公开 `change_distribution_publish_task` 是 `SECURITY INVOKER`，私有写函数用 `SECURITY DEFINER` 绑定写入角色，并在处理输入、锁定与变更前校验管理员 `aal2`。三张表启用强制 RLS，客户端角色仅持有受限查询权限。日志在应用侧只能追加，任务变更与日志同事务提交。生效后仍由管理员手工确认，没有队列、计划执行器或外部平台调用。

创建外键会在引用的 M1/M2 及 Storage 表上请求与写入冲突的锁。A 文件没有显式 `lock_timeout`，预检会话观察到 `lock_timeout = 0`、`statement_timeout = 2min`，后者是本次连接的读数。实际获批通道的执行预算和数据库锁状态在提交前复查。在计划时段观察是否发生阻塞，按回执核查状态。等待或请求超时优先确认实际结果。
[PostgreSQL 外键锁](https://www.postgresql.org/docs/17/sql-altertable.html) · [M3 权限设计](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-security.md)

A 读回验收以九条历史、A 唯一且存储哈希一致为起点。核对三张空表、强制 RLS 与策略、六条已验证的限制删除外键、任务索引和唯一约束、私有角色成员关系、公开和私有例程的所有者、Invoker/Definer 与 EXECUTE 范围。运行 M1/M2/M3 的五身份只读 smoke，核对生产管理员、业务与 Storage 清单和 Advisor。M3 smoke 调用无效请求验证权限，在写入前返回预期错误。B 的审批须等 A 验收完成，期间 PR #13 维持 Draft，三张 M3 表保持空。
[M3 只读 smoke](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/tests/distribution_m3_security_smoke.sql)

### B 保护历史素材对象

| 审查项 | 影响和门槛 |
| --- | --- |
| Storage 写锁 | 原 SQL 在事务内对整张 `storage.objects` 获取 `SHARE ROW EXCLUSIVE`，允许普通 SELECT，和各桶的 INSERT、UPDATE、DELETE 及冲突 DDL 互斥。锁从获取持有至提交或回滚。`SET LOCAL lock_timeout = '5s'` 约束每次取锁等待，持锁运行时间仍取决于路径检查与 DDL。遇到 `55P03`、超时或服务回执不明时，先只读核对锁、历史、函数及触发器，再处理。 |
| 既有历史引用 | 锁内扫描 `task_created`、`task_snapshot_updated` 审计快照。逐个核对 `media_id` 对应 `media` 桶内的原始路径，且对象有效、未归档、无删除标记并有对应任务关联。发现不一致会在安装触发器前报错。生产首次 A→B 期间预计为空，提交 B 前只读确认三张表仍空。任何现有 M3 行先核对来源与路径。 |
| `SECURITY DEFINER` | 仅由 `storage.objects` 的 `AFTER UPDATE FOR EACH ROW` 触发。函数所有者须具备跳过 RLS 的维护权限，固定 `search_path = ''`、`row_security = off`，通过限定表名 `public.distribution_publish_task_media` 检查引用。A 已为查询所用的 `media_id` 建立索引。`PUBLIC`、`anon`、`authenticated`、`service_role` 和 `distribution_publish_writer` 均无 EXECUTE，触发器通过调用内部函数约束 Storage 服务的更新。 |
| 字节、路径和版本 | 对引用对象，变更 UUID、桶、路径、Storage 版本、服务元数据或归档、删除标记、版本化字段时返回 `42501`。单独更新 `user_metadata` 或访问时间等字段仍可行。A 的任务快照在锁住素材对象后才写入关联，B 的 `VOLATILE` 查询在并发更新等待解除后检查已提交引用。删除由既有及新增 RESTRICT 外键防护。新增文件与未被 M3 引用的文件继续走原 Storage 流程。 |
| 兼容性和托管边界 | B 安装时要求 `media.versioning_status = DISABLED`。生产与 Staging 的 Storage 版本、所需列及桶状态相符，PostgreSQL 主版本一致，补丁版本不同。原 SQL 会在发现 `ENABLED` 或 `SUSPENDED` 时退出。维护期间保持现状，未来启用版本管理或托管 Storage 升级前在隔离环境重测 update、upsert、move、delete、正常上传和实际字节。B 在托管 `storage` schema 增加触发器，存在后续托管升级兼容风险。文件操作使用官方 Storage API。 |

[PostgreSQL 表锁](https://www.postgresql.org/docs/17/explicit-locking.html) · [锁超时参数](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-LOCK-TIMEOUT) · [Supabase Storage 托管 schema](https://supabase.com/docs/guides/storage/schema/design) · [M3 增量安全审查](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-security.md#历史素材不可变保护)

B 读回验收须见十条历史，A 和 B 哈希均保留且各登记一次。核对触发器已启用且绑定预期函数，函数体、所有者、ACL、私有 schema、五条原 Storage 策略、主键及版本字段保持预期。重跑只读 smoke、业务与两件素材的清单和公开 HEAD，对照 Advisor。A 或 B 的事务失败时分别保留其之前已核验状态。若 B 缺失或验收失败，保留 A 并阻止 M3 前端上线。对于已提交的异常，优先查明根因后单独审查向前修复。现有 SQL 回滚草案只适用于三张 M3 表为空且另行批准的场景。备份保留本机，不进行生产重置、自动回滚或直接删除发布历史。
[M3 空库回滚草案](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/rollbacks/distribution_m3.sql)

## 合并与正式部署检查点

已从 Cloudflare 生产 Worker `song` 的 Builds 设置读回绑定仓库 `Songbreezegit/song`、生产分支 `main`、构建 `npm run build`、部署 `npx wrangler deploy`，Builds 开启。非生产分支使用 `npx wrangler versions upload`。生产主分支构建 `4cb54abc-d6e9-4834-96e2-2226723b352e` 关联当前 `main`。发布设置页同时显示 GitHub 用户或组织详情读取告警，最近主分支和 PR 检查已成功。合并前重新核对 GitHub 绑定、告警和必需检查。当前 `main` 更新会自动构建并切换生产流量。
[当前 main 检查](https://github.com/Songbreezegit/song/commit/e6e2f8ec481dbdc64fe5ae790aceaebab5523414/checks) · [Workers 生产分支与构建](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)

预检时 Worker `493cb30a`（控制台可见前缀）承接 100% 流量，关联当前 `main`。`songisle.xyz`、该版本 URL 与上一 M2 版本 `7b30d14a-0049-4fb7-b517-49d8fc7e8f58` 的版本 URL 均返回 HTTPS 200，入口脚本相同并指向生产 `song`。上线审批前从控制台或 Wrangler 读回完整现行 UUID，确认版本 URL、资源绑定和回退资格。故障时按届时获批的范围，在 `song` 的 Deployments 上选择确认的旧稳定 Worker 并恢复 100% 流量，保留数据库的 M3 数据和迁移。正式域读回流量、入口资源和公开/后台冒烟结果。
[M2 正式发布回执](admin-distribution-m2-production-release.md) · [Cloudflare Worker 回退](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

| 独立审批 | 送审条件与动作 |
| --- | --- |
| 1. 生产只读备份 | 确认维护窗口和生产 Ref，按上文方案生成并复核新数据库归档及实际 Storage 文件。 |
| 2. 生产迁移 A | 新备份 PASS 且生产预检仍一致。送审完整 SQL、SHA-256、目标、通道、事务及失败处置，获批后单次执行并验收。 |
| 3. 生产迁移 B | A 独立验收完成，桶版本管理为 `DISABLED`、对象与引用匹配、没有冲突锁。送审完整 SQL 和哈希，获批后单次执行并验收。 |
| 4. PR #13 合并 | A/B 均验收通过。复核精确 PR HEAD、main、合并树及必需检查。**当前自动切流的构建配置下保持待审批且不合并**。保留两个独立审批需要先另行审查并批准无切流的构建配置，例如生产构建阶段仅上传版本，验证该动作不会切流之后才能授权 Ready 与 merge commit。 |
| 5. Cloudflare 正式切流 | 验证新 Worker 来源为本次合并 SHA、指向 `song`、版本 URL 的只读冒烟及旧稳定版本可用。仅经独立批准后将已核对版本提升到正式流量，并观察明确部署结果。是否恢复原自动部署命令及其触发条件在发布方案内另行确认。 |

正式发布前后，从 `songisle.xyz` 只读核查首页、公开项目和两件媒体、匿名后台重定向与分发 API 拒绝。由现有管理员完成 TOTP 后，核查 M1 账号和内容、M2 平台稿查询以及 M3 的 `/admin/distribution/calendar` 和 `/admin/distribution/history`。核对 M3 初始空态、查询与导航，保留真实业务数据。记录 main SHA、Worker 完整版本 UUID、流量比例、检查时点、结果及故障处置。
[Cloudflare 版本与部署](https://developers.cloudflare.com/workers/versions-and-deployments/)

## 本轮结果

| 检查项 | 状态 | 依据或剩余条件 |
| --- | --- | --- |
| PR #13、生产八条历史、M1/M2 及 Storage 只读权限 | PASS | 验收 SHA 一致，先前六条与旧归档一致，四条分发 SQL 与 Git 哈希一致。两件媒体 HEAD 为 200，未发现孤立引用 |
| M3 A/B 原始哈希与版本管理兼容性 | PASS | 两条 Git 原始文件与 Staging 存储哈希一致。所需生产列在位，`media` 为 `DISABLED`。真实变更验证来自 Staging |
| 既有备份复核 | PASS | M2 上线前数据库归档和文件 ZIP 可读且哈希一致。待新 M3 备份 |
| 维护窗口及新备份 | 待审批 | 候选窗口待运营确认。执行前重查连接、活动锁、Storage 和业务基线 |
| 生产 A/B、PR #13 合并和正式切流 | 待审批 | 顺序执行各自检查点。现有自动切流配置需先解决与独立审批的冲突 |
