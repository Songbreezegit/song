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

内容源、平台稿、账号和 Storage 对象均由 RESTRICT 外键保护。计划更新保留历史快照的素材外键，取消任务也保留历史。账号归档或移除目标后既有快照可读。新建任务和采用新版均需可用账号、有效目标、当前就绪稿件和准确版本。Storage 原有公开桶策略保持不变。快照保留对象 UUID、原始路径和处理说明，沿用现有媒体服务；历史证据依赖对象保留以及当前库的禁止覆盖上传约定。

SQL 使用一个显式事务。执行前核对目标、原始文件 SHA-256、迁移顺序和目标对象。若调用超时，先只读检查历史和目录对象，再决定后续动作。迁移执行角色需能创建角色、授予 authenticated 的角色继承关系并转移私有函数所有权，Staging 已只读核对具备这些条件。

[回滚草案](../supabase/rollbacks/distribution_m3.sql) 在禁止 RLS 隐式过滤的会话中锁定三张 M3 表，仅在任务、素材与日志均为空时移除 M3 对象。已有历史时使用经审查的向前修复，并保留历史及素材。回滚不修改原有迁移登记。

[只读安全 smoke](../supabase/tests/distribution_m3_security_smoke.sql) 检查目录、角色、授权、外键和五种合成 JWT 条件。[回滚探针](../supabase/tests/distribution_m3_atomic_rollback.sql) 在 Staging 测试事务中对单个请求注入审计失败，核对任务和日志不变，最后回滚探针。两者均在隔离 PostgreSQL 运行；GoTrue、PostgREST、Storage 需按下述流程另行实测。

## Staging 执行步骤

1. 固定 Supabase 项目 song-staging（uartrtcmskyuqxawjqlx），核对 M1/M2 八条迁移、M2 哈希、强制 RLS 和 Security Advisor。读回确认 M3 对象及记录均未存在后，展示完整 SQL 和哈希并取得独立写入批准。
2. 用单条迁移通道提交原始 SQL。回执需核对远端实际登记版本、存储 SQL、角色、三张表、六个 RESTRICT 外键、索引、约束、策略、函数 owner 和 EXECUTE。执行后对照 Security Advisor 基线。
3. 使用仅限该项目的短期 Scoped PAT，授予 Project Settings Read 和 API Keys Read/Write。将凭据从本机隐藏提示交给进程。设置 DISTRIBUTION_STAGING_PROJECT_REF、DISTRIBUTION_STAGING_API_URL 和 DISTRIBUTION_STAGING_MANAGEMENT_TOKEN，再运行 node scripts/verify-distribution-m3-staging.mjs。脚本核验项目身份后进入 migration-verified 检查点。
4. 到 admins-registered 检查点后，通过 Staging 管理连接核对三个 Auth UUID、临时邮箱和 app_metadata 中的运行标记。Staging 无既有管理员时，先登记本轮第一位管理员并执行要求唯一管理员的 M1 只读 SQL smoke，再登记第二位并执行 M2/M3 smoke。普通测试账号保持非管理员。核验两位临时管理员后让 runner 继续。
5. Runner 使用真实 GoTrue 登录和 TOTP，执行 REST 负向、并发、重放、快照、人工报告、Storage 和真实 Edge 检查。在 atomic-probe 检查点填入本次运行标记、任务 UUID、操作者 UUID 和版本，执行回滚探针并读回确认临时触发器已经清理。
6. 到 database-clean 检查点，在同一 Staging 管理连接审查并执行 runner 生成的单事务清理。脚本先验证两名 Auth 操作者、精确源/账号/稿件 UUID、账号和稿件的 run 标记、每个任务的创建事件及所有请求 UUID，发现外来引用即中止。依次清理日志、任务素材、任务、源及账号。实际文件经 Storage API 删除，校验路径、UUID、字节及删除后 404。
7. Runner 按 run 标记和 UUID 清理 Auth 用户、临时 Secret API Key，并读回验证。另行只读核对 MFA 因子、会话、管理员登记、分发数据和 Storage 的本轮行数。确认后撤销 Scoped PAT，核对凭据失效并清理本机交接副本。

官方参考覆盖 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Data API 权限](https://supabase.com/docs/guides/api/securing-your-api)、[PostgreSQL 函数执行权限](https://www.postgresql.org/docs/17/sql-createfunction.html) 和 [PostgREST 自定义错误码](https://docs.postgrest.org/en/v16/references/errors.html)。
