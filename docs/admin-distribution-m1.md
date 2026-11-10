# 内容分发管理 M1

基线：`origin/main`，`38d27ae2f43764e6a97b0a879d17aac1edcd3966`。分支：`codex/distribution-m1`。本次只准备代码、迁移 SQL 与审查材料，未执行生产数据库迁移、正式部署或合并 main。

## 当前代码检查

开发前已 fetch main，并读取 `src/admin/routes.ts`、`AdminLayout.tsx`、features/hooks/services、`src/types/database.ts`、全部现存迁移，以及后台架构、内容工作台和安全文档。以下判断来自该基线的实际代码：

- 后台使用 React Router 路由注册表与延迟加载，导航由同一注册表生成。
- 查询和写入分别由 `useAdminQuery`、`useAdminAction` 管理，前者防止过期响应提交，后者同步互斥并在卸载后忽略成功回调。
- `projects.id` 是 **text**，分发外键使用同一类型，不能按 UUID 推断已有项目标识。
- 现有成员资格表为 `admin_users(user_id uuid)`。已有 restrictive MFA 策略保护内容及媒体，成员资格查询在 aal1 可用以支持原登录流程。
- 媒体通过 Storage `media` 桶读取，文件 id 为 UUID，路径不是文件 id。该桶公开，现有上传仅支持 JPEG/PNG/WEBP、5 MiB。
- 后台语义颜色、字体及 520 ms 圆形主题切换均由现有样式和主题 Provider 提供。

本模块复用上述组件和边界，未修改认证 Provider、公开项目/文章的发布逻辑及既有 RLS。

## 操作与路由

| 路由 | 操作 |
| --- | --- |
| `/admin/distribution` | 精确账号/草稿/待发布计数，最近六条内容 |
| `/admin/distribution/posts` | 标题、正文、标签搜索，状态/类型/项目筛选，排序、分页 |
| `/admin/distribution/posts/new`、`posts/:id` | 创建、编辑内容源，选择推广目标、项目、目标账号和已有媒体 |
| `/admin/distribution/accounts` | 平台、状态筛选及搜索、排序、分页，账号归档 |
| `/admin/distribution/accounts/new`、`accounts/:id` | 公开账号资料及配置；已归档账号只读 |

账号预设包括小红书、抖音、B站、微信公众号、微博、知乎、X、YouTube、其他。支持个人/项目官方类型、主页、定位、项目关联、备注与启用状态。主页可留空。停用或归档的账号不能成为新的目标，既有内容关联保留；取消旧关联后不能重新添加停用账号。M1 未提供恢复归档或物理删除账号的入口。

内容类型为图文、视频、文章、动态。推广目标为品牌认知、项目访问、产品下载、关注与交流。状态为 `draft`（草稿）和 `ready`（待发布），后者只表示准备完成。编辑器没有“已发布”、定时或自动发布入口。删除仅允许草稿，待发布内容需先明确保存为草稿。

标签用逗号分隔，输入原文保留到保存时再解析。正文按文本保存，保留回车、HTML/SQL 示例，不执行 HTML。现有项目和文章状态完全由原模块管理。

未保存状态在编辑器显示，改回基线后清除。账号和内容编辑器通过 React Router 的 `useBlocker` 保护会离开当前编辑器的站内链接、历史前进/后退及程序性跳转。刷新或关闭标签页由浏览器原生提醒。取消离开后保留表单；若创建在确认期间完成，选择继续编辑会打开同一条已保存记录。确认离开后，已发送的请求可能完成，迟到响应不会把用户带回编辑器。草稿只保存在当前表单，会话到期时既有登录保护优先生效。

失败读取可重新加载，不能在读取失败时保存空白记录。关联资料读取失败时禁用保存，避免不完整选择覆盖已存数据。所有表单保存共用互斥提交锁。创建时保留同一个 UUID；响应丢失后重试不能创建第二条记录，冲突提示用户返回列表确认已保存内容。更新、归档、删除带版本号条件，旧页面不能静默覆盖新版本。

## 分层

```text
src/admin/pages/AdminDistribution*.tsx        页面组合、展示与表单
src/admin/features/distribution/             字段映射、编辑流程、导航、媒体选择和样式
src/services/distributionService.ts           查询、版本条件写入、原子 RPC、错误映射
src/lib/distributionValidation.ts            严格字段/枚举/URL/长度/关联 id 校验
src/types/distribution.ts                    独立领域契约、准备阶段适配器接口
supabase/migrations/*distribution_m1.sql     私有表、约束、索引、RLS 与 invoker RPC
```

页面无直接 Supabase 写入。通用加载、错误、反馈、页面头、编辑头、列表工具栏、分页及查询/操作 hooks 均复用现有实现。独立编辑 hook 用于分发状态与版本契约，避免把 `ready` 混入原项目/文章的 `ContentStatus`。

内容列表和账号列表分批读取，显式分页越过 API 默认行数限制，再在浏览器筛选；概览通过 exact count 查询独立计数，不依赖列表长度。项目和媒体选项继续使用既有 service。当前适合个人后台规模，规模增长时需把正文检索、项目/媒体选择和分页下推到数据库。

视觉延续现有 `--admin-*` token：浅色背景 `#f0f3f7`、白色面板、蓝色 `#2563eb`，深色背景 `#171a20`、面板 `#252a33`、浅蓝色 `#8fb5ff`；使用现有 Plus Jakarta Sans / 系统中文字体。侧栏、顶部导航、主题按钮与移动抽屉保持同一套实现。没有新增运行依赖或 UI 框架。

## 数据关系

| 表 | 内容 | 删除策略 |
| --- | --- | --- |
| `distribution_accounts` | 公开账号资料、项目 FK、启用/归档、版本、服务端时间戳 | 前端仅归档；project 删除后置空 |
| `distribution_posts` | 规范内容源、正文/标签/类型/目标、状态、项目 FK、版本/时间戳 | project 删除后置空；仅草稿可删除 |
| `distribution_post_targets` | 内容源与账号多对多关系 | source 删除级联；账号物理删除受引用约束 |
| `distribution_post_media` | 内容源与已有 Storage 对象关系，含素材顺序 | source 删除级联；被引用素材删除受限 |

所有分发表启用并 FORCE RLS。媒体仅保存 UUID 引用，不复制文件或保存任意远程素材 URL。新关联必须指向 `media` 桶中存在的文件。文件本身继承原公开媒体库属性，内容与素材的分发关联仍是私有的。

`save_distribution_post` 以调用者权限在同一个事务内更新源、目标与素材；任一关联不存在时全部回滚。只有新增目标需要启用/未归档，已有目标可以在账号归档后继续保留。项目删除只清除关联，可能同时使引用记录版本递增；已打开的编辑器会提示重新加载。

迁移、权限矩阵、审查和回滚见 [安全审查](admin-distribution-security.md)。第三方研究及后续里程碑见 [调研和扩展方案](admin-distribution-research.md)。验证与截图见 [交付记录](admin-distribution-delivery.md)。
