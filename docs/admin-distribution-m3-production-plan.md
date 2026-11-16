# 松屿内容分发 M3 生产迁移预检与执行方案

## 审查基线

| 项目 | 2026-11-15 预检结果（北京时间） |
| --- | --- |
| M3 | `feat/admin-distribution-m3`、验收提交 `8de09e348349c148c79fad5694d89006b5673eb7`。PR #13 为开放的 Draft，GitHub 报告 `MERGEABLE`，该 HEAD 的 Workers Builds 为 `SUCCESS` |
| 主分支 | `e6e2f8ec481dbdc64fe5ae790aceaebab5523414`，是 M3 验收提交的直接合并基线。报告分支由此创建，只提交本文 |
| 生产目标 | Supabase `song`，Project Ref `vfgmptjfcfgptaqblydd`，东京 `ap-northeast-1`，项目状态 `ACTIVE_HEALTHY`，PostgreSQL `17.6`（托管构建 `17.6.1.166`） |
| Staging 对照 | `song-staging`，Project Ref `uartrtcmskyuqxawjqlx`，PostgreSQL `17.11`。本次通过已有 Supabase 连接只读检查历史和目录 |

本文保留 2026-11-15 的生产预检快照。发布按四个节点审批：一次生产备份、迁移 A、迁移 B、PR #13 合并及 Cloudflare 自动正式部署。功能与两条 SQL 固定在 M3 验收提交。
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

两件共 3,476,452 字节，数据库及公开 HEAD 的类型和长度一致。两条对象均有 `version`，均为现行且非版本化对象，归档和删除标记均为 0。M1/M2 的 UUID 外键已验证，删除规则为 `RESTRICT`，无孤立或归档素材关联。项目、文章、设置的字符串扫描只覆盖当前库内可识别的标准公开路径。备份节点以当时读取的完整对象清单为准。

