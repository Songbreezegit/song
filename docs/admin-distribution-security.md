# 内容分发 M1：SQL 与权限审查

提交供审查的文件：

- 正向迁移：`supabase/migrations/20261108173132_add_private_distribution_m1.sql`
- 回滚方案：`supabase/rollbacks/distribution_m1.sql`
- 迁移后只读检查：`supabase/tests/distribution_security_smoke.sql`
- 实际 PostgreSQL 验证：`tests/distribution-rls.test.ts`

迁移文件由 Supabase CLI `migration new add_private_distribution_m1` 生成，文件时间使用 UTC。本次只在本地 PGlite 执行 SQL，未连接生产数据库，也没有应用远程迁移。以下是代码审查结论，不表示线上验收已完成。

## 授权矩阵

| 请求上下文 | 私有分发读取 | 创建 / 更新 | 删除 |
| --- | --- | --- | --- |
| `anon` | 无表授权 | 无表授权 | 无表授权 |
| 普通用户，即使 JWT aal2 | RLS 返回零行 | 拒绝或影响零行 | 拒绝或影响零行 |
| 现有管理员，aal1 / 缺少 aal | RLS 返回零行 | 拒绝或影响零行 | 拒绝或影响零行 |
| `admin_users` 成员且 JWT aal2 | 允许 | 允许，受字段/关联约束 | 账号只归档；内容仅草稿可删除；关联表可管理 |

每张新增表同时具有 permissive 成员资格策略和 restrictive `ALL` 策略。后者在 `USING` 与 `WITH CHECK` 中均要求：

```sql
(select auth.jwt()->>'aal') = 'aal2'
and exists (
  select 1 from public.admin_users where user_id = (select auth.uid())
)
```

授权实时查询既有管理员表，不依赖可被用户修改的 user_metadata。管理员资格撤销后，即使旧 aal2 JWT 尚未过期，也不能继续访问。API JWT 验签由现有 Supabase 服务执行；本地 SQL 测试的请求声明用于验证数据库策略，不替代 GoTrue 验签测试。数据库所有者、Superuser 或可信 service role 仍属于特权运维边界。

未修改原认证流程、admin_users 的访问权限，或项目、文章、设置、媒体的任何策略。策略测试比较迁移前后的所有既有策略完整定义；回滚后再次比较。

## 写入与输入边界

- 账号只包含公开资料和业务配置。service 严格拒绝未知字段，不能通过表单 payload 混入 password、cookies、access_token 或服务端元数据。
- URL 复用现有 HTTP(S) 安全解析，拒绝内嵌凭据、脚本/数据协议、协议相对地址、控制字符、反斜杠；数据库另有 scheme、authority、长度与控制字符约束。URL 不触发服务器抓取。
- 标题 200 字、账号名称 100 字、正文 100000 字、标签最多 20 个且每个 50 字、备注 5000 字、定位 1000 字。数据库约束/触发器再次验证枚举、长度、标签及关联，RPC 拒绝未知字段、非字符串标签、重复/null 关联及超大 payload。
- UUID 为结构化参数，项目 FK 使用现有 text id。SQL 和 PostgREST 不拼接表单值为可执行 SQL。React 按文本显示用户内容，链接和缩略图使用既有安全 URL 函数。
- 版本及时间戳由触发器维护。UPDATE 使用预期版本，失配不会写入。一次编辑提交锁覆盖整个操作，创建重试保留 UUID，唯一键防止响应丢失后的重复创建。
- `distribution_private.touch_record()` 在首次归档时写入数据库时间并自动停用账号。已归档行的普通 UPDATE 返回 `55000`，包括清空归档时间、重新启用和修改资料。项目删除时，外键动作仍可清空 `project_id`，触发器仅放行嵌套更新且项目已删除、其他字段值一致的情况。稿件已有目标关联继续保留。
- `save_distribution_post` 是 **SECURITY INVOKER**，固定空 search_path，所有对象带 schema。它在入口明确验证成员资格与 aal2，并继续受所有表的 RLS 约束。
- public RPC 默认 EXECUTE 已从 PUBLIC/anon 撤销，仅授予 authenticated。私有触发函数不向客户端授予 EXECUTE。未新增 SECURITY DEFINER、开放视图、匿名 RPC、服务密钥、外部平台请求或任务队列。
- 素材引用有 FK 和桶检查，账号引用有启用/归档检查；关联失败回滚整个保存。删除草稿级联清理它的关联，不删除项目、账号或实际文件。

## 媒体行为与兼容性

保留 `media` 桶的公开属性、上传格式/大小及既有 RLS。M1 选择的是已有图片，视频内容类型仅先整理文案和已有封面，没有扩展上传格式。

