# 管理后台架构

本次调整基于 `origin/main` 的 `8cf092b`（合并国际化 PR #3）。最新提交引入了语言前缀路由，因此后台继续使用独立的 `/admin/*` 路径，前台保留 `/zh/`、`/en/`、`/ja/`。

此文记录架构重构阶段。后续单管理员安全加固及上线顺序见 [后台安全实施记录](admin-security.md)。

后续内容工作台、主题切换与统计组件见 [后台内容工作台](admin-content-workspace.md) 和 [访问统计](admin-analytics.md)。

## 分层与职责

```text
src/AppRouter.tsx                     前台路由与后台延迟加载入口
src/components/RouteErrorBoundary.tsx 通用渲染 / 模块加载错误边界
src/admin/
  AdminApp.tsx                       后台认证、样式与路由作用域
  routes.ts                          页面、标题、导航及延迟加载注册表
  auth/                              会话状态与管理员资格验证
  components/                        布局、权限守卫、反馈、加载与重试
  hooks/                             查询、互斥操作、列表与编辑器流程
  features/projects/                 项目草稿、序列化、字段组件与业务操作
  features/articles/                 文章草稿、序列化与结构化章节编辑
  features/site/                     设置草稿、嵌套字段与 About 列表编辑
  lib/                               通用错误解析、内容校验与 slug 生成
  pages/                             路由页面的组合与呈现
src/services/                        Supabase 读取、写入与唯一性检查
src/types/database.ts                数据记录契约
```

后台入口、认证 Provider 和后台 CSS 只在访问 `/admin/*` 时加载。公开页面无需执行后台的管理员资格查询。路由页面继续按需加载，页面内容的 `Suspense` 位于后台布局内部，切换页面时保留侧栏和顶栏。

后台入口与页面分别有错误边界。入口模块加载失败时显示重新加载按钮；页面模块或渲染失败时保留导航，切换到其他路径会重置页面错误边界。

## 认证与权限

`AdminAuthProvider` 订阅 Supabase 的初始会话、登录、刷新和退出事件，并通过 `sessionResolver` 统一处理密码登录与事件触发的资格验证。

- 状态明确区分 `checking`、`anonymous`、`authorized`、`denied` 和 `error`；安全加固增加 `mfa-required` 与 `enrollment-required`。
- 同一用户和 token 的并发验证共享请求；资格读取延后到新的任务，认证事件回调保持同步。
- 每次会话变化更新请求序号。旧身份验证结果、退出后的结果和 Provider 卸载后的登录结果不能更新当前认证状态。
- 已验证用户刷新 `aal2` token 时保留编辑器，资格验证拒绝、失败或降至 `aal1` 时撤销访问；切换用户必须重新验证。
- 登录成功恢复原后台地址的路径、查询参数和锚点；外部地址与登录页回跳均回退到控制台。
- 注销错误传递给界面。当前安装的 SDK 在远程注销失败后也可能清除本机会话，此时错误保留在登录页，下一次登录重新处理会话状态。

前端权限守卫负责界面访问，数据库授权由 `admin_users` 和 RLS 策略执行。架构重构阶段没有数据库迁移；安全加固阶段另备 MFA 迁移，须在新登录页上线、唯一管理员完成 TOTP 绑定后启用。

## 查询与写入流程

| 模块 | 负责的流程 |
| --- | --- |
| `useAdminQuery` | 页面局部数据、加载、错误、重试；仅最新请求可写入，卸载后忽略响应 |
| `useAdminAction` | 同一操作域内互斥执行、提交反馈；同步锁阻止按钮禁用前的重复提交，卸载后不执行成功回调 |
| `useContentCollection` | 项目和文章列表的状态切换、删除、刷新及反馈 |
| `useAdminEditor` | 根据记录身份加载草稿、序列化、创建 / 更新、保存反馈及创建后的路由替换 |

页面 loader 与编辑器配置保持稳定引用。编辑页内部组件以记录 id 为 `key`，新建、现有记录及不同记录间切换都会重置草稿。读取失败时显示重试状态，未找到记录时不能保存空白表单。

保存期间禁用编辑字段，封面上传与项目保存共享操作锁。创建成功后立即切换到新记录的编辑地址，移除延时导航；离开页面后完成的写入不会把用户跳回编辑页。

草稿只包含可编辑字段，记录 id 和服务端时间戳不进入保存 payload。领域函数处理默认值、记录映射、必填校验和序列化。嵌套内容通过不可变更新维护。slug 唯一性查询统一留在 service 层，数据库唯一约束继续处理并发冲突。

## 扩展方式

1. 在 `routes.ts` 注册后台页面的路径、标题、延迟加载组件；需要显示在侧栏时添加 `navigation`。
2. 在 service 中实现类型明确的读写函数。页面不要直接调用 Supabase。
3. 普通读取页面使用 `useAdminQuery`，写入使用 `useAdminAction`；内容列表可复用 `useContentCollection`。
4. 新编辑器在对应 `features/` 目录定义独立草稿工厂、映射和序列化函数，使用模块级 `EditorConfig` 接入 `useAdminEditor`。
5. 记录编辑页用稳定身份作为内部组件的 `key`，复用 `AdminLoading`、`AdminQueryError` 和 `AdminFeedback`。
6. 为关键流程补充失败重试、身份切换、并发响应及重复提交验证。

## 验证

```powershell
npm run lint
npm run build
npm test
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:WORK_COVER_IMAGE = Join-Path (Get-Location) 'public/assets/work/work-project-cover-fuji.webp'
npm run test:e2e
```

架构重构阶段验证结果：lint 无警告、生产构建成功，68 项单元测试和 31 项浏览器测试全部通过（包含真实本地封面图片的可选测试）。安全加固后的验证结果见 [后台安全实施记录](admin-security.md#验证)。

单元测试覆盖认证竞争、路由契约、草稿序列化、现有 service、国际化与 SQL RLS。浏览器测试通过受控 HTTP 响应运行实际 Supabase SDK，覆盖登录权限、CRUD、媒体、设置、重复提交、离开页面后的保存、请求竞争、延迟加载与错误恢复，以及前台多语言和封面回归。

既有浏览器测试改为使用最新国际化路由和 Provider。完整回归还发现 375px 下前台导航溢出，移动端按钮间距从 5px 调整为 3px，保留原布局与功能。

SQL RLS 测试在 PGlite 中执行；浏览器测试使用模拟 HTTP，未连接真实 Supabase 项目或执行线上迁移。

## 参考

- [Supabase 认证事件](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)：认证回调与订阅清理。
- [React lazy](https://react.dev/reference/react/lazy)：延迟加载、Suspense 与加载失败处理。
- [React useEffect](https://react.dev/reference/react/useEffect)：异步响应与清理。