`storage.objects` 启用 RLS。五条策略允许公开读取 `media`，并将正常 Auth 用户的 INSERT、UPDATE、DELETE 限定到该桶的管理员 `aal2`。匿名、非管理员 `aal2`、管理员 `aal1`、管理员缺少 `aal`、管理员 `aal2` 的只读策略谓词检查通过。`service_role` 有 `BYPASSRLS`，历史保护在对象更新触发器中执行。隔离 Staging 的 runner 退出 `0`，覆盖、upsert、移动均返回 `400 / AccessDenied`，对象 UUID、原路径、版本、实际字节与任务快照一致。新上传、引用时删除拒绝、解除引用后删除也已实测。生产预检只读目录、策略及 HEAD，生产文件字节备份留待下一检查点。
[Staging Storage 实测](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-delivery.md#2026-11-14-完整-staging-复验)

00:31 和 00:45 的两次只读快照未见相关关系的冲突锁、等待锁的其他客户端或其他用户事务。过去 24 小时（11-14 00:35 至 11-15 00:35）API 网关日志记录 6 个对象接口请求，其中 0 个使用 POST、PUT、PATCH 或 DELETE。按小时采样，03:00–03:30 可作为下一次低写入候选窗口，尚未预约。日志覆盖的是观测到的网关请求，私有访问路径、直连和之后的流量以临执行检查为准。安排窗口时确认站点维护人员可用且可暂停后台编辑和媒体写入，核对东京地区服务状态。A 前后及 B 前立即查 `pg_locks`、活动事务、写入排队、桶状态和目录。若窗口冲突或出现阻塞，重新选窗口。
[Supabase 状态](https://status.supabase.com/) · [PostgreSQL 锁冲突矩阵](https://www.postgresql.org/docs/17/explicit-locking.html)

## 节点 1 生产备份

在 A 之前生成一份新的 PostgreSQL 逻辑备份，同时验证能否复用 M2 的 Storage ZIP。备份 PASS 后，A、B 和上线沿用这份备份。A 之后和 B 之后做各自的只读验收。若业务或 Storage 数据偏离稳定基线、迁移异常或备份失效，暂停后续节点，评估是否需要补充备份以及何处恢复。

### 数据库归档和脚本适配

1. 备份获批后，确认维护窗口并暂停后台内容和媒体编辑。在受保护的 `D:\Backups\Songisle\prod-pre-m3-<时间>` 生成 `song-pre-m3.dump.partial`，目录仅当前操作者与 SYSTEM 可访问。沿用本机已验证的 17.11 版 `psql`、`pg_dump` 和 `pg_restore`。复核工具绝对路径与生产 CA。优先直连 `db.vfgmptjfcfgptaqblydd.supabase.co:5432`，使用 `sslmode=verify-full` 和 `default_transaction_read_only=on`。数据库密码从本机隐藏提示交给目标进程，结束后清理。
2. 导出前只读核对上面的八条生产迁移，重取一次预检中的聚合量，以该次读数为业务基线。用一条 `pg_dump --format=custom` 导出 `public`、`analytics_private`、`distribution_private`、`auth`、`supabase_migrations` 和 `storage`。保留业务数据、M1/M2、管理员、`auth.users`、`auth.identities`、`auth.mfa_factors`、迁移历史和 Storage 元数据，以及 ACL、所有者、RLS、函数、触发器、索引与外键。沿用 M2 的临时 Auth 表数据排除清单，保留各表定义。
3. `pg_dump` 必须退出 `0` 且输出存在并非空。`pg_restore --list` 和 `pg_restore --exit-on-error --file=-` 完整离线解码均须退出 `0`，解码输出丢弃。按归档目录和 OID 核对关键定义、ACL、四张 M1 表和两张 M2 表的数据段，包括空表。离线读取归档中的 `supabase_migrations.schema_migrations` 数据段，只输出名称、版本和哈希，核对全部八条。通过本节与 Storage 的一致性校验后，将 `.partial` 改为正式文件名并记录最终文件路径、字节数、SHA-256 与退出码。
[pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) · [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)

已静态检查 M2 备份模板。保留 `Invoke-PgClient` 的只读连接、进程级凭据隔离、退出码处理和受保护目录，以及 `Test-ArchiveContents` 的 OID 校验。原模板不能直接执行。节点 1 的适配包括以下几处。

| 位置 | 适配方式 |
| --- | --- |
| `RunName`、归档名与连接标识 | 改为 M3 目录和 `song-pre-m3.dump`，使用独立的备份进程标识。 |
| `Read-ProductionInventory` | 用本文八条生产版本、迁移名和存储哈希更新基线。原先要求 M2 表缺失的检查改为验证两张 M2 表、`source_retained_fields` 和 M2 RPC 在位，且 M3 对象仍缺失。清单加入关键业务数据和素材关联的行数及摘要。 |
| `Test-ArchiveContents` | 关键表增加 `distribution_variants` 及 `distribution_variant_media`，继续校验 Auth、统计、M1、Storage 元数据和 ACL。原模板主要检查归档目录，增加离线读回归档内八条历史记录的校验。 |
| `Backup-StorageMedia` 与最终落盘 | 复用原对象下载及 ZIP 校验逻辑，将写新 ZIP 设为未通过复用时的分支。复用成功时回执引用旧路径及哈希，只晋升新的数据库 `.partial`。 |

[M2 备份模板与 Auth 排除清单](https://github.com/Songbreezegit/song/blob/e91fe126c1747ad5080f80efc969ae42ccb14f5d/scripts/backup-distribution-m2-production.ps1)

### Storage 文件复用与一致性

旧归档为 `D:\Backups\Songisle\prod-pre-m2-20261111-024634-b17bc8fc\media-objects.zip`，3,350,209 字节，SHA-256 为 `0ce264851818e1ecb790c85c7f60924986f276d866d6b2962f8ee8fd72f624a6`。本次文档修订时已在本机离线重算 ZIP 哈希，并逐件验证两张图片可读取，长度和实际 SHA-256 与 ZIP 的 `manifest.json` 一致。与生产当前字节的对照留在获批备份节点执行。

1. 复核旧 ZIP 的 SHA-256 和清单，再按生产实时清单通过 Storage API 逐件读取当前文件。用唯一缓存参数读取当前字节，核对响应类型与长度，并计算 SHA-256。按 `bucket`、对象 UUID、路径、MIME、字节数和内容 SHA-256 与旧清单及实际 ZIP 条目逐件比对，核对对象集合完整。文件大小、HEAD 或 ETag 可辅助核验，复用要求实际字节哈希一致。
2. 对象集合和每件对象全部匹配时直接引用原 ZIP。出现新增、移除、改名、UUID 或内容变更、旧归档缺失或损坏，或其它无法证明一致的情况，则归档当时完整的 Storage 文件集合。可使用本轮已读且通过校验的字节生成 `.zip.partial`，打开逐件校验清单及条目后转为正式文件并计算最终哈希。当前数据无法完整读取或校验时，备份节点不能 PASS。
3. 数据库与 Storage 分开读取。编辑暂停期间用脚本在备份前后各读一次关键清单，比较业务数据、素材关联、对象 UUID、路径和对象 `version`。正常统计增长单独记入回执。业务或对象发生变化时，先确认何时变化及归档所覆盖的状态，校验未完成前保持备份无效。
[Supabase Storage 文件独立于数据库归档](https://supabase.com/docs/guides/platform/backups) · [读取最新对象字节的缓存参数](https://supabase.com/docs/guides/storage/cdn/smart-cdn)

在本文追加一次简洁备份回执，记录生产 Ref、时间、最终数据库归档路径、大小和 SHA-256、各命令退出码、归档覆盖结果、Storage `复用` 或 `新建`、所用 ZIP 路径和哈希、脱敏对象清单及逐件比对结果和验证时间。数据库归档、对象实际路径与 UUID 清单、Auth 数据和凭据保存在受保护的本机目录。两部分全部通过后记录 `PASS`，以该回执进入 A 审批。

归档可读性与完整恢复演练分别验收，本阶段只做归档检查。六个 schema 的逻辑归档仍依赖 Supabase 托管角色、相关扩展、Auth/Storage 所有权和服务设置。后续若需恢复，在隔离环境按官方 Storage 接口校验文件，逐项核对重新上传分配的 UUID、业务引用与公开路径。GoTrue 签名密钥、OAuth/SMTP、会话以及 Storage 字节遵循各自的恢复边界。

## 固定 SQL 与执行顺序

两条原始 SQL 从 M3 验收 Git 对象按 UTF-8 字节取出，与 `song-staging` 的 `statements[1]` 存储内容独立校验一致。审批提交时保留原文件 BOM/换行状态与 `BEGIN` / `COMMIT`，再次校验 SHA-256、字节数、目标 Ref。Supabase 为单条迁移分配的登记版本按生产回执记录。

| 顺序 | 原始 SQL | 字节 | SHA-256 | Staging 实际登记 |
| --- | --- | ---: | --- | --- |
| A | [20261112190304_add_distribution_publish_calendar.sql](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/migrations/20261112190304_add_distribution_publish_calendar.sql) | 25,929 | `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396` | `20261113062649` |
| B | [20261113170022_protect_distribution_publish_media.sql](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/migrations/20261113170022_protect_distribution_publish_media.sql) | 3,300 | `28d22d496fb293bfaa731af6535a24e975ee146440f03de8eae3217a1adb25c9` | `20261114053707` |

沿用 M2 生产验证过的官方单条迁移接口 `POST https://api.supabase.com/v1/projects/vfgmptjfcfgptaqblydd/database/migrations`。请求体只含 `name` 和原文件的 `query`。A、B 分别获批、各提交一次。凭据使用仅限生产 `song`、最短可用有效期的 `Migrations (Read-write)` Scoped PAT，任务结束后撤销。通过管理 API 和 SQL 目录交叉读取平台登记的版本、原 SQL 哈希与对象。禁止全量 `db push`、数据库重置和手工改写迁移历史。
[单条迁移 API](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [读取迁移历史 API](https://supabase.com/docs/reference/api/v1-list-migration-history)

### 节点 2 迁移 A

A 的单个事务创建 `distribution_publish_tasks`、`distribution_publish_task_media`、`distribution_publish_logs`，建立索引、任务版本与审计幂等约束，以及六条 `ON DELETE RESTRICT` 外键。新增私有 schema 和 `NOLOGIN NOBYPASSRLS` 的最小权限写入角色。公开 `change_distribution_publish_task` 是 `SECURITY INVOKER`，私有写函数用 `SECURITY DEFINER` 绑定写入角色，并在处理输入、锁定与变更前校验管理员 `aal2`。三张表启用强制 RLS，客户端角色仅持有受限查询权限。日志在应用侧只能追加，任务变更与日志同事务提交。生效后仍由管理员手工确认，没有队列、计划执行器或外部平台调用。

节点 1 PASS 后沿用该备份，单独送审 A。提交前确认生产 Ref、完整八条旧历史、A 的原文件哈希、维护窗口、后台编辑已暂停和最新锁状态。创建外键会在 M1/M2 的被引用表和 `storage.objects` 上申请与写入冲突的锁。查询 `pg_locks` 和 `pg_stat_activity`，发现冲突锁、活跃写事务或排队即推迟提交。A 原 SQL 未设置 `lock_timeout`。生产管理 API 只读会话的参数、单条迁移 API 的能力边界及拟采用的中止步骤见本页审批材料。
[PostgreSQL 外键锁](https://www.postgresql.org/docs/17/sql-altertable.html) · [M3 权限设计](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-security.md)

生产执行端复用 M2 的 PowerShell 7 `Invoke-WebRequest` 参数。连接超时 15 秒（`ConnectionTimeoutSeconds`），响应流单次读取超时 60 秒（`OperationTimeoutSeconds`），关闭重定向和自动重试。60 秒是读取停滞上限。执行前在本机记录一次提交标记、目标、SQL 哈希和时间。HTTP 客户端超时会结束本地等待，PostgreSQL 的执行结果要从数据库读回确认。具体参数随 A 请求体一同送审。
[PowerShell 请求超时参数](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-webrequest?view=powershell-7.6#-operationtimeoutseconds) · [PostgreSQL 超时参数](https://www.postgresql.org/docs/17/runtime-config-client.html)

A 读回验收以九条历史、A 唯一且存储哈希一致为起点。核对三张空表、强制 RLS 与策略、六条已验证的限制删除外键、任务索引和唯一约束、私有角色成员关系、公开和私有例程的所有者、Invoker/Definer 与 EXECUTE 范围。运行 M1/M2/M3 的五身份只读 smoke，核对生产管理员、业务与 Storage 清单和 Advisor。M3 smoke 调用无效请求验证权限，在写入前返回预期错误。B 的审批须等 A 验收完成，期间 PR #13 维持 Draft，三张 M3 表保持空。
[M3 只读 smoke](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/tests/distribution_m3_security_smoke.sql)

### 节点 3 迁移 B

A 独立验收 PASS 后申请 B 审批。提交前确认九条历史及 A 的存储哈希，三张 M3 表为空，`media` 版本管理为 `DISABLED`，Storage 结构仍与 Staging 对照一致，且相关锁和媒体写入已清空。

| 审查项 | 影响和门槛 |
| --- | --- |
| Storage 写锁 | 原 SQL 在事务内对整张 `storage.objects` 获取 `SHARE ROW EXCLUSIVE`，允许普通 SELECT，和各桶的 INSERT、UPDATE、DELETE 及冲突 DDL 互斥。锁从获取持有至提交或回滚。`SET LOCAL lock_timeout = '5s'` 约束每次取锁等待，持锁运行时间仍取决于路径检查与 DDL。遇到 `55P03`、超时或服务回执不明时，先只读核对锁、历史、函数及触发器，再处理。 |
| 既有历史引用 | 锁内扫描 `task_created`、`task_snapshot_updated` 审计快照。逐个核对 `media_id` 对应 `media` 桶内的原始路径，且对象有效、未归档、无删除标记并有对应任务关联。发现不一致会在安装触发器前报错。生产首次 A→B 期间预计为空，提交 B 前只读确认三张表仍空。任何现有 M3 行先核对来源与路径。 |
| `SECURITY DEFINER` | 仅由 `storage.objects` 的 `AFTER UPDATE FOR EACH ROW` 触发。函数所有者须具备跳过 RLS 的维护权限，固定 `search_path = ''`、`row_security = off`，通过限定表名 `public.distribution_publish_task_media` 检查引用。A 已为查询所用的 `media_id` 建立索引。`PUBLIC`、`anon`、`authenticated`、`service_role` 和 `distribution_publish_writer` 均无 EXECUTE，触发器通过调用内部函数约束 Storage 服务的更新。 |
| 字节、路径和版本 | 对引用对象，变更 UUID、桶、路径、Storage 版本、服务元数据或归档、删除标记、版本化字段时返回 `42501`。单独更新 `user_metadata` 或访问时间等字段仍可行。A 的任务快照在锁住素材对象后才写入关联，B 的 `VOLATILE` 查询在并发更新等待解除后检查已提交引用。删除由既有及新增 RESTRICT 外键防护。新增文件与未被 M3 引用的文件继续走原 Storage 流程。 |
| 兼容性和托管边界 | B 安装时要求 `media.versioning_status = DISABLED`。生产与 Staging 的 Storage 版本、所需列及桶状态相符，PostgreSQL 主版本一致，补丁版本不同。原 SQL 会在发现 `ENABLED` 或 `SUSPENDED` 时退出。维护期间保持现状，未来启用版本管理或托管 Storage 升级前在隔离环境重测 update、upsert、move、delete、正常上传和实际字节。B 在托管 `storage` schema 增加触发器，存在后续托管升级兼容风险。文件操作使用官方 Storage API。 |

[PostgreSQL 表锁](https://www.postgresql.org/docs/17/explicit-locking.html) · [锁超时参数](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-LOCK-TIMEOUT) · [Supabase Storage 托管 schema](https://supabase.com/docs/guides/storage/schema/design) · [M3 增量安全审查](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-security.md#历史素材不可变保护)

B 读回验收须见十条历史，A、B 各登记一次且存储哈希与原文件一致。核对触发器已启用且绑定预期函数，函数体、所有者、ACL、私有 schema、五条原 Storage 策略、主键及版本字段保持预期。重跑只读 smoke，对比 M1/M2 业务与素材清单，确认两张现有图片可正常访问，并核对 Advisor。B 验收 PASS 后才进入联合发布审批。

### 超时和未知结果

HTTP 超时、连接中断、服务端错误或数据库锁超时后，先只读查询活动事务与锁、管理 API 和数据库迁移历史、存储 SQL 哈希及实际对象。锁或事务仍在时，状态记 `BLOCKED`，等待结果明确。原 SQL 的显式事务保护其 DDL。单条迁移 API 文档未承诺历史登记和原脚本 `COMMIT` 的同一事务边界，因此两边都要验证。

| 只读结果 | 处置 |
| --- | --- |
| 事务已结束，历史与对象均未添加 | 停止当前节点，记录失败原因。恢复执行前重新核对条件并明确批准下一次提交。 |
| 事务已结束，历史、哈希与对象均已生效 | 转入该条迁移的独立验收。 |
| 结果仍不可知，或历史、哈希、对象不一致 | 立即停止，保留脱敏证据。结果未知记 `BLOCKED`，确认不一致记 `FAIL`。查明原因并审查修复方案。 |

若 B 失败，保留已验收的 A，暂停 M3 发布。故障处理保留迁移历史与业务数据，优先评估向前修复。SQL 回滚草案仅供另行审查，且要求三张 M3 表为空。生产数据库与 Worker 回退独立处理。
[M3 空库回滚草案](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/rollbacks/distribution_m3.sql)

## 节点 4 PR #13 合并与自动正式部署

原预检从 Cloudflare 生产 Worker `song` 读回绑定仓库 `Songbreezegit/song`、生产分支 `main`、构建 `npm run build`、部署 `npx wrangler deploy`。主分支构建 `4cb54abc-d6e9-4834-96e2-2226723b352e` 与当时 `main` 一致。设置页当时有 GitHub 用户或组织详情读取告警，最近主分支和 PR 检查成功。沿用既有自动部署配置，合并前重新核对绑定、告警和必需检查。
[当前 main 检查](https://github.com/Songbreezegit/song/commit/e6e2f8ec481dbdc64fe5ae790aceaebab5523414/checks) · [Workers 生产分支与构建](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)

预检时 Worker `493cb30a`（控制台可见前缀）承接 100% 流量，关联当时 `main`。`songisle.xyz`、该版本 URL 与上一 M2 版本 `7b30d14a-0049-4fb7-b517-49d8fc7e8f58` 的版本 URL 均返回 HTTPS 200，入口脚本相同并指向生产 `song`。正式联合审批前确认 A、B 均 PASS，PR #13 HEAD 仍等于验收版本，main 无意外变化，预期合并树正确，GitHub 必需检查通过，Cloudflare 自动部署配置与生产 Supabase 绑定正确。读回当前稳定 Worker 的完整 UUID、流量和回退可用性。
[M2 正式发布回执](admin-distribution-m2-production-release.md)

**联合授权须明确写出：批准合并 `main` 同时批准触发 Cloudflare 自动生产部署并承接正式流量。** 一次批准涵盖 PR #13 转为 Ready、以 merge commit 合入 `main`、跟踪自动构建至明确结果、成功后新 Worker 正式上线和只读冒烟。将严重故障时恢复指定稳定 Worker 的条件与版本一并送审。维持现有 Workers Builds 命令与触发机制。
[Cloudflare 版本与部署](https://developers.cloudflare.com/workers/versions-and-deployments/)

跟踪该 merge SHA 对应的 Build ID、部署版本、流量和检查结果。构建或部署失败时，停在本节点，核对实际活跃版本，记录原回执。新版本已承接流量且出现严重故障时，按获批方案在 `song` 的 Deployments 中恢复指定稳定 Worker 的 100% 流量，保留已经生效的 M3 数据库迁移。确认正式域响应与恢复后的流量。
[Cloudflare Worker 回退](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

发布前核对现行正式站基线，上线后从 `songisle.xyz` 只读检查首页、公开项目、现有媒体、管理员登录入口、匿名后台重定向和私有分发 API 拒绝。由现有管理员完成 TOTP，核查 M1 内容分发、M2 平台稿、M3 `/admin/distribution/calendar` 和 `/admin/distribution/history` 的读取与导航。验证 M3 初始空态，生产冒烟沿用现有数据，写入流程的证据来自 Staging。回执记录 main Merge SHA、Cloudflare Build ID、新 Worker 完整 UUID、流量、生产 Supabase Ref、正式站状态及逐项检查结果。

## 四个审批节点

| 节点 | 送审条件与动作 |
| --- | --- |
| 1. 生产备份 | 确认窗口和生产 Ref。生成一次新数据库归档，验证并复用旧 Storage ZIP，或按实际清单新建。 |
| 2. 生产迁移 A | 节点 1 PASS。单独审批 A 的完整 SQL、哈希、目标、通道、事务及失败处置，执行并验收。 |
| 3. 生产迁移 B | 节点 2 PASS。复核 Storage 和锁，单独审批 B 的完整 SQL、哈希与目标，执行并验收。 |
| 4. 合并与正式发布 | 节点 3 PASS 且发布预检通过。一次审批覆盖 Ready、merge commit、Cloudflare 自动部署和只读验收。 |

每个节点在报告追加简短 `PASS` / `FAIL` / `BLOCKED` 回执。只有前一节点通过并取得对应授权，才开始下一步。

## 本轮结果

| 检查项 | 状态 | 依据或剩余条件 |
| --- | --- | --- |
| PR #13、生产八条历史、M1/M2 及 Storage 只读权限 | PASS | 验收 SHA 一致，先前六条与旧归档一致，四条分发 SQL 与 Git 哈希一致。两件媒体 HEAD 为 200，未发现孤立引用 |
| M3 A/B 原始哈希与版本管理兼容性 | PASS | 两条 Git 原始文件与 Staging 存储哈希一致。所需生产列在位，`media` 为 `DISABLED`。真实变更验证来自 Staging |
| 旧 Storage ZIP 离线复核 | PASS | ZIP SHA-256 和两张归档图片的长度、SHA-256 与清单一致。生产实时文件对照及复用判定待节点 1 |
| M2 备份模板 | 静态检查通过 | 可复用连接、导出与校验，实施前按节点 1 适配八条历史、M2 表、归档内容和 Storage 分支 |
| 生产备份 | PASS | 新数据库归档及生产一致性校验通过。两件媒体验证后复用 M2 ZIP，详见本页节点 1 回执 |
| 生产迁移 A | PASS | 已在生产登记 `20261115085958`，详见节点 2 执行回执 |
| 生产迁移 B | PASS | 已在生产登记 `20261115181800`，详见节点 3 执行回执 |
| 合并与正式发布 | PASS | PR #13 已合并，新 Worker 承接 100% 正式流量，公开和管理员只读冒烟均通过 |

## 节点 1 执行回执

2026-11-15 15:26:07–15:26:58（北京时间），生产 Supabase `song`（`vfgmptjfcfgptaqblydd`）备份通过。数据库为 PostgreSQL 17.6，使用 PostgreSQL 17.11 客户端直连，TLS 1.3、`sslmode=verify-full`、`default_transaction_read_only=on`。

| 文件 | 本机路径 | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| 新数据库归档 | `D:\Backups\Songisle\prod-pre-m3-20261115-152607\song-pre-m3.dump` | 399,453 | `26f775c2132011a96ab8cc573323db60fe2f8a2c7989d1e5a3e94cced8be0a97` |
| 复用的 M2 Storage ZIP | `D:\Backups\Songisle\prod-pre-m2-20261111-024634-b17bc8fc\media-objects.zip` | 3,350,209 | `0ce264851818e1ecb790c85c7f60924986f276d866d6b2962f8ee8fd72f624a6` |

- `pg_dump`、`pg_restore --list`、完整离线解码、归档迁移历史读回、备份前后两次 `psql` 查询及备份脚本均退出 `0`。完整校验后晋升 `.partial`，对两份最终文件独立复算 SHA-256，并确认目录、文件和本机回执的访问权限。
- 归档覆盖约定的六个 schema，核对 617 个目录条目、52 张表和 42 个数据段，含四张 M1 表、两张空的 M2 平台稿相关表、Auth 用户、身份与 MFA 因子、统计、生产历史和 Storage 元数据。核对六张分发表数据段及关键权限定义。旧 Auth 临时表数据排除清单已沿用。归档内八条迁移的名称、版本及 SQL 哈希均与生产基线一致。
- 后台内容和媒体编辑已暂停。备份前后比对 13 组业务及 Auth 表的行数和摘要，并核对目录、外键关联、媒体路径、对象 UUID 及版本，全部一致。该时点有管理员 1、已验证管理员 TOTP 1、项目 1、分发账号 1、内容源 1、目标关联 1、M1 素材关联 1、M2 平台稿 0，M3 对象缺失。统计前后读数一致。

15:26:57 以 Storage API 读取两件生产文件，共 3,476,452 字节。旧 ZIP 的整体 SHA-256、归档条目及实际内容均核对通过。两件文件的桶、对象 UUID、路径、MIME、字节数、实际 SHA-256 与旧归档逐件一致，直接复用该 ZIP。

| 对象别名 | 桶 | MIME | 字节 | 生产及 ZIP 内容 SHA-256 | 比对 |
| --- | --- | --- | ---: | --- | --- |
| `media-01` | `media` | `image/png` | 1,870,785 | `79b5721ea00a8592c364afb46be2ff2482287d4010e2618efc8b5a4bd63c8c86` | PASS |
| `media-02` | `media` | `image/png` | 1,605,667 | `c762ff99b683342d2fe3f9ca828f4c4aa473eb7853f418d56046ef8772132da6` | PASS |

首次启动的窗口状态判断有误，两个窗口各导出一次。比对两份归档完整离线解码输出的 SHA-256 和目录条目摘要，均一致，因此清除了首次启动生成的副本。本机保留表列的一份 M3 数据库归档及本次回执，媒体沿用旧 ZIP。完整恢复演练未执行。

节点 1 状态为 `PASS`，已获用户审查通过。节点 2 沿用这份归档。

## 节点 2 迁移 A 审批材料

| 项目 | 本次拟授权范围 |
| --- | --- |
| 目标 | 生产 Supabase `song`，Project Ref `vfgmptjfcfgptaqblydd`，区域 `ap-northeast-1`，项目状态 `ACTIVE_HEALTHY` |
| SQL | `20261112190304_add_distribution_publish_calendar.sql`，验收提交 `8de09e348349c148c79fad5694d89006b5673eb7` 中的 UTF-8 Git blob，25,929 字节，450 行 |
| 原始 SQL SHA-256 | `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396`，与 Staging 登记 `20261113062649` 存储 SQL 一致 |
| 通道 | 官方单条迁移 API `POST https://api.supabase.com/v1/projects/vfgmptjfcfgptaqblydd/database/migrations`，仅提交一次 `name = add_distribution_publish_calendar` 和原始 `query`，由平台登记迁移历史 |
| 影响 | 新增三张强制 RLS 表、六条 `ON DELETE RESTRICT` 外键、索引和唯一约束、私有 schema、审计写入角色及人工任务 RPC。现有四张被引用业务和 Storage 表会参与外键锁定 |
| 凭据 | 仅限生产 `song` 的短期 `Migrations (Read-write)` Scoped PAT，使用本机专用输入。监控沿用节点 1 已核验的生产 Direct TLS 连接 |

[完整原 SQL](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/migrations/20261112190304_add_distribution_publish_calendar.sql) · [单条迁移 API](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [官方 OpenAPI](https://api.supabase.com/api/v1-json)

### 执行前只读复核

2026-11-15 15:52（北京时间）生产八条迁移的名称、版本及存储 SHA-256 与基线一致，M3 的三张表、角色、schema、RPC 和媒体保护触发器尚未部署。目录与数据库角色权限满足当前 DDL 依赖，M1/M2 原有六张强制 RLS 表及两条 Storage RESTRICT 外键在位。M1、M2 只读 smoke 各通过五种身份。

节点 1 的数据库归档及复用 ZIP 的路径、大小、SHA-256 已从最终文件读回并核对。数据库归档 `pg_restore --list` 退出 `0`，617 个目录条目与回执一致。将归档中的 15 张表与生产逐表比对，行数及字段内容均一致，覆盖基础业务、M1/M2、Auth 和 Storage 元数据。生产两件现有图片的只读 HEAD 与清单长度、MIME 一致。继续使用节点 1 已验收的备份。

15:52:25 在 A 将引用的 `distribution_variants`、`distribution_posts`、`distribution_accounts` 和 `storage.objects` 上观测到 0 个冲突锁、0 个等待锁的其他客户端、0 个其他客户端事务。该结果为预检快照。实际提交前确认维护时段、暂停后台内容和媒体编辑，并立即复查相关锁和活动事务。

### 数据库端锁超时与中止机制

| 边界 | 已核实的行为 |
| --- | --- |
| 数据库默认值 | 在生产的管理 API 只读查询会话读到 `application_name = mgmt-api`、`session_user = postgres`、`lock_timeout = 0`（默认）、`statement_timeout = 120000ms`（配置文件）及 `transaction_timeout = 0`。相关数据库和角色没有目录级超时覆盖。生产 M2 实际迁移 DDL 的 `pg_stat_statements` 记录也归属 `postgres`。 |
| A 的实际写入会话 | 官方单条迁移 API 的请求体只定义 `query`、`name` 和可选 `rollback`，公开规范未提供会话级锁超时参数或迁移取消端点。A 的原 SQL 没有超时设置。如果写会话沿用观测到的默认值，锁等待受单条语句 120 秒上限约束，`lock_timeout = 0` 表示无单独锁等待上限。写会话的最终参数和 HTTP 断开后的取消行为无法从只读检查核实。 |
| HTTP 客户端 | `ConnectionTimeoutSeconds = 15`，`OperationTimeoutSeconds = 60`。后者限制响应读取停滞。超时只说明客户端停止等待，数据库事务状态以读回为准。 |
| 可用的数据库取消机制 | 生产 `postgres` 具备 `pg_stat_activity` 可见性及 `pg_cancel_backend(integer)` 所需权限。该函数给目标后端当前查询发送取消信号。信号返回成功后仍须确认原事务是否结束及是否提交。此次只读预检已验证候选查询正常，返回 0 个等待中的 A 会话。 |

[Supabase 超时文档](https://supabase.com/docs/guides/database/postgres/timeouts) · [PostgreSQL 超时参数](https://www.postgresql.org/docs/17/runtime-config-client.html) · [锁等待开始时间](https://www.postgresql.org/docs/17/view-pg-locks.html) · [数据库取消函数](https://www.postgresql.org/docs/17/functions-admin.html) · [PowerShell HTTP 超时](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-webrequest?view=powershell-7.6#-operationtimeoutseconds)

本次方案采用独立数据库监控的 **5 秒取消阈值**，由用户在 A 的正式授权中一并确认。提交前建立生产 Direct `verify-full` 监控连接，并以服务器时钟记录本次请求起点。每秒只读查看 `pg_stat_activity` 和 `pg_locks`，使用 `waitstart` 计算实际等待时间。匹配生产库、`postgres`、管理 API 应用标识、本次请求后的事务和 A 独有的 SQL 起始片段，以及四张被引用表上的未授予外键锁。持续等待满 5 秒时，只有唯一候选且同一 PID、后端启动时间、事务与查询开始时间及等待锁再次确认匹配，才对该查询调用一次 `pg_cancel_backend`。识别不充分时保留现场并只读核实。这个阈值约束监控处置，数据库自身的固定 5 秒上限仍无法由该 API 保证。

### 获批后的单次请求

原始 SQL 按 Git 字节封装为本机准备好的 `production-migration-a-request.json`。请求体 26,465 字节，SHA-256 为 `2693ae74be1e093a1e94400e8dcafb6922ce6377aa33a70aab5e94a28016cc11`。离线读回 JSON 的 `query` 已逐字节比对，保留原 SQL 及其 `BEGIN` / `COMMIT`。正式执行前重算两个哈希，先只读 GET 核对历史，再记录绑定 Ref、SQL SHA-256 和时间的本机一次性提交标记。拟执行请求如下。

```powershell
$request = 'D:\code\song\.worktrees\m3-production-plan\node_modules\.cache\songisle-m3-migration-a\production-migration-a-request.json'
$endpoint = 'https://api.supabase.com/v1/projects/vfgmptjfcfgptaqblydd/database/migrations'
$headers = @{ 'Idempotency-Key' = 'song-production-m3-a-c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396' }
$response = Invoke-WebRequest -Uri $endpoint -Method Post -Authentication Bearer -Token $migrationPat `
    -ContentType 'application/json; charset=utf-8' -InFile $request -Headers $headers `
    -ConnectionTimeoutSeconds 15 -OperationTimeoutSeconds 60 -MaximumRedirection 0 -MaximumRetryCount 0 -SkipHttpErrorCheck
```

A 的显式事务保护 DDL。若收到 `55P03`（取锁超时）、`57014`（语句取消）、连接中断或回执不明，先独立读回锁、活动事务、管理 API 及数据库历史、存储 SQL 和实际对象。八条历史且 A 对象缺失、事务已结束时，记录失败并暂停。九条历史、A 哈希及对象全匹配、事务已结束时进入验收。任一证据不一致或事务未结束时保持 `BLOCKED`，留存脱敏证据。HTTP 200 与取消信号分别需要同样的读回。已有备份用于恢复评估，回执异常时停在 A。
[PostgreSQL 错误状态码](https://www.postgresql.org/docs/17/errcodes-appendix.html) · [迁移历史](https://supabase.com/docs/reference/api/v1-list-migration-history)

验收要求生产新增且仅新增 A 一条记录，总数九条，历史与原 SQL 哈希匹配。核对三张空表、强制 RLS、六条已验证的 RESTRICT 外键、角色成员关系、Invoker RPC、Definer 所有者及授权、索引和约束。复核 M1/M2/M3 只读权限、既有业务与媒体基线及 Advisor。用户已批准这次 A 的一个 POST 及上述限定的查询取消动作。

## 节点 2 执行回执

2026-11-15 16:59:56–17:00:01（北京时间），依照审批提交 `0cdac3c7f8fd9404b5f58db061d9e9b752596036`，在生产 `song`（`vfgmptjfcfgptaqblydd`）单次提交迁移 A。官方 API 返回 HTTP 200，执行器退出 `0`。实际登记为 `20261115085958 / add_distribution_publish_calendar`。生产元数据和官方 API 分别读回九条记录，前八条与审批基线一致，A 的存储 SHA-256 为 `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396`，与原 SQL 完全一致。请求体 SHA-256 为 `2693ae74be1e093a1e94400e8dcafb6922ce6377aa33a70aab5e94a28016cc11`。

| 验收项 | 实际结果 |
| --- | --- |
| 备份及提交前复核 | PASS。重新核对节点 1 的归档及复用 ZIP 哈希，继续沿用。提交前的生产八条历史、15 张基础业务及 Auth、M1/M2、Storage 表的数据均与已审基线一致。 |
| 独立监控 | PASS。生产 Direct（TLS 1.3、`verify-full`）完成 3 次就绪检查。最后一次检查的冲突锁、其他事务及等待锁客户端均为 0。提交后采样 4 次，A 的匹配等待数为 0，取消阈值未触发。验收时 A 的活动事务为 0。 |
| 数据库对象 | PASS。三张表均为空且启用强制 RLS。生产和 Staging 的 A 对象定义一致，包括 10 条策略、6 条已验证的 RESTRICT 外键、20 条其他约束、12 个索引、6 个例程及写入角色权限。公开入口为 `SECURITY INVOKER`，私有写函数的 Definer 所有者为 `distribution_publish_writer`。B 函数和触发器均缺失。 |
| 生产只读权限 | PASS。M1/M2 原 smoke 各五种身份通过。M3 使用纯只读目录、五种身份的 ACL 与 RLS 谓词检查，以及私有表 SELECT。自动审查拒绝了原 M3 smoke，因为其中调用了生产写入 RPC，可能进入写逻辑或获取锁。该脚本的 RPC 调用未在生产发生，实际写入路径的验收证据来自 Staging。 |
| 既有业务与 Storage | PASS。生产验收再次对照归档，15 张表的行数与内容摘要一致。两件 PNG 的 HEAD 均为 200，类型、长度及对象清单匹配。现有公共、统计私有及 Storage 策略的指纹与预检一致。 |
| Security Advisor | PASS。与执行前一致，仅有既有的两条 `analytics_private` RLS INFO 和一条 Auth 泄露密码防护 WARN。 |

首次令牌的历史 GET 及复核均返回普通 403，生产历史保持八条，POST 次数为 0。更换仅限生产 `song` 的 Scoped PAT 后，历史核对通过，执行器记录了唯一一次迁移请求。本机安全窗口已关闭并释放凭据。用户确认已在 Supabase 控制台撤销本轮使用的两枚短期 Scoped PAT。

节点 2 状态为 `PASS`，用户已验收。

## 节点 3 迁移 B 审批材料

| 项目 | 本次拟授权范围 |
| --- | --- |
| 生产目标 | Supabase `song`，Project Ref `vfgmptjfcfgptaqblydd`，区域 `ap-northeast-1`，状态 `ACTIVE_HEALTHY` |
| 完整 SQL | `20261113170022_protect_distribution_publish_media.sql`，取自 M3 验收提交 `8de09e348349c148c79fad5694d89006b5673eb7` 的原始 Git blob，3,300 字节，63 行 |
| SQL SHA-256 | `28d22d496fb293bfaa731af6535a24e975ee146440f03de8eae3217a1adb25c9`，与 Staging 实际登记 `20261114053707` 的存储 SQL 一致 |
| 通道和凭据 | 官方单条迁移 API `POST https://api.supabase.com/v1/projects/vfgmptjfcfgptaqblydd/database/migrations`。仅限生产 `song`，使用短期 `Migrations (Read-write)` Scoped PAT 在本机隐藏交接 |
| 变更 | 新增 `distribution_publish_private.protect_task_media()` 和 `storage.objects` 的 `distribution_protect_task_media` 更新触发器，阻止历史引用对象的内容版本、路径或关键服务元数据被替换。DDL 之外包含既有快照路径的只读校验 |

[完整原 SQL](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/supabase/migrations/20261113170022_protect_distribution_publish_media.sql) · [官方单条迁移接口](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [Staging 验收回执](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-delivery.md#2026-11-14-完整-staging-复验)

### 执行前只读预检

| 检查 | 2026-11-16 预检结果（北京时间） |
| --- | --- |
| 迁移历史和 A | 00:58 核对九条迁移的版本、名称和存储 SQL SHA-256，前八条匹配生产基线。A `20261115085958` 唯一，SHA-256 为 `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396`。B 的历史、函数和触发器均缺失。 |
| M3 空表与外键 | `distribution_publish_tasks`、`distribution_publish_task_media`、`distribution_publish_logs` 各 0 行且强制 RLS。六条已验证的 RESTRICT 外键、素材反查索引有效。历史审计快照的路径与 UUID 校验发现 0 个不一致。 |
| Storage | 生产与 Staging 的 Storage API 均为 `1.94.2`，目录最新迁移均为 80，触发器涉及的列类型和空值约束一致。生产 `media.versioning_status = DISABLED`，两张现行 PNG 共 3,476,452 字节，归档和删除标记均为 0。两件对象 HEAD 均为 200，类型及长度匹配。现有五条对象策略以及两条 Storage 触发器均在位。 |
| 执行权限 | 生产管理 API 的只读会话角色为 `postgres`，现有 A 私有 schema 与公开 RPC 所有者均为 `postgres`。维护角色具有 `BYPASSRLS`、私有 schema 的 `USAGE` 和 `CREATE`、`storage.objects` 的 `TRIGGER`，以及桶、对象、任务素材关联和审计日志的查询权限。01:04 核对该角色还具有 `storage.objects` 的 `MAINTAIN`、`UPDATE`、`DELETE` 和 `TRUNCATE`，满足所需取锁权限。B 的事务内仍会检查实际写入角色。[PostgreSQL 取锁权限](https://www.postgresql.org/docs/17/sql-lock.html#SQL-LOCK-NOTES) |
| 启动窗口和锁 | 01:00:51，`storage.objects` 持有或排队的冲突锁均为 0，其他客户端事务及锁等待均为 0。此为只读快照。执行前确认维护时段，安排后台内容及媒体编辑暂停，并再次读取表、桶、活跃事务和锁。出现冲突或任何基线变化时暂停提交。 |
| 备份及既有业务 | 节点 1 数据库归档和复用的旧 Storage ZIP 大小、SHA-256 复核通过。`pg_restore --list` 退出 `0`，617 个目录条目与回执一致。生产 15 张业务、Auth 与 Storage 元数据表的行数和内容指纹均与归档对账一致，沿用节点 1 备份。现有策略指纹与 A 验收一致，Advisor 仍为两条既有 INFO、一条既有 WARN。 |

### 事务、执行与验收

B 保留原始 `BEGIN` / `COMMIT`、`SET LOCAL lock_timeout = '5s'` 和 `SET LOCAL row_security = off`。事务对整张 `storage.objects` 获取 `SHARE ROW EXCLUSIVE`，普通 SELECT 可继续，Storage 写入会被阻塞到事务结束。5 秒限制每次取锁等待，超时时 PostgreSQL 中止语句并使事务失败，持锁时长取决于实际校验和 DDL。HTTP 层另用 15 秒连接超时和 60 秒响应读取停滞超时。
[PostgreSQL 表锁](https://www.postgresql.org/docs/17/explicit-locking.html) · [PostgreSQL 锁超时](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-LOCK-TIMEOUT)

本机已生成 `production-migration-b-request.json`，UTF-8 JSON 3,420 字节，SHA-256 `c476d7e6e0f6345f020921a68b410ca3f9aaaddcad01677d8121a1c886ba396c`。读回 `query` 与原 Git blob 逐字节一致。获批后重算两份哈希，通过官方 API 读取九条历史及 A 的记录详情，确认版本和存储 SQL 哈希。提交前写入绑定项目、SQL 哈希及时间的一次性标记，执行如下请求一次。

```powershell
$request = 'D:\code\song\.worktrees\m3-production-plan\node_modules\.cache\songisle-m3-migration-b\production-migration-b-request.json'
$endpoint = 'https://api.supabase.com/v1/projects/vfgmptjfcfgptaqblydd/database/migrations'
$headers = @{ 'Idempotency-Key' = 'song-production-m3-b-28d22d496fb293bfaa731af6535a24e975ee146440f03de8eae3217a1adb25c9' }
$response = Invoke-WebRequest -Uri $endpoint -Method Post -Authentication Bearer -Token $migrationPat `
    -ContentType 'application/json; charset=utf-8' -InFile $request -Headers $headers `
    -ConnectionTimeoutSeconds 15 -OperationTimeoutSeconds 60 -MaximumRedirection 0 -MaximumRetryCount 0 -SkipHttpErrorCheck
```

出现 `55P03`、SQL 错误、HTTP 超时或回执不明时，先只读核对活动事务、锁、API 及数据库历史、B 函数与触发器。若事务已结束且仍为九条历史、B 对象缺失，记录失败并暂停。若新增唯一 B 记录且哈希与对象均匹配，继续验收。历史、对象与哈希不一致或结果仍未知时保留脱敏证据，停止后续步骤。这个处置保留已验收的 A 和迁移历史。

B 的验收要求十条记录，A/B 存储哈希匹配各自原件。确认触发器启用及绑定正确，函数 `SECURITY DEFINER`、所有者的 `BYPASSRLS`、空 `search_path`、`row_security=off` 和触发器限定授权均与 Staging 一致。Staging `pg_get_functiondef` 的 SHA-256 为 `db265431038d3420b1829c28a4ca46fb2a70626cf39d40beef6eb267f9c758b7`，用于读回对照。读回 M1/M2/M3 安全边界、业务指纹、两件媒体、`media` 桶和原 Storage 策略，复核 Advisor。生产验收使用目录与只读查询。覆盖、upsert、移动和字节保留的实测沿用 Staging。审批范围为这次 B 的单条 POST。

## 节点 3 执行回执

2026-11-16 02:17:58–02:18:00（北京时间），依照用户批准的提交 `6bb79065212847bb98a7171351c7915bb3b342bc`，在生产 Supabase `song`（`vfgmptjfcfgptaqblydd`）通过官方单条迁移 API 提交一次 B。HTTP 返回 200，平台登记为 `20261115181800 / protect_distribution_publish_media`。管理 API 和数据库目录分别读回十条历史，原九条逐项匹配，B 的存储 SQL 为一个 3,300 字节的语句条目，SHA-256 `28d22d496fb293bfaa731af6535a24e975ee146440f03de8eae3217a1adb25c9` 与批准的原始 Git blob 一致。请求体 SHA-256 `c476d7e6e0f6345f020921a68b410ca3f9aaaddcad01677d8121a1c886ba396c`。

| 验收项 | 实际结果 |
| --- | --- |
| 备份及执行前状态 | PASS。节点 1 的数据库归档及旧 Storage ZIP 大小、SHA-256 正确。`pg_restore --list` 退出 0，含 617 个目录条目。15 张表的行数与内容指纹和归档一致。管理 API 已复核九条基线及迁移 A 的存储哈希。 |
| Storage 锁及事务 | PASS。已暂停后台编辑和媒体上传。02:17:57 的数据库快照确认三张 M3 表为空、`media` 桶版本管理为 `DISABLED`、维护角色满足取锁及创建触发器所需权限。冲突锁、其他客户端事务及等待锁会话均为 0。原 SQL 的单事务及 5 秒取锁超时保留，单次请求标记已落盘。02:19:59 的验收快照见 B 活动事务和 Storage 冲突锁均为 0。 |
| 保护对象 | PASS。`distribution_protect_task_media` 已启用，逐行在 `storage.objects` 更新后调用预期私有函数。函数定义和 ACL 与 Staging 一致，所有者为具有 `BYPASSRLS` 的 `postgres`，采用 `SECURITY DEFINER`、空 `search_path` 和 `row_security=off`。`PUBLIC`、`anon`、`authenticated`、`service_role` 和 `distribution_publish_writer` 均无 `EXECUTE`。 |
| 既有数据库安全边界 | PASS。九张 M1/M2/M3 表的权限，以及相关约束、索引、策略、既有触发器、例程和审计写入角色授权的目录指纹与提交前一致。三张 M3 表仍为空且启用强制 RLS，六条 RESTRICT 外键均有效。六张 M1/M2 表的强制 RLS 通过复核，M1、M2、M3 各五种身份的只读检查均通过。M3 只读检查覆盖表权限、MFA 谓词和 RPC 定义及授权。 |
| 业务与媒体 | PASS。15 张基础业务、分发、Auth 及 Storage 元数据表与节点 1 归档继续一致。两个现有 PNG 的对象 UUID、路径和版本指纹一致，公开 Storage GET 均为 200，长度、MIME 和实际字节 SHA-256 均与已验收的 ZIP 一致。`media` 桶版本管理为 `DISABLED`，五条既有对象策略均在位。 |
| Security Advisor | PASS。仍为两条既有 `analytics_private` RLS INFO 及一条 Auth 泄露密码防护 WARN。 |
| 临时凭据 | PASS。用户已撤销本轮项目级 Scoped PAT。同一迁移历史 GET 返回 HTTP 401，本机窗口已释放凭据。 |

生产验收只读目录、业务表和既有媒体。覆盖、upsert、移动与被引用字节保留的写操作证据来自 Staging。已通知用户恢复后台编辑和媒体上传。

节点 3 状态为 `PASS`，用户已验收。

## 节点 4 联合发布审批材料

2026-11-16 02:40–02:51（北京时间）完成只读预检。送审范围是将 `Songbreezegit/song` 的 PR #13 转为 Ready，以 merge commit 合入下表中的 `main`，并由现有 Cloudflare Workers Builds 自动部署到 `songisle.xyz`。联合批准同时涵盖跟踪构建、上线后只读冒烟，以及新版本已切流且发生严重故障时的指定 Worker 回退。

| 核对项 | 结果 |
| --- | --- |
| GitHub 引用 | PR #13 为开放的 Draft，可以合并，Auto-merge 未启用。验收 HEAD 为 `8de09e348349c148c79fad5694d89006b5673eb7`，`main` 为 `e6e2f8ec481dbdc64fe5ae790aceaebab5523414`，后者是前者的祖先。仓库允许 merge commit，`main` 无生效的规则集或旧式分支保护。 |
| 预期合并树 | GitHub 试合并 `2af5dbdaa9b7177e61376a50cbfa365a3715caaf` 的两个父提交依次为上述 `main` 和验收 HEAD，树为 `44f2c4f3571b752eef135e29030a0d04a8705f4d`，与已验收的 M3 代码树逐字节一致。报告分支不进入此 PR。 |
| 构建检查 | 验收 HEAD 唯一 GitHub Check `Workers Builds: song` 为 `SUCCESS`，完成于 11-14 14:04:50。Cloudflare 构建 `355fd1af-7e9e-409e-88e9-1689097fc237` 为 Ready，使用 `npx wrangler versions upload`，候选预览 `e22fd790` 可读取。当前 `main` 的构建 `4cb54abc-d6e9-4834-96e2-2226723b352e` 同为成功。 |
| 自动部署 | Worker `song` 的 Production 连接 `Songbreezegit/song`，生产分支 `main`，根目录 `/`，Disable builds 关闭。监听 `*`，排除路径和 Deploy Hooks 均为空。合并产生的 `main` 更新将执行 `npm run build`，再执行 `npx wrangler deploy`。部署成功后，新版本承接正式域流量。非生产分支沿用版本上传配置。 |
| 生产 Supabase 绑定 | Cloudflare 生产构建的 `VITE_SUPABASE_URL` 为 `https://vfgmptjfcfgptaqblydd.supabase.co`。正式入口脚本、稳定版本预览及候选静态入口均读到该 URL。正式站公开客户端凭据向生产 `projects` 发出 GET 得到 200，M1/M2/M3 各一张私有业务表的匿名 GET 均返回 HTTP 401 / `42501`。候选预览只读取静态文件。 |
| 生产数据库 | `song`（`vfgmptjfcfgptaqblydd`）健康。02:40:29 的十条迁移历史逐项匹配节点 3 回执，A 为 `20261115085958`，B 为 `20261115181800`，存储 SQL 哈希一致。M3 三张表为空且强制 RLS，保护函数和触发器在位，`media` 桶版本管理为 `DISABLED`。沿用节点 1 备份。 |
| 当前稳定版本和回退目标 | Worker `493cb30a-b84e-4b5c-bd9f-6d19f49017b7` 承接 `songisle.xyz` 的 100% 流量。完整 UUID 在 Cloudflare 流量历史和当前 `main` 的正式构建日志中一致。正式域与该版本预览的首页及入口脚本均返回 200，`index-Cu-kXTQO.js` 的 SHA-256 均为 `df785cd10eebc5b447c416a7e85561770711ae36569f021d087321a6c161b4aa`。正式 `/en/work` 和 `/admin/login` 的 HTTP 入口均为 200。 |

[PR #13](https://github.com/Songbreezegit/song/pull/13) · [验收 HEAD 检查](https://github.com/Songbreezegit/song/commit/8de09e348349c148c79fad5694d89006b5673eb7/checks) · [当前正式构建](https://dash.cloudflare.com/6ec81bfad4c5f66bb3a8901caefd1ee1/workers/services/view/song/production/builds/4cb54abc-d6e9-4834-96e2-2226723b352e) · [稳定版本预览](https://493cb30a-song.dogfishgcordialf.workers.dev/) · [Cloudflare 自动构建触发规则](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)

候选构建日志记录 2 条 high、2 条 moderate 依赖告警。对 `main` 与验收锁文件分别运行 `npm audit`，两边告警条目完全一致。`--omit=dev` 的结果均为 `vite` 和 `source-map-js` 两条 high。`source-map-js` 由 PostCSS 与 Tailwind 构建依赖带入，`song` 的 Wrangler 配置服务 `dist` 静态文件。GitHub 构建检查和依赖审计结果分别记录。 [Vite 关联告警](https://github.com/advisories/GHSA-587h-7wmj-h5pm) · [source-map-js 告警](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)

完整 M3 本地测试、真实 Staging 复验与清理结果随验收提交归档。 [M3 交付回执](https://github.com/Songbreezegit/song/blob/8de09e348349c148c79fad5694d89006b5673eb7/docs/admin-distribution-m3-delivery.md)

### 获批后的操作和验收

1. 在转 Ready 前复核 PR HEAD、`main`、检查、合并树、生产 Supabase 历史和 Cloudflare 的自动部署设置、当前版本及回退目标。任一关键条件变化时暂停。Ready 后再读回引用和检查，使用 `gh pr merge 13 --repo Songbreezegit/song --merge --match-head-commit 8de09e348349c148c79fad5694d89006b5673eb7` 提交 merge commit。
2. 读回实际 `main` SHA、两个父提交和代码树。跟踪该 SHA 对应的 Cloudflare 生产 Build ID，直至构建与部署状态明确。成功后核对新 Worker 的完整 UUID、100% 正式流量、正式域和读取到的生产 Supabase URL。构建或部署失败时，停住并核对实际承接流量的版本，记录失败回执。
3. 只读冒烟覆盖首页、公开项目与既有素材、后台登录入口、匿名后台重定向及分发 API 拒绝。现有管理员完成 TOTP 后，在其会话内核对 M1 内容分发、M2 平台稿、M3 `/admin/distribution/calendar` 与 `/admin/distribution/history` 可读取并正常导航，核对空态或现有数据。记录正式时点的结果。
4. 若新版本已切流且出现正式站不可用、鉴权越界、错误 Supabase 绑定或核心后台不可用，按联合授权进入 Cloudflare 的 `song` → Deployments，在稳定版本 `493cb30a-b84e-4b5c-bd9f-6d19f49017b7` 的菜单选择 Rollback，恢复该版本的 100% 流量。复核 Active deployment、正式域入口脚本、公开页面和后台权限。回退范围为 Worker 流量，生产 M3 的 A、B 迁移保留。 [Cloudflare 回退流程](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/#via-the-cloudflare-dashboard)

节点 4 的联合发布及条件回退已获用户明确批准。

## 节点 4 正式发布回执

2026-11-16 12:03:35（北京时间），按用户批准的方案提交 `b34324b576d56b4c22d4b5a942675a63d89b4e05` 执行联合发布。PR #13 转 Ready 后以 merge commit 合入 `main`，合并 SHA 为 `d86dbd8eee09c31b808dbc489d34726c4f198a57`。两个父提交依次为 `e6e2f8ec481dbdc64fe5ae790aceaebab5523414` 和 `8de09e348349c148c79fad5694d89006b5673eb7`，合并树 `44f2c4f3571b752eef135e29030a0d04a8705f4d` 与验收树一致。 [合并回执](https://github.com/Songbreezegit/song/pull/13) · [正式 main 提交](https://github.com/Songbreezegit/song/commit/d86dbd8eee09c31b808dbc489d34726c4f198a57)

Cloudflare 自动构建 `b4b83acb-cf24-4dd5-9906-a8751da54a20` 由该 `main` 提交触发，构建用时 56 秒，12:04:35 的 GitHub 检查为 `SUCCESS`。构建日志确认 `npx wrangler deploy` 成功，Active deployment 显示 Worker `0d80345e-1720-416e-8f6f-c27d186c219f` 承接 `songisle.xyz` 的 100% 流量。 [Cloudflare 正式构建](https://dash.cloudflare.com/6ec81bfad4c5f66bb3a8901caefd1ee1/workers/services/view/song/production/builds/b4b83acb-cf24-4dd5-9906-a8751da54a20) · [GitHub 检查](https://github.com/Songbreezegit/song/commit/d86dbd8eee09c31b808dbc489d34726c4f198a57/checks)

| 正式验收项 | 结果 |
| --- | --- |
| 正式域和公开数据 | PASS。首页、公开项目列表与礼账详情入口、后台登录入口的 HTTP 请求均为 200。公开 `projects` 查询读到一条项目记录，M3 的三份路由脚本均返回 HTTP 200 与 JavaScript 类型。 |
| 产物与 Supabase | PASS。正式域及新 Worker 版本预览均提供 `index-D13p-8zH.js`，SHA-256 为 `d973cf08401e294d35f514423e0acb224f9c451263a0ff71bd40d42091ef2743`，与验收预览一致。编译产物及公开客户端请求均指向生产 `song`（`vfgmptjfcfgptaqblydd`）。两件现有 PNG 均为 200，文件字节 SHA-256 与节点 1 的既有 ZIP 一致。 |
| 匿名权限 | PASS。Chrome 实测内容库、发布日历和发布历史均跳转到 `/admin/login`。用新正式产物的公开客户端凭据对 M1 账号、M2 平台稿、M3 任务与发布日志执行匿名读取，均返回 HTTP 401 / `42501`。 |
| 管理员 MFA | PASS。2026-11-16 21:36（北京时间），现有管理员在正式站完成 TOTP。Chrome 的授权会话进入后台并成功从后台导航打开内容分发概览。 |
| M1 内容分发 | PASS。概览正常加载，矩阵账号列表显示 1 个账号，内容库显示 1 条内容。打开现有内容源并读取平台版本入口。 |
| M2 平台版本 | PASS。现有内容源的平台版本页面读取到 1 个当前目标，显示「尚未生成平台稿」，历史平台稿为空。 |
| M3 发布管理 | PASS。发布日历的月视图和周视图分别渲染 42 个和 7 个日期格，切换任务列表后正常显示空态。发布历史页面正常打开并显示空态，验收页未显示加载错误。 |
| 数据库 | PASS。生产十条迁移的版本、名称和 SQL 哈希与节点 3 验收一致。三张 M3 表仍为空且强制 RLS。历史媒体保护函数和触发器在位，`media` 版本管理为 `DISABLED`。继续沿用节点 1 的归档。 |

公开页面采用 HTTP 与公开数据、素材的只读检查，后台采用完成 TOTP 的 Chrome 会话。上述记录数与页面状态为各验收时点的快照。

节点 4 正式发布及只读验收为 PASS。上线后的检查未触发严重故障回退条件，生产迁移保留。
