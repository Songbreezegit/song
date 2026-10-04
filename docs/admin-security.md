# 后台安全实施记录

适用范围：SONG ISLE 个人网站，仅一名可信管理员。安全分支为 `codex/admin-security`，基于后台架构重构 `494202a`。现有密码及密码策略按用户要求保留，不增加其他管理员、角色系统或密码修改功能。

## 已实现的代码

| 项目 | 当前行为 |
| --- | --- |
| MFA 登录 | 密码登录后先核对 `admin_users`，再通过 Supabase Auth 验证当前 token。已有验证器时输入 TOTP，首次登录时主动点击绑定按钮。完成 `aal2` 验证后才进入后台，保留原路径、查询参数与锚点。 |
| MFA 生命周期 | 同步锁阻止重复绑定、重复提交；重新绑定仅清理放弃的未验证 TOTP，保留已验证因素。二维码与密钥只存组件内存，不写入日志、数据库或浏览器存储。退出、完成绑定或离开页面时清除。 |
| MFA 数据库策略 | 新迁移对项目、文章、站点设置和媒体写入增加 restrictive 策略，要求管理员成员资格且 JWT 为 `aal2`；项目、文章的草稿及归档读取同样要求 MFA。发布内容、公开站点设置与公开媒体继续可读。迁移应用前检查唯一管理员已绑定验证器。 |
| 闲置退出 | 60 分钟未操作立即撤销编辑器访问，提前 2 分钟提示。刷新 token、页面刷新、切到另一个标签页不会重置计时；真实键盘、鼠标等操作延长会话。跨标签页共享活动时间与过期标记，远程退出卡住时也关闭编辑器。 |
| 登录失败 | 凭据错误使用统一提示，429 提示稍后重试。验证码格式错误、过期、限流和验证服务不可用均有反馈。 |
| 内容输入 | service 写入前验证实际对象、嵌套 JSON、枚举、类型、未知字段、长度与总大小。单次 JSON 最多 1 MiB，标题/slug 200 字符、URL 2048 字符、章节最多 200 项、代码最多 10 万字符。文章中的引号、SQL、HTML 示例作为文本保留。 |
| URL 渲染 | 外链限 HTTP(S)，拒绝脚本协议、协议相对地址、内嵌凭据、控制字符和反斜杠。图片另允许站内绝对路径；邮件链接只接受单个邮箱。旧记录中的非法 URL 不生成可点击链接或图片请求。HTTPS 部署应使用 HTTPS 外部图片，以符合 CSP 与浏览器混合内容限制。 |
| 图片上传 | 保留 5 MiB 与 JPEG/PNG/WEBP 限制；新增文件头、扩展名、MIME 一致性验证和实际解码，最多 4000 万像素。错误在上传前反馈。 |
| 安全响应头 | Workers 静态资源使用 `public/_headers`。启用 nosniff、禁止嵌入、Referrer-Policy、Permissions-Policy 和基础 CSP；完整 CSP 先 Report-Only 验证，另有 `security:enforce-csp` 命令切换为强制执行。后台 HTML 禁止缓存、禁止搜索索引。 |

### 安全边界

前端校验、图片字节检查、闲置计时用于防误操作和浏览器会话保护，可被直接 API 请求绕过。真实授权边界是 Supabase 校验的 JWT、管理员白名单及 PostgreSQL RLS；Storage 服务端继续执行既有文件大小与 MIME 限制。本次没有增加服务端图片内容扫描或数据库 JSON schema 约束。

既有 service 使用 Supabase/PostgREST 的结构化查询与写入，没有把表单内容拼接为任意 SQL。文章代码不应通过删除引号或 SQL 关键字实现所谓“防注入”。React 文本渲染配合 URL 协议检查控制浏览器执行风险。

