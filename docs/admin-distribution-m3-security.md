# M3 数据库与安全审查

## 对象与权限

迁移 20261112190304 只增加发布任务、任务素材和发布日志三张表，一个私有 schema、一个数据库角色和发布任务 RPC。M1/M2 迁移、策略、函数签名和 Storage 策略沿用已有定义。

| 调用身份 | SELECT 任务、素材、事件 | 直接 INSERT、UPDATE、DELETE | 执行公开任务 RPC |
| --- | --- | --- | --- |
| 匿名 | 拒绝 | 拒绝 | 拒绝 |
| 普通用户 aal2 | RLS 返回空 | 拒绝 | 42501 |
| 管理员 aal1 或缺少 aal | RLS 返回空 | 拒绝 | 42501 |
| 管理员 aal2 | 允许 | 拒绝 | 校验动作、版本和输入后允许 |

三张表启用并强制 RLS。读取策略检查 admin_users，restrictive 策略同时检查成员资格与 JWT aal2。authenticated 仅有 SELECT 和公开 RPC 的 EXECUTE。任务、素材和审计表撤回 anon、PUBLIC 和 service_role 的显式业务权限。数据库管理员仍负责受控维护、恢复和审查。

公开 RPC change_distribution_publish_task(uuid,text,uuid,integer,jsonb) 使用 SECURITY INVOKER 和空 search_path。SQL 标准函数体按 OID 绑定私有 writer。客户端无法按名称访问 distribution_publish_private，PostgREST 的 exposed schemas 保持原配置。为了从 Invoker 调用已绑定的函数，仅向 authenticated 授予该私有入口的 EXECUTE，撤回其余辅助函数的客户端权限。

私有 writer 使用 SECURITY DEFINER，由 NOLOGIN、NOBYPASSRLS 的 distribution_publish_writer 所有。角色继承 authenticated 的现有权限与 RLS 身份，authenticated、authenticator 和匿名角色均不能切换为 writer。writer 额外获得 M3 三张表的 INSERT 和任务指定列的 UPDATE。日志没有 UPDATE、DELETE 或 TRUNCATE 权限。writer 在私有 schema 的 CREATE 权限仅用于迁移期间转移函数所有权，随后撤回。公开和私有入口均固定 search_path；私有入口先用真实 auth.uid()、JWT aal2 和成员资格授权，再处理读取、锁与重放。

RPC 只接收操作、目标 UUID、预期版本、请求 UUID 和固定形状的业务字段。操作者、事件类型、前后状态、任务快照和时间戳由数据库生成。IANA 时区以 pg_catalog.pg_timezone_names 校验，避免同名临时表影响判定。报告包含账号和稿件版本复核、实际时间、作品链接或备注及 manual_user_report 证据。纠正保留首次报告人、首次报告时间和原始事件，追加含理由及前后值的新事件。所有外部链接只在人工点击时打开。

## 并发、外键和回滚

按请求 UUID 持有事务 advisory lock。唯一索引登记成功请求，同一操作者重复提交相同参数返回已记录的原结果，复用 UUID 提交其他参数返回 PT409。更新取得任务行锁后对比版本，旧版本返回 PT409。捕获快照沿用 M2 的源、账号与目标锁顺序，再锁平台稿和关联对象。事务同时写入任务、素材引用和事件。失败时 PostgreSQL 回滚整个请求。

内容源、平台稿、账号和 Storage 对象均由 RESTRICT 外键保护。计划更新保留历史快照的素材外键，取消任务也保留历史。账号归档或移除目标后既有快照可读。新建任务和采用新版均需可用账号、有效目标、当前就绪稿件和准确版本。快照保留对象 UUID、原始路径和处理说明，沿用现有媒体服务。

SQL 使用一个显式事务。执行前核对目标、原始文件 SHA-256、迁移顺序和目标对象。若调用超时，先只读检查历史和目录对象，再决定后续动作。迁移执行角色需能创建角色、授予 authenticated 的角色继承关系并转移私有函数所有权，Staging 已只读核对具备这些条件。

[回滚草案](../supabase/rollbacks/distribution_m3.sql) 在禁止 RLS 隐式过滤的会话中锁定三张 M3 表，仅在任务、素材与日志均为空时移除 M3 对象。已有历史时使用经审查的向前修复，并保留历史及素材。回滚不修改原有迁移登记。

[只读安全 smoke](../supabase/tests/distribution_m3_security_smoke.sql) 检查目录、角色、授权、外键和五种合成 JWT 条件。[回滚探针](../supabase/tests/distribution_m3_atomic_rollback.sql) 在 Staging 测试事务中对单个请求注入审计失败，核对任务和日志不变，最后回滚探针。两者均在隔离 PostgreSQL 运行；GoTrue、PostgREST、Storage 需按下述流程另行实测。

## 历史素材不可变保护

