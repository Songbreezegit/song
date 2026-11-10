# 内容分发 M2 安全与 Staging 验收

## 数据库授权与一致性

M2 迁移新增两张表，既有 M1 四张表、RPC、RLS、Auth 和 Storage 策略沿用当前定义。[迁移 SQL](../supabase/migrations/20261110100401_add_distribution_platform_variants.sql)

| 范围 | 控制 |
| --- | --- |
| 两张表 | `ENABLE` 和 `FORCE ROW LEVEL SECURITY`。permissive 策略检查 `admin_users`，restrictive 策略同时检查管理员资格和 JWT `aal2`。`USING`、`WITH CHECK` 都生效。 |
| 三个公开 RPC | `create_distribution_variant`、`save_distribution_variant`、`sync_distribution_variant` 使用 `SECURITY INVOKER` 和空 `search_path`。仅向 `authenticated` 开放客户端执行权限，函数再次检查管理员资格和 MFA。 |
| 账号和源 | 目标必须已选择、未归档且启用。写入时锁定源、账号与关系。初次生成在事务中写快照，账号平台快照和稿件身份不可更改。源删除级联至平台稿，普通客户端无单独删除稿件的权限。 |
| 并发 | 唯一键及可重试 UUID 阻止重复生成。保存和同步先锁定目标稿件并比较版本，过期请求返回 `PT409`。媒体与文案共用事务，一次事务内的关联编辑只递增一次稿件版本。 |
| 媒体 | 外键指向 `storage.objects.id`，删除策略为 `RESTRICT`。触发器验证 `media` 桶、稳定媒体身份与图片封面。序号及封面唯一，最终聚合态通过延迟约束检查待发布条件。 |

平台稿预览按纯文本渲染，引用媒体使用原有存储服务和安全 URL 处理。JSON 导出白名单只包含业务字段、版本、原始素材引用、封面和处理说明。前端使用发布密钥及普通用户会话，临时管理凭据限定在验收进程。

## 真实 Staging 验收步骤

1. 确认项目为 `song-staging`，Ref 为 `uartrtcmskyuqxawjqlx`。读取迁移记录和 M1 RPC，确认 `add_private_distribution_m1`、`report_distribution_version_conflicts` 已生效，源保存使用 `PT409`。确认 M2 尚未应用或核对已应用 SQL。
2. 在确认卡片中核对项目和完整 SQL，再应用 M2。Git 中 LF 文件的 SHA-256 为 `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174`。以实际远程历史为准记录版本与 SQL 哈希，避免重复应用。
3. 使用仅限该项目的 Scoped PAT，范围为 Project Settings Read 和 API Keys Read/Write。将令牌通过本机安全输入传给执行进程，运行后清除进程变量与加密交接副本。脚本读取 `DISTRIBUTION_STAGING_PROJECT_REF`、`DISTRIBUTION_STAGING_API_URL` 和 `DISTRIBUTION_STAGING_MANAGEMENT_TOKEN`，拒绝非目标 Ref 和非规范 HTTPS 地址。
4. 从仓库根目录运行 `node scripts/verify-distribution-m2-staging.mjs`。在 `admin-registered` 检查点，用 Staging 管理连接核对输出的管理员 UUID、邮箱和 `auth.users.raw_app_meta_data.distribution_staging_run_id`，只把该用户加入 `admin_users`。确认普通测试用户无登记后输入 `admin-registered`。
5. Runner 验证临时管理员和普通用户的真实 GoTrue 密码登录与 TOTP，随后检查 anon、普通用户 aal2、管理员 aal1 的 REST 与 RPC 边界，以及管理员 aal2 的生成、保存、同步、409 和事务回滚。真实 Storage 测试核对只被平台稿引用的媒体无法删除、字节保持一致，解除引用后才可删除。
6. 浏览器冒烟通过独立 Vite 监听 `127.0.0.1:5199`，只允许该地址和已确认的 Staging API。登录使用本轮临时账号，验证从页面生成、编辑、刷新与导出。禁止用可能带生产环境变量的分支预览进行写入测试。
7. 在 `database-clean` 检查点，核对同一项目、run UUID、每个账号 UUID、名字和 `notes` 运行标记。确认本轮源、目标、平台稿和素材关联已清除，再删除这批账号。输入 `database-clean` 后脚本复查账号，退出阶段按 UUID、邮箱和运行标记删除 Auth 账号，并按 UUID、名称和描述撤销临时 Secret API Key。
8. 独立复核 run UUID 对应的 Auth、MFA、管理员、分发数据、Storage 和临时密钥都已清理。若发生强制中断，以脱敏 manifest 为定位依据，逐项查证归属，使用 Storage API 清理文件。保留非本轮资源。记录实际服务版本、失败与受阻项。

[只读 SQL smoke](../supabase/tests/distribution_m2_security_smoke.sql) 在只读事务中检查 RLS、RPC ACL、Storage 外键和五种 JWT 条件。它使用 SQL 会话中的合成 claims，真实 GoTrue 和 PostgREST 验证另行记录。

## 回滚审查

[回滚草案](../supabase/rollbacks/distribution_m2.sql) 供审查与隔离环境试跑。草案先锁定两张 M2 表，以能读取完整数据的角色确认均为空后才删除 M2 对象。若行级策略会过滤查询，检查直接失败。有平台稿时应先保留业务数据并制定经批准的向前修复方案。应用迁移或回滚前核对环境、备份及历史记录。
