# 后台访问与内容点击统计

统计从新迁移和前端代码启用后开始累计，不导入或推测历史访问量。现有 Cloudflare 外部分析数据不在本功能的读取范围内。迁移未安装时，后台显示“尚未启用”；网络、权限和返回格式错误单独显示加载失败，不把失败当作 0。

## 统计口径

- 网站浏览量（PV）：公开页面首次完成入场显示记 1；在同一文档内切换首页、作品、文章、关于、联系区域的路由，每次成功切换记 1。部分内容接口失败不影响页面已被打开的事实。仅滚动、切换语言或主题、同区域重复导航、React 重渲染、StrictMode 或同公开路由重挂载不追加计数。
- 进入后台不计数；从后台或 404 返回公开页面，开始新的公开访问，记 1。刷新或新标签页是新的文档，也会记 1。
- 文章/项目点击量：已发布内容的详情成功打开记 1，包括有效的直接详情链接；关闭后重新打开再次记 1。仅列表展示、缺失或未发布内容、详情加载失败不计。内容重新请求及 React 重渲染不追加计数。
- 所有日期由数据库按 `Asia/Shanghai` 计算，7/30/90 天均包含今天。每日趋势包含实际无事件的 0 日。
- 全站总点击量保留已删除内容的历史计数；逐篇列表展示目前仍存在的内容。删除不会反向改变真实历史总量。

这些数字是浏览量与详情打开量，不是独立访客（UV）、经过防机器人验证的人数或外链点击量。客户端去重只保证应用内的上述口径；公开入口可能被自动化请求伪造或增加计数。当前版本不包含网关限流、验证码或机器人识别，不应把数字作为计费、风控或精确人数依据。

## 数据与权限

新增迁移：`supabase/migrations/20261006192850_add_private_analytics.sql`。迁移由 Supabase CLI 的 `migration new` 生成，只增加统计对象，不替换现有内容、管理员和 MFA 规则。

`public.analytics_page_daily` 保存日期与 PV；`public.analytics_content_daily` 保存日期、内容类别、既有内容 id 和点击量。既有内容 id 是 `text`，允许历史非 UUID id。应用不收集或存储 IP、完整 URL/查询参数、referrer、设备指纹、用户 id 或持久访客标识，不写统计 Cookie、localStorage 或 sessionStorage。

`analytics_private.event_receipts` 只保存一次事件的随机 UUID 与数据库接收时间，用于网络重试幂等。UUID 不代表访客，事件之间不共享身份。`analytics_private.maintenance` 记录清理节奏。旧收据通过时间索引清理，每分钟最多一个请求删除最多 1000 条 48 小时前的收据，不做每次请求全表扫描，也不需要额外调度服务。没有新事件时清理暂不运行；高流量超过清理吞吐时可能形成积压。48 小时后的 UUID 不承诺继续幂等。

匿名与登录用户只能调用 `public.record_analytics_event`，参数为 `p_event_id UUID`、固定枚举 `p_event_type` 和 `p_content_id text|null`。每次只能增加 1，日期由服务器决定。点击目标必须存在且已发布；无效目标返回 `false`，非法枚举、缺失事件 id、页面浏览夹带内容 id 等抛 `22023`。同 UUID 重试返回 `false` 并不重复累计，未发布内容不能通过统计接口读取或修改。

公开包装函数使用 `SECURITY INVOKER`，内部写入函数放在不暴露给 Data API 的 `analytics_private` schema，并使用固定空 `search_path`、完整限定对象名称和受限输入。内部 `SECURITY DEFINER` 是允许匿名提交固定增量的刻意接口设计；它不接受任意 SQL、增量、日期或内容变更，也不向调用者返回统计值。请保持 `analytics_private` 不在 Supabase Data API 的暴露 schema 列表内。

统计表启用 RLS，匿名无表权限；登录用户仅有 SELECT，必须同时属于现有 `admin_users` 且 JWT 为 `aal2` 才能读到统计。任何客户端都没有直接写统计表或读收据的权限。`public.get_admin_analytics(p_days)` 使用调用者权限与 RLS，并显式检查同一管理员/MFA条件；非管理员或 `aal1` 抛 `42501`，避免把拒绝访问伪装成空统计。读取范围仅接受 7、30、90，否则抛 `22023`。前端没有 service role/secret key。

## 前端接口

`src/services/analyticsService.ts` 导出：

- `fetchAdminAnalytics(days = 30): Promise<AdminAnalyticsData>`。
- `AnalyticsContentItem`：`id/title/slug/status/clicks/totalClicks`，其中 `clicks` 为选定期间，`totalClicks` 为启用后的累计。
- `AnalyticsDailyPoint`：`date/pageViews/articleClicks/projectClicks`。
- 启用结果包含 `enabled: true`、`timeZone`、`days/startDate/endDate`、`todayViews/periodViews/totalViews`、期间与累计文章/项目点击量、`daily/articles/projects`。
- 未配置或 RPC 未安装分别返回 `enabled: false` 与 `not_configured`、`migration_required`。网络、权限和格式错误抛出，不返回伪造统计。结果检查选定范围、连续日期以及非负安全整数。

`src/hooks/usePublicAnalytics.ts` 在公开 `App` 中收集事件。去重状态仅存于当前文档内存，跨 React 重挂载保持；进入后台/404时重置公开访问状态。每个事件至多自动重试一次，响应丢失、SDK 网络错误或抛出的 fetch 异常均复用同一事件 UUID。收集失败或浏览器不支持随机 UUID 时不会影响公开页面使用。后台模块不调用收集 hook。

## 启用与核验

本次工作只生成代码、迁移和本地验证，未应用生产迁移或部署。启用由管理员在审阅后执行。

1. 核对目标项目、现有 MFA 迁移与管理员 TOTP状态，审阅新增 SQL。既有生产历史与仓库前两条旧迁移的版本号不同，不能盲目执行 `supabase db push`、重放初始 schema 或修写历史。应按项目已部署迁移历史，只应用这一条新增迁移。
2. 保持 `analytics_private` 为未暴露 schema，检查新增函数的 EXECUTE grants、统计表的 SELECT/RLS 与无客户端写权限。
3. 发布包含收集 hook 与后台统计 UI 的前端，继续使用现有公开 Supabase 配置；不需要增加 secret/service key 或部署 Edge Function。
4. 验证访客不能读取/直接写统计表，普通登录用户与 `aal1` 管理员不能读聚合，完成 MFA 的现有唯一管理员可以读取。RPC未启用与网络失败应呈现不同状态。
5. 在真实公开页打开和有效详情打开后，用管理员后台核对今日、期间和逐篇计数；同时核对语言/主题切换、内容重请求不重复，关闭后重开详情追加一次。

本地 PGlite 验证运行真实 PostgreSQL 角色、权限、RLS与函数，包括匿名提交、text id、UUID幂等、草稿/缺失目标拒绝、直接表读写拒绝、管理员/MFA边界、Shanghai日期和收据清理。它不证明生产迁移、Supabase Data API暴露配置、浏览器网络可达性或真实平台反机器人能力；这些仍需在正式启用时核验。