UUID 外键能阻止删除。Storage v1.94.2 的覆盖写入会分配新对象版本，非版本化桶的移动会更新路径，两者都能更新原 UUID 对应的行。增量迁移在 `storage.objects` 加一条更新触发器，只在原 UUID 有任务素材引用时拒绝改动对象身份、桶、路径、存储版本、服务元数据或版本归档状态。访问时间和 `user_metadata` 仍可变更。触发器无 API 执行授权，私有函数通过索引查询任务素材表，在 Storage 内部写入阶段也检查引用。Storage RLS、MFA、公开读取和既有删除外键沿用原定义。[Storage v1.94.2 上传实现](https://github.com/supabase/storage/blob/v1.94.2/src/storage/uploader.ts) · [Storage v1.94.2 移动实现](https://github.com/supabase/storage/blob/v1.94.2/src/storage/object.ts)

任务取快照时持有对象的 `FOR SHARE` 锁，写入历史关联后才释放。Storage 更新如果因此等待，PostgreSQL 在默认 READ COMMITTED 下用触发器的 VOLATILE 查询读取新提交的关联。反向顺序由任务快照锁读取最新对象。数据库迁移在同一事务内锁住 Storage 写入，拒绝在版本管理已启用或已知历史路径偏离时安装。既有数据的字节历史没有校验值，迁移无法还原先前已被覆盖的字节。[PostgreSQL 行锁](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS) · [函数可见性](https://www.postgresql.org/docs/17/xfunc-volatility.html)

增量只创建私有函数和托管表支持的触发器，执行时可能短暂阻塞上传和移动，锁等待上限为 5 秒。SQL 报错或回执不明时先读回历史、触发器和函数。回滚草案仅用于空 M3，先解除触发器再移除 M3 对象。有任务或日志时保留保护并审查向前修复。以后调整桶版本管理或升级 Storage 时复跑真实覆盖与移动测试。[完整增量 SQL](../supabase/migrations/20261113170022_protect_distribution_publish_media.sql) · [Supabase 托管表触发器说明](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025)

## Staging 执行步骤

1. 固定 `song-staging`（`uartrtcmskyuqxawjqlx`）。已应用原始 M3 时核对登记 `20261113062649` 及存储哈希。修复前通过另行批准的 `--baseline-storage` 实测管理员 aal2 能否覆盖或移动本轮夹具。
2. 独立批准完整增量 SQL 和 SHA-256 后，执行 `node scripts/apply-distribution-m3-staging.mjs --execute-approved-media-guard <commit> <sha256>`。脚本核对八条 M1/M2 和原始 M3 迁移，记录单次提交，再读回 Supabase 分配的新版本及存储哈希。另核对触发器、函数权限、Storage 策略和 Security Advisor。[官方单条迁移 API](https://supabase.com/docs/reference/api/v1-apply-a-migration)
3. 完整测试经独立批准后运行 `node scripts/verify-distribution-m3-staging.mjs --acceptance <sha256>`。进程使用 `DISTRIBUTION_STAGING_PROJECT_REF`、`DISTRIBUTION_STAGING_API_URL` 和 `DISTRIBUTION_STAGING_MANAGEMENT_TOKEN`。PAT 仅限本项目，使用 Project Settings (Read)、API Keys (Read-write) 和 Database (Read-write)。迁移通道另需 Migrations (Read-write)。令牌通过本机隐藏输入，仅传给执行进程。
4. Runner 读回原迁移、增量哈希和触发器权限后创建临时用户。通过官方 SQL 接口按本轮三个 Auth UUID 和受保护的 run_id 注册管理员，保留 M1 只读 smoke 所需的单管理员顺序，再执行 M2/M3 smoke。随后使用真实 GoTrue TOTP、PostgREST、Storage 和 Edge，覆盖权限、并发、重放、回滚、人工报告、快照及真实覆盖与移动。
5. Runner 先读回数据，再按 run_id、账号/源/稿件 UUID、两位 Auth 操作者、日志请求和素材 UUID 清单执行一次清理事务。写入响应丢失或超时后只读核对。行已不存在时保留确认来源，行仍在或无法核验时输出 FAIL 和脱敏清单。重复运行清理时，已清零范围直接结束。
6. 引用清零后通过 Storage API 删除本轮图片。核对路径、所有者、UUID 和字节，再核对列表、`storage.objects` 和公开 GET。兼容新版 HTTP 404 及旧版 HTTP 400 加 `NoSuchKey`。Auth 用户和临时密钥在失败路径也执行清理，最终查询用户、因子、会话、身份和管理员登记。撤销短期 PAT 后校验失效并清理本机加密交接。[SQL 接口](https://supabase.com/docs/reference/api/v1-run-a-query) · [Storage 错误码](https://supabase.com/docs/guides/storage/debugging/error-codes)

### 清理检查点超时

Runner 保存原始退出码。若只读核验仍显示残留，使用本机脱敏清单核对原 Auth 标记及当前对象。若临时 Auth 已清除，在 `song-staging` 核对任务 UUID、创建事件和请求 UUID、账号/源/稿件标记、Storage UUID 及引用后，再审查同范围的恢复事务。范围不一致时保留数据和清单以供复核。

数据库读回确认引用清零后，按本轮路径、UUID 和原始字节通过 Storage API 删除文件，再核对目录、公开 GET 及 `storage.objects`。单独撤销清理使用的临时密钥。[增量复验回执](admin-distribution-m3-delivery.md#2026-11-14-完整-staging-复验) · [早期清理恢复记录](admin-distribution-m3-delivery.md#执行与清理记录)

官方参考覆盖 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Data API 权限](https://supabase.com/docs/guides/api/securing-your-api)、[PostgreSQL 函数执行权限](https://www.postgresql.org/docs/17/sql-createfunction.html) 和 [PostgREST 自定义错误码](https://docs.postgrest.org/en/v16/references/errors.html)。
