# 内容分发 M1 审查修复

开发基线为远程 `codex/distribution-m1` 的 `6d423ba517ec5bd68c8c885038e539bf2743d896`。审查范围为 M1 归档、编辑导航和现有媒体集成。

## 修复

- 原归档触发器只在更新后的 `archived_at` 非空时保留归档时间，直接清空该列可以恢复账号，归档后也能继续编辑。现有 M1 迁移中的 `distribution_private.touch_record()` 在首次归档时自动停用并写入服务端时间。普通 UPDATE 命中已归档行即返回 `55000`。唯一例外是删除关联项目后由外键触发的置空动作，既有稿件目标关联保留。
- 原编辑器只监听站内链接点击。根路由改用 React Router data router，保留现有路由表和认证守卫。分发编辑器通过 `useBlocker` 拦截离开路径的 Link、历史和程序性跳转，通过 `beforeunload` 保护刷新和关闭。弹窗可以继续编辑或确认离开。保存先完成时等待用户选择，确认离开后晚到的响应不会重定向页面。相同路径的查询参数和锚点更新保留表单，管理员会话失效时由既有认证守卫接管。
- SQL 差异限于既有触发函数。表、RLS/MFA 授权、Storage FK 与回滚对象清单沿用原定义。回滚验证增加了已被分发引用的 Storage 元数据及原策略的比对，并验证重装后的归档保护。[迁移 SQL](../supabase/migrations/20261108173132_add_private_distribution_m1.sql) · [安全审查](admin-distribution-security.md) · [回滚 SQL](../supabase/rollbacks/distribution_m1.sql)

## 验证范围

- 数据库测试覆盖首次归档自动停用、直接 SQL 和 SDK PATCH 绕过、归档后字段与目标关联保持、项目删除置空、回滚与重装。SDK PATCH 在测试传输层转交给 PGlite 执行真实 PostgreSQL 触发器。
- 浏览器覆盖站内 Link、返回和前进、程序性 replace、刷新和关闭、取消后继续编辑、正常保存后离开、保存响应在确认前后到达以及脏表单会话到期。生产 CSP 用例补充离开弹窗和取消后保存断言。
- Storage 源码审查表明，上游批量删除先处理数据库事务，后清理对象文件。PGlite 验证了外键限制。本机缺少可运行的隔离 Supabase 实例，真实 Storage 删除、对象字节及 PostgREST/MFA 验收待按步骤执行。[隔离验收步骤与脚本](admin-distribution-storage-acceptance.md)

## 回归结果

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过，无警告 |
| `npm run build` | 通过，Vite 保留主包大于 500 kB 的提示 |
| `npm test` | 235 项通过，其中 25 项分发 PostgreSQL 测试 |
| `npm run test:e2e` | 208 项通过，包含 6 项新增浏览器用例 |
| `npm run test:security` | 12 项通过，涵盖 CSP Report-Only 和 Enforced |

浏览器套件使用无头 Edge 与受控 HTTP 响应。采用 data router 后，Vite 主包的 gzip 大小从 177.80 kB 增至 195.21 kB。隔离验收脚本通过语法检查，非环回目标在发起请求前被拒绝。

加严媒体外键断言的一次中间运行出现两项失败。PGlite 的 PostgreSQL 18 对这条 `ON DELETE RESTRICT` 返回 `23001`，测试最初期待了 `23503`。该断言中断后，回滚测试复用前例尚未清理的 UUID，触发主键冲突。最终断言校验实际 SQLSTATE、约束名及保留的对象 ID，回滚测试使用独立记录。

## 待发布规则建议

当前 `ready` 与草稿共用字段和关联约束。前端要求去空白后非空的标题，但正文、目标和素材可以全部为空。数据库使用 `btrim(title)`，只含制表符的标题可通过直接 RPC 写入。已有目标归档后仍可保留。数据库校验素材 UUID 和所属桶，文件可下载性需要通过 Storage 验证。

| 状态 | 建议必填 |
| --- | --- |
| 草稿 | 去除空白后非空的标题、合法内容类型，可继续使用默认类型。其他字段可稍后补充。 |
| 待发布 | 标题、内容类型、至少一个启用且未归档的目标。按内容类型和平台要求检查正文或实际可用素材。图文至少有一张可用图片，文章须有正文，动态可为纯文本，视频须有实际视频，封面单独计算。 |

项目、推广目标与标签可按业务需要补充。现有媒体库仅接收图片，视频素材条件需在实际支持视频后再落地。本轮保留现有草稿与待发布校验。

## 文件清单

| 范围 | 文件 |
| --- | --- |
| 路由 | `src/AppRouter.tsx` |
| 分发界面 | `src/admin/features/distribution/DistributionLeaveDialog.tsx`、`src/admin/features/distribution/distribution.css`、`src/admin/features/distribution/useDistributionEditor.ts`、`src/admin/pages/AdminDistributionAccountEditor.tsx`、`src/admin/pages/AdminDistributionPostEditor.tsx` |
| 数据库 | `supabase/migrations/20261108173132_add_private_distribution_m1.sql` |
| 测试 | `tests/distribution-rls.test.ts`、`tests/e2e/distribution.spec.ts`、`tests/security-browser/headers.spec.ts` |
| 验收脚本 | `scripts/verify-distribution-local.mjs` |
| 文档 | `docs/admin-distribution-review.md`、`docs/admin-distribution-storage-acceptance.md`、`docs/admin-distribution-delivery.md`、`docs/admin-distribution-m1.md`、`docs/admin-distribution-security.md` |