已签发的 JWT 可能在注销后继续有效至自身到期；浏览器闲置退出不等同于数据库立即吊销 token。RLS 实时核对管理员成员资格，并在新迁移启用后要求 `aal2`。[Supabase 会话说明](https://supabase.com/docs/guides/auth/sessions)

## 线上核对记录（2026-10-04）

| 项目 | 核对结果 |
| --- | --- |
| 部署 | Cloudflare Worker `song`，仅静态资源；正式域名 `songisle.xyz`，生产构建分支为 `main`。非生产分支构建开启，使用 `wrangler versions upload`，不会自动替换生产版本。 |
| Supabase | 项目 `song`，ref `vfgmptjfcfgptaqblydd`，Tokyo，Free，数据库约 11.2 MiB。 |
| 管理员 | `admin_users` 仅 1 人；核对时未绑定已验证 TOTP。 |
| 注册 | 公开注册、匿名登录、手动身份关联均关闭。 |
| 身份提供方 | Email 启用，其他登录提供方关闭；邮箱确认开启。 |
| Auth 限流 | 登录/注册每 IP 每 5 分钟 30 次，token 验证 30 次，刷新 150 次；IP 转发关闭。 |
| MFA 配置 | TOTP 启用；已启用绑定 MFA 用户的 AAL1 会话时长限制，未完成 MFA 的会话最多 15 分钟。 |
| 数据访问 | 5 张相关表 RLS 已启用，既有成员校验和公开读取策略存在；media 为公开桶，服务端 5 MiB，仅 JPEG/PNG/WEBP。 |
| 数据库维护 | PostgreSQL 17.6；控制台没有现存备份。新 MFA 迁移尚未在线应用，PostgreSQL 尚未升级。 |
| 安全顾问 | 当前仅报告未启用泄露密码保护；属于用户排除的密码范围，保留现状。 |

上述线上设置已经符合相应要求，因此核对过程没有重复切换设置。后续存在明显登录滥用时再配置 CAPTCHA；当前不增加 CAPTCHA。

## 分阶段启用

1. 推送 `codex/admin-security`，在 Cloudflare 检查对应提交构建和版本预览。生产分支保持 `main`，不合并 main。控制台若报告 GitHub 集成错误，以新构建的实际状态判断是否需要修复连接。
2. 在真实 Cloudflare 预览中检查 `/zh/`、`/en/`、`/ja/`、后台登录、图片、Google 字体与 Cloudflare Analytics。通过浏览器观察完整 CSP 的 Report-Only 违规；不要通过放宽脚本到 `unsafe-inline` 或 `unsafe-eval` 解决问题。
3. 预览通过后执行 `npm run security:enforce-csp`，重新构建并推送同一分支，再核对 Cloudflare 响应头。CSP 的后端白名单固定为当前 Supabase 项目；更换项目时同步修改。React 动态样式仅由 `style-src-attr 'unsafe-inline'` 允许，脚本没有该例外。
4. 新登录页须在正式域名可用，然后由网站所有者亲自登录、扫描验证器二维码、保存验证器备份并完成 TOTP 验证。不要在对话、截图或提交中发送密码、二维码密钥、验证码。不能在旧登录页仍在生产运行时启用 MFA RLS，否则唯一管理员无法在旧页面完成 MFA。
5. 重新核对唯一管理员存在 `verified` TOTP，再仅应用 `supabase/migrations/20261004070228_enforce_admin_mfa.sql`。线上历史迁移版本为 `20260916115042`、`20260916115056`，与仓库原文件时间戳不同；不要直接 `db push` 重跑历史迁移。使用迁移工具记录这一次新迁移，保留已有表、数据和策略。
6. 验证匿名和非管理员只能读取公开内容；管理员 `aal1` 不可写且不可读草稿；管理员 `aal2` 能管理内容、设置和媒体。运行 Supabase 安全顾问，确认没有新增高危发现，并核对前台公开访问。

迁移的前置检查是最后一道防误启用保护，不能替代第 4 步的登录验证。[Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

`_headers` 适用于静态资源响应。将来增加自定义 Worker、SSR 或 `run_worker_first` 时，应为 Worker 生成的响应另外设置安全头，不能假设静态规则覆盖它们。[Cloudflare Workers 静态资源响应头](https://developers.cloudflare.com/workers/static-assets/headers/)

## PostgreSQL 维护步骤

Supabase 已发布包含安全补丁的 PostgreSQL 17.11 小版本；17.6 的升级单独安排维护窗口。当前没有安装 `ltree`、`btree_gist`，公开表索引均为 B-tree；安装了 `pgcrypto 1.3`。维护前仍要核对加密函数及自定义操作符的实际使用，不能仅凭扩展列表判断兼容性。[Supabase 升级公告](https://supabase.com/changelog?types=breaking-change)

1. 使用已有数据库连接凭据或所有者本地配置的 Supabase CLI 凭据完成只读导出，不为了导出重置密码。当前会话未配置可用于完整备份的 CLI/数据库凭据。
2. 将角色、业务 schema、数据、迁移历史、Auth/Storage 数据及自定义 RLS/触发器纳入可恢复备份；核对 CLI 默认忽略的托管 schema，按官方指南补充。单独下载 Storage 中的实际图片文件，记录对象路径、数量、大小和校验和。数据库备份只有对象元数据，不含实际文件。[备份与恢复指南](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)、[数据库备份范围](https://supabase.com/docs/guides/platform/backups)
3. 备份保存于仓库之外的受保护目录，不提交 Auth 密码哈希、密钥、连接串或验证器数据。核对文件可读、数据数量和 schema/RLS 定义；当前基线为项目 1、文章 0、站点设置 1、媒体对象 1，正式备份时重新计数。
4. 在隔离的兼容 Supabase/PostgreSQL 环境恢复备份，验证记录、索引、成员资格、RLS 与媒体文件。测试管理员登录时由所有者处理凭据。只有恢复验证通过，才安排生产升级。
5. 在所有者指定的维护窗口暂停后台写入，再取最终备份，通过 Supabase 控制台升级到可用的修补版本。观察项目恢复健康，验证公开查询、MFA、编辑保存、媒体，以及安全顾问。升级失败时按已验证的恢复步骤处理，不盲目重试。

备份与恢复未完成时，不将数据库升级标记为已实施；Free 项目需要手动导出备份。[Supabase 数据库备份](https://supabase.com/docs/guides/platform/backups)

## 验证

```powershell
npm test
npm run lint
npm run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:WORK_COVER_IMAGE = Join-Path (Get-Location) 'public/assets/work/work-project-cover-fuji.webp'
npm run test:e2e
npm run test:security
npm audit --omit=dev --registry=https://registry.npmjs.org
```

本次实现通过 90 项单元与 PostgreSQL 策略测试、38 项浏览器回归测试、6 项生产构建安全头测试。lint 无警告，TypeScript/生产构建成功，生产依赖审计 0 项漏洞。

策略测试在 PGlite 执行真实 PostgreSQL RLS，包括未绑定验证器时迁移拒绝、`aal1`/`aal2` 权限矩阵及意外 permissive 策略无法绕过限制。浏览器测试使用受控后端响应，覆盖真实 SDK 的 MFA 绑定、挑战、并发、失效、限流、深链恢复、闲置退出和跨标签页。

安全头测试使用生产构建，在本地模拟 Cloudflare `_headers`；分别验证完整 CSP 的 Report-Only 和强制模式、多语言页面、绑定二维码、内联脚本阻断和 iframe 阻断。安全测试输出独立于常规浏览器测试，避免并行清理冲突。这些测试不能替代真实 Cloudflare 部署和线上 Supabase 迁移验证。
