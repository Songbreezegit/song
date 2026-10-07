# 正式站访问统计启用记录

2026-10-07，用户明确许可后，为 `https://songisle.xyz` 使用的 Supabase `song` 项目（`vfgmptjfcfgptaqblydd`）应用已审阅的统计迁移。此前正式前端已经调用统计接口，但数据库的计数表及两个 RPC 均不存在，因此仪表盘没有可用统计。

## 应用结果

- 北京时间 2026-10-07 13:22 启用；实际部署版本为 `20261007052225_add_private_analytics`。仓库迁移文件和 PGlite 测试引用同步为这个版本，SQL 内容未修改，SHA-256 为 `87c8e9aea68734d0e1adf57c9ec6bcaa7300972919093203781d76d5490d2d05`。
- 只应用这一条新增迁移；此前三条生产迁移、既有内容及唯一管理员/MFA 规则保持原状。应用前确认仅一名管理员，已有一个 verified TOTP。
- 首次迁移请求遇到传输错误，随后核对历史与对象均未新增，再次请求成功；没有重复执行或手工修写迁移历史。
- 正式前端已经包含 `record_analytics_event` / `get_admin_analytics`，公开 Supabase 配置指向上述项目；本次没有重新部署前端。

## 实际公开页采集

使用正式站真实浏览器界面访问，没有直接调用写 RPC 制造测试事件。

| 操作后 | 网站 PV | 项目详情点击 | 事件收据 |
| --- | ---: | ---: | ---: |
| 迁移刚安装 | 0 | 0 | 0 |
| 打开正式首页 `/zh/` | 1 | 0 | 1 |
| 打开“礼账 · Lizhang”详情 | 1 | 1 | 2 |
| 关闭详情、切换深浅色及中英文 | 1 | 1 | 2 |
| 关闭后重新打开同一项目 | 1 | 2 | 3 |
| 导航到 `/zh/notes` | 2 | 2 | 4 |
| 进入正式后台登录页 | 2 | 2 | 4 |

管理员读取接口返回 `enabled: true`，30 天趋势包含 30 个日期，今日／累计 PV 为 2，“礼账 · Lizhang”期间／累计点击为 2。上表是核验时的快照，含这次真实验证访问，后续访问会继续累加。这些浏览量及详情打开量不是独立访客人数，也没有回填启用前历史。

正式数据库和公开界面均确认已发布文章数量为 0，因此文章点击量为 0；本次无法在正式站实际打开已发布文章验证采集，没有新增测试文章或修改内容。文章事件的有效目标、草稿拒绝及汇总行为由现有本地 PostgreSQL 测试覆盖。

## 权限与读取

- 生产 catalog 确认四张统计表启用 RLS。匿名无法直接读表；登录客户端仅有两个公开计数表的 SELECT，无直接写权限，也没有私有收据或维护表读取权限。
- 两个 public RPC 均为 `SECURITY INVOKER`；内部 writer 为 `SECURITY DEFINER`。三者均固定空 `search_path`，没有 PUBLIC EXECUTE。匿名只能执行受限写入口，不能执行汇总读取。
- 实际 Data API `Accept-Profile: analytics_private` 返回 HTTP 406 / `PGRST106`，明确仅暴露 `public, graphql_public`。匿名读取计数表和聚合 RPC 均返回 HTTP 401 / `42501`，接口已经存在且访问被拒绝。
- 在生产 `BEGIN READ ONLY` + 一致快照事务中，只设置连接内 JWT 声明并切换数据库角色，验证匿名、非管理员 `aal2`、管理员 `aal1` 均拒绝读取；唯一管理员 `aal2` 可读取 7／30／90 天聚合，返回总量与原始计数一致。事务最终回滚，没有插入账号、业务数据或人工事件。
- 这项角色验证不签发浏览器 JWT、不获取登录凭据。正式后台登录页可正常加载，但本次没有重新登录管理员浏览器或核验登录后的仪表盘画面。用户刷新正式仪表盘即可读取新数据；进入页面、切换统计范围或点击刷新会重新查询，当前没有自动轮询。

## Advisor 复核

新建私有表出现两条 [RLS enabled no policy 信息](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)：它们刻意拒绝所有客户端访问，只由受限内部函数维护，不应为消除此提示新增允许访问策略。

Advisor 对两张统计表提示 [Auth RLS initialization plan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)。生产只读 `EXPLAIN` 已显示两张表的 JWT、管理员资格条件均采用 `InitPlan`／`One-Time Filter`，未见逐行重复计算身份函数的规划。新索引的 [unused index 信息](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) 是启用初期状态，保留查询和清理索引。

既有内容表的性能提示及 [泄露密码保护提示](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)不属于这次统计启用，未改动原有策略或密码设置。

## 仓库验证

同步实际迁移文件名后执行 `npm test -- tests/analytics-rls.test.ts`，10 项真实本地 PostgreSQL 权限与统计测试全部通过；迁移文件 SHA-256 与应用前一致，`git diff --check` 通过。应用运行时代码没有变更，本次没有重复执行此前已经完成的全套 UI 验收。
