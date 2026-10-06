# 后台内容工作台

本轮基于 `main` 的 `4d71679`，在 `codex/admin-content-workspace` 重构个人内容管理体验。后台仍使用 `/admin/*`，内容记录与前台路由保持兼容。

## 操作方式

- **仪表盘**：查看网站今日／累计浏览量、7／30／90 天趋势与每篇文章、项目的点击量；内容概况与最近六条变动仍可快速进入编辑。统计定义和启用步骤见 [访问统计](admin-analytics.md)。
- **项目与文章**：统一内容表格，支持关键词、状态与分类组合筛选；按更新时间、名称或展示顺序排序。每页 10 条。筛选保存在 URL，刷新、浏览器返回、编辑器的“返回列表”都恢复原列表。
- **状态管理**：列表可发布、转草稿、归档；删除前确认。已发布内容转草稿或归档后从前台隐藏。操作仍使用同一个互斥写入锁。
- **编辑器**：正文主区与发布侧栏分开；分区按钮滚动到对应字段并移动键盘焦点。统一“存为草稿 / 发布”与“保存当前状态”。保存时禁用字段、执行原生表单校验与既有 service 校验。
- **结构化正文**：小节可添加、移动、复制和删除，保留代码、引用、提示块与表格；文本输入不再吞掉尾部回车，保存时清理空段落。
- **保存状态**：修改后显示未保存提示；改回原值恢复干净状态；成功保存显示时间。关闭或刷新页面时有浏览器提醒。草稿不写入浏览器存储，也不自动保存。
- **站点设置**：首页简介、近况、联系方式与“关于我”四个中文分区；重复内容列表可调整顺序。
- **媒体库**：文件名/路径搜索、格式筛选、排序与每页 12 张；选中图片查看详情，复制公开链接用于封面。复制失败明确反馈，可从详情手动复制。上传仍限制 JPEG/PNG/WEBP、每张 5 MiB；删除说明引用图片会失效。
- **移动端与键盘**：抽屉导航有遮罩、焦点约束和 Escape 关闭；关闭后恢复菜单按钮焦点；切回桌面解除内容禁用。内容表格在容器内水平滚动，表单在窄屏改为单列。

## 组件层级

```text
AdminApp / ThemeProvider / AdminAuthProvider  路由、主题、MFA、登录与错误边界
└─ AdminLayout                               导航、面包屑、闲置提醒
   ├─ AdminDashboard + AdminPageHeader        统计、内容概况与创作入口
   │  └─ AdminAnalytics                      指标、趋势、分布、逐篇统计
   ├─ AdminProjects / AdminArticles
   │  └─ ContentCollection                   查询状态、通用表格和操作
   │     ├─ CollectionToolbar / Pagination   检索、筛选、排序和翻页
   │     └─ ContentStatusBadge                统一内容状态
   ├─ AdminProjectEditor / AdminArticleEditor / AdminSiteSettings
   │  ├─ AdminEditorHeader / Navigation      保存状态与分区跳转
   │  ├─ features/*                          领域表单与内容块
   │  └─ AdminEditorPublishPanel             发布和排序
   └─ AdminMedia + CollectionControls        图片列表与详情

hooks/useCollectionView                      URL 视图状态与派生分页
lib/collection                              筛选、排序、状态与日期格式
lib/editor                                  同列表返回路径与提交状态解析
hooks/useAdminQuery / useAdminAction          继续负责最新请求与互斥写入
hooks/useAdminEditor                          加载、保存、dirty 基线与返回路径
services/*                                  现有 Supabase 访问与输入校验
services/analyticsService                    受限统计接口、范围验证、幂等重试
hooks/usePublicAnalytics                     公开页面与成功详情的事件去重
```

后台 CSS token 限定在后台元素内。无需新增 UI 框架或依赖；后台入口与页面继续按需加载。登录、MFA、闲置退出、RLS 与现有 Supabase 服务保持原授权边界。

2026-10-07 按用户选定的第一组小红书参考（设计狮啊灿的 Day843 / Exylon 仪表盘）更新为灰白底、白色面板与统一蓝色重点。顶部并列显示时段访问量、今日浏览、文章点击、项目点击；累计浏览保留在第一项说明中。趋势与分布约为 2:1，逐篇统计下方排列内容概况与最近变动。桌面提供胶囊导航和图标栏，手机保留抽屉导航和两列指标。

深色采用炭黑、深灰面板与浅蓝重点。登录、列表、编辑器、媒体及统计图使用同一组后台语义 token。登录页与所有后台页面继续共用前台 `ThemeProvider`：以按钮几何中心播放同一个 520 ms 圆形 View Transition，保存相同主题偏好；减少动态效果或不支持该 API 时直接切换。本次样式调整没有修改公共主题控制器。

## 验证与范围

验证包括生产构建、lint、单元测试，以及实际 Supabase SDK 配合受控 HTTP 数据的 Playwright 浏览器回归。浏览器测试覆盖原 CRUD、认证/MFA、请求竞争、重复提交与失败恢复，也覆盖新增 URL 视图、媒体复制、dirty、章节复制、表单校验、桌面/移动布局和导航键盘操作。

内容工作台与统计阶段已完成生产构建、lint、162 项单元测试及 170 项 Edge 浏览器用例验证。该阶段完整运行通过 168 项；报告保存触发开发服务器重载，中断两项前台外观检查，冻结写入后使用原断言重跑均通过。该记录属于此前的功能验证，不表示本次配色更新重跑了全部 170 项。

本次蓝白样式更新通过生产构建、lint 和 31 项有针对性的 Edge 浏览器回归（2.6 分钟，无重试）：全部后台入口的桌面/手机双向主题真实中间帧、键盘与减少动态效果、统计加载/缺迁移/失败恢复与日期竞争、保存离开行为、长内容布局、抽屉焦点与关闭后的可访问性。保留原断言，未修改测试。六张最终仪表盘深浅色截图和列表、媒体、文章编辑器截图已完成视觉验收；外观检查无页面或控制台错误、手机文档无横向溢出。验收记录及参考来源见 [design-qa.md](../design-qa.md)。

内容工作台与统计代码在功能分支交付，未执行生产内容写入、未应用线上统计迁移、未部署正式站点。统计迁移只新增计数表和受限接口；浏览器验证与本地 PostgreSQL 执行分别验证客户端和权限行为，不代表线上已启用。搜索、排序和分页针对现有服务已读取的记录执行，适合当前个人内容规模。站内链接与浏览器后退不阻止离开编辑器；未保存时应先主动保存。

Windows 测试如果出现 Vitest 临时 SSR 缓存路径问题，可对当前测试进程指定仓库内临时目录：

```powershell
$env:TEMP = Join-Path (Get-Location) 'node_modules/.cache/admin-unit-tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
npm test
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:WORK_COVER_IMAGE = Join-Path (Get-Location) 'public/assets/work/work-project-cover-fuji.webp'
npm run test:e2e
```

## 开源参考

参考交互模式并在现有组件上实现：

- [React Admin — List](https://marmelab.com/react-admin/List.html)：列表操作、筛选、排序、分页与 URL 状态恢复。
- [Refine](https://github.com/refinedev/refine)：领域资源与可复用管理 UI 的职责组织。
- [shadcn/ui](https://github.com/shadcn-ui/ui)：可组合组件与可访问性方向。

未引入这些项目的运行时依赖，也未复制模板源码。
