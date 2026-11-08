# 内容分发 M1 交付记录

日期：2026-11-09（Asia/Shanghai）。基线 `38d27ae2f43764e6a97b0a879d17aac1edcd3966`；功能分支 `codex/distribution-m1`。

本次在独立 worktree 开发，主工作区原有页脚、导航、国际化等未提交修改保持原样。现有 React + TypeScript + Supabase 架构和 `/admin` 管理系统继续使用。

## 审查入口

- [功能与架构](admin-distribution-m1.md)
- [SQL、权限矩阵、迁移及回滚审查](admin-distribution-security.md)
- [五个开源项目研究及 M2–M4 方案](admin-distribution-research.md)
- 迁移：`supabase/migrations/20261108173132_add_private_distribution_m1.sql`
- 回滚：`supabase/rollbacks/distribution_m1.sql`
- 只读上线检查：`supabase/tests/distribution_security_smoke.sql`

## 验证记录

基线 lint、build 和 164 项单元测试通过。首次默认 Windows TEMP 路径导致 Vitest SSR 缓存 ENOENT；按现有仓库文档为当前进程指定 `node_modules/.cache/admin-unit-tmp` 后，原断言全部通过。

最终命令结果如下；浏览器测试使用无头 Microsoft Edge，运行实际 Supabase SDK，后端为受控 HTTP 响应；SQL 测试在 PGlite 执行真实 PostgreSQL 权限逻辑。

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过，无警告 |
| `npm run build` | TypeScript 与 Vite 生产构建通过；保留基线已有的主包 >500 kB 提示 |
| `npm test` | 16 个文件、232 项全部通过；包含新增 61 项输入 / service / PostgreSQL 测试 |
| `npm run test:e2e` | 202 项全部通过，12.0 分钟，无失败、跳过或重试；包含分发专属 18 项、扩展主题用例 10 项 |
| `npm run test:security` | 12 项全部通过，34.4 秒；Report-Only / enforced 均验证分发编辑器、媒体、圆形主题切换及原子保存 |
| 截图补充复查 | 改用仓库真实 WebP 素材后，保留全部断言重跑 1 项、30 个页面状态，通过；20 张截图已逐文件校验复制 |

SQL 的归档时间最终改由服务端规范化，随后完整重跑 232 项单元/SQL 测试，全部通过。该收尾不改变浏览器产物。生产 CSP 的分发用例在上述完整 E2E 后补充并执行，原有安全断言全部保留。

初期三项新增浏览器检查曾失败：HEAD 计数 fixture 缺少 `Access-Control-Expose-Headers: content-range`；错误检查先读 HEAD 导致详细错误丢失；取消刷新用例的自动化调用未保留草稿。已补齐与浏览器计数协议一致的 fixture，优先读取 SELECT 的详细错误，并采用原编辑器测试使用的 `window.location.reload()` 验证取消刷新。重跑三项及随后完整 202 项均通过，未降低断言。

复现方式：

```powershell
npm ci --registry=https://registry.npmjs.org
npm run lint
npm run build
$env:TEMP = Join-Path (Get-Location) 'node_modules/.cache/admin-unit-tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
npm test
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:WORK_COVER_IMAGE = Join-Path (Get-Location) 'public/assets/work/work-project-cover-fuji.webp'
npm run test:e2e
npm run test:security
```

新增浏览器验证保留错误、重试、重复提交、响应丢失、旧版本冲突、未保存取消离开、账号归档、数据关联、列表视图恢复、离开后的迟到响应及桌面/移动主题断言。原导航契约从五个入口更新为六个精确入口；原主题测试扩展至全部分发页面，没有删除或弱化既有断言。

## UI 截图

[20 张桌面/移动端、深浅色截图索引](distribution/screenshots/README.md) 已保存。截图均来自本地实际组件和明确的测试数据，数值用于验收布局，不代表生产账号/内容统计。概览另有真实查询契约及空数据/读取错误测试。

已实际查看概览、内容编辑器、账号卡片的桌面和移动截图；未发现遮挡、截断失控或文档横向溢出。长文本另在 320 / 375px、两种主题下检查；完整截图在 1440 / 390px 保存，并验证 965px 紧凑布局。没有浏览器运行错误或截图用例的 console error。

## 已知风险与待操作