`mediaService.deleteMedia` 调用 `storage.from('media').remove([path])`。在审查的上游实现中，批量端点先在数据库事务内检查权限并执行对象元数据删除，事务成功后才清理对象文件。按该实现推断，`distribution_post_media.media_id` 对 `storage.objects.id` 的 `ON DELETE RESTRICT` 应使受引用对象的删除在文件清理前失败。[批量路由](https://github.com/supabase/storage/blob/6bb2e4c360767bef715955e2ba25dfc45c0f0af7/src/http/routes/object/deleteObjects.ts) · [事务与清理顺序](https://github.com/supabase/storage/blob/6bb2e4c360767bef715955e2ba25dfc45c0f0af7/src/storage/object.ts#L633-L650)

当前环境已验证 PostgreSQL 外键和 RLS。真实 Storage 删除、对象字节、部署版本兼容性和 PostgREST 嵌套关系仍待验收。隔离步骤覆盖受引用删除失败、解除引用后删除成功、数据库元数据与文件字节一致，以及使用真实 aal2 会话的绕过测试。[隔离验收步骤](admin-distribution-storage-acceptance.md)

[官方 Storage schema 说明](https://supabase.com/docs/guides/storage/schema/design) 要求通过 API 操作对象，并提示托管 schema 的维护风险；[托管表引用说明](https://supabase.com/docs/guides/auth/managing-user-data) 建议只引用主键。本次只引用对象 id，未按 bucket/path 新建托管唯一约束。

## 迁移审查与启用顺序

1. 审查本次独立 SQL、权限矩阵、PostgreSQL 测试和回滚文件，核对生产表/策略与基线迁移是否一致。若有漂移先审查差异。
2. 在隔离的兼容 Supabase 环境应用本次单个迁移，检查实际 GoTrue aal2、PostgREST 关联查询/RPC、Storage 删除行为和安全顾问。
3. 备份分发 schema/数据和相关媒体清单，确定恢复路径。首次安装没有分发业务数据，但仍需核对原表/策略快照。
4. **由所有者明确批准生产迁移后**再执行已审查的单个 SQL，并记录实际迁移版本。不要直接对当前项目执行整个历史 `db push`：仓库安全文档已记录线上历史迁移版本号差异。
5. 执行只读 smoke（五种身份上下文、真实 restrictive 表达式、权限及 RLS 标志）；它只查询，既不创建账号，也不插入测试业务记录。
6. 所有者使用真实管理员 MFA 和批准的验收数据完成 CRUD、媒体关联及权限核验，再按单独批准的发布安排部署前端。

本次没有获得或请求生产变更批准，以上步骤仍待用户安排。生产写入式探针与真实登录不属于本次已执行验证。

## 幂等与回滚

正向 SQL 包含事务、`CREATE TABLE/INDEX IF NOT EXISTS`、`CREATE OR REPLACE FUNCTION` 及只删除/重建本模块策略和触发器。重复执行保留数据和原有策略。回滚测试先创建引用媒体的稿件，确认回滚仅删除分发对象，保留原策略及 Storage 元数据，再重装迁移验证归档保护。已修复归档逻辑通过既有迁移重建同一触发函数，回滚脚本继续按原依赖顺序删除。

优先回退前端，保留新增私有表及 MFA 限制。确需移除 schema 时，先导出四张分发表及引用清单，审批后执行独立回滚文件。它按依赖顺序删除本模块对象，不使用 CASCADE，不动项目、文章、auth 或 storage；存在未来外部依赖时会失败而非连带删除。**回滚 SQL 会永久删除分发数据**，不自动执行；恢复数据需使用事先验证的备份。

## 验证范围

PGlite 执行真实 PostgreSQL 策略、触发器、外键和 invoker RPC，覆盖匿名、普通用户、管理员 aal1/aal2/缺 aal、资格撤销、意外 permissive 策略、非法字段/URL、版本冲突、失败事务回滚、项目删除置空、媒体删除约束与关联级联。归档测试包括直接 SQL 和由 Supabase SDK 发送、由测试传输层转交给 PGlite 执行的 PATCH。浏览器用例使用实际 Supabase SDK 和受控 HTTP 响应，安全头用例用本地生产构建模拟现有 Cloudflare 规则。

参考：[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[MFA 数据库约束](https://supabase.com/docs/guides/auth/auth-mfa)、[近期变更](https://supabase.com/changelog)。实现前已核对文档；CLI v3 的远程目标/确认变更只影响后续运维流程，本次仅使用本地 migration new。