1. 生产迁移、正式部署和 main 合并均未执行。审查并明确批准 SQL 后，安排隔离 Supabase 集成验证，再执行批准的生产步骤。
2. 尚未验证生产 GoTrue/PostgREST/Storage 组合。尤其需要核对 Storage 受引用文件删除、嵌套查询关系缓存、真实 MFA CRUD 和安全顾问。
3. 现有媒体库仅支持图片。视频内容先记录文案与已有封面，视频上传/转码及平台适配留待后续。
4. 现有 BrowserRouter 没有全局 history 阻断。新增编辑器覆盖关闭/刷新及链接离开确认；浏览器前进/后退前应主动保存。草稿不在浏览器本地持久化。
5. 列表在分批完整读取后于浏览器检索，适合当前个人规模；增长后需要服务端检索及项目/媒体选择分页。
6. 依赖锁文件与基线相同，没有新增依赖。`npm audit` 报告既有 4 项（2 high、2 moderate），`--omit=dev` 仍报告 2 high（Vite、source-map-js；现有依赖树包含构建插件的依赖/peer）。Vitest / @vitest/mocker 的公告另见完整审计。需要单独升级锁文件并回归，不能把 M1 测试通过解释为依赖无漏洞。

审计来源：[source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)、[Vite Windows 检查绕过](https://github.com/advisories/GHSA-587h-7wmj-h5pm)、[Vitest mock 注册](https://github.com/advisories/GHSA-qxg6-89mg-rqv8)、[Vitest Windows 路径](https://github.com/advisories/GHSA-xp26-3454-mjgp)。审计只读执行，未运行 audit fix。

## 修改文件范围

相对基线共 56 个文件（含 20 张 PNG）。原认证实现、项目/文章/媒体 service、历史迁移、依赖锁文件及生产响应头未改动。

```text
docs/admin-architecture.md
docs/admin-content-workspace.md
docs/admin-distribution-delivery.md
docs/admin-distribution-m1.md
docs/admin-distribution-research.md
docs/admin-distribution-security.md
docs/admin-security.md
docs/distribution/screenshots/README.md
docs/distribution/screenshots/distribution-desktop-accounts-dark.png
docs/distribution/screenshots/distribution-desktop-accounts-light.png
docs/distribution/screenshots/distribution-desktop-accounts-new-dark.png
docs/distribution/screenshots/distribution-desktop-accounts-new-light.png
docs/distribution/screenshots/distribution-desktop-overview-dark.png
docs/distribution/screenshots/distribution-desktop-overview-light.png
docs/distribution/screenshots/distribution-desktop-posts-dark.png
docs/distribution/screenshots/distribution-desktop-posts-editor-dark.png
docs/distribution/screenshots/distribution-desktop-posts-editor-light.png
docs/distribution/screenshots/distribution-desktop-posts-light.png
docs/distribution/screenshots/distribution-mobile-accounts-dark.png
docs/distribution/screenshots/distribution-mobile-accounts-light.png
docs/distribution/screenshots/distribution-mobile-accounts-new-dark.png
docs/distribution/screenshots/distribution-mobile-accounts-new-light.png
docs/distribution/screenshots/distribution-mobile-overview-dark.png
docs/distribution/screenshots/distribution-mobile-overview-light.png
docs/distribution/screenshots/distribution-mobile-posts-dark.png
docs/distribution/screenshots/distribution-mobile-posts-editor-dark.png
docs/distribution/screenshots/distribution-mobile-posts-editor-light.png
docs/distribution/screenshots/distribution-mobile-posts-light.png
src/admin/AdminApp.tsx
src/admin/components/AdminLayout.tsx
src/admin/features/distribution/DistributionChrome.tsx
src/admin/features/distribution/DistributionMediaPicker.tsx
src/admin/features/distribution/distribution.css
src/admin/features/distribution/distributionForm.ts
src/admin/features/distribution/useDistributionCollection.ts
src/admin/features/distribution/useDistributionEditor.ts
src/admin/pages/AdminDistribution.tsx
src/admin/pages/AdminDistributionAccountEditor.tsx
src/admin/pages/AdminDistributionAccounts.tsx
src/admin/pages/AdminDistributionPostEditor.tsx
src/admin/pages/AdminDistributionPosts.tsx
src/admin/routes.ts
src/lib/distributionValidation.ts
src/services/distributionService.ts
src/types/distribution.ts
supabase/migrations/20261108173132_add_private_distribution_m1.sql
supabase/rollbacks/distribution_m1.sql
supabase/tests/distribution_security_smoke.sql
tests/admin-routes.test.ts
tests/distribution-rls.test.ts
tests/distribution-service.test.ts
tests/distribution-validation.test.ts
tests/e2e/admin-theme.spec.ts
tests/e2e/distribution.spec.ts
tests/e2e/fixtures/distribution.ts
tests/security-browser/headers.spec.ts
```
