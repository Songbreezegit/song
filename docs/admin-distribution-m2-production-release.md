# 松屿内容分发 M2 正式发布回执

2026-11-12（北京时间），松屿内容分发 M2 已自动发布至 `songisle.xyz`，新 Worker 承接 100% 流量。公开页面、静态产物、生产项目、匿名权限及数据库只读冒烟通过。2026-11-13，管理员完成正式站 TOTP，随后通过真实会话核对 M1 页面和 M2 缺失记录提示。

本次获批动作包括 PR #11 转为 Ready、一次 merge commit 合入 `main`、该推送触发的 Cloudflare 正式部署，以及严重故障时恢复原 Worker。最终七项预检通过后执行，复核时生产数据库两条 M2 迁移的存储 SQL 与审查哈希一致。 [批准依据与预检方案](https://github.com/Songbreezegit/song/blob/e91fe126c1747ad5080f80efc969ae42ccb14f5d/docs/admin-distribution-m2-production-plan.md#cloudflare-正式发布检查)

| 事项 | 回执 |
| --- | --- |
| 功能与合并 | 验收版本 `91c96617043eb12ac1d04e0d48d1ed7ef4c1fb69`。PR #11 于 23:28:54 以 merge commit 合入 `main`，新 HEAD 为 `eb39f6fc8ed08fbcfae8fd4bdb7bf7da0efecf2e`。父提交分别为 `ae35d4a39b361ce0cf773e357d652e3aa18142ba` 和验收版本，实际代码树 `8e6c0de31394589b8d23111fcfe6f9a7fd93febd` 与验收版本相同。 |
| 生产构建 | Cloudflare Builds `ae4be588-9b6d-47de-9f45-a1e67ee131a4` 对应新 `main`，执行 `npm run build` 与 `npx wrangler deploy`，23:29:44 返回成功。 |
| Worker 与流量 | `song` 的版本 `7b30d14a-0049-4fb7-b517-49d8fc7e8f58` 为 Active deployment，正式域 `songisle.xyz` 流量 100%。正式域和该版本 URL 的入口脚本均为 `/assets/index-Cu-kXTQO.js`。 |
| Supabase 与迁移 | 产物指向生产 `song`（`vfgmptjfcfgptaqblydd`），公开客户端键与获批配置一致。生产记录 `20261111162431`、`20261111163231` 的 SQL 哈希、RLS、RPC、约束及触发器在发布前后只读核对一致。 |
| 回退目标 | `12ca0ad9-52eb-4d37-83c7-cb3f12f5ea61`。发布前已验证旧版 URL 的 HTML 与脚本返回 200。触发严重故障时，按获批方案恢复这个版本的 100% 流量，保留数据库的已验收迁移。 |

[PR #11](https://github.com/Songbreezegit/song/pull/11) · [生产 main 的构建检查](https://github.com/Songbreezegit/song/commit/eb39f6fc8ed08fbcfae8fd4bdb7bf7da0efecf2e/checks) · [数据库迁移回执](https://github.com/Songbreezegit/song/blob/e91fe126c1747ad5080f80efc969ae42ccb14f5d/docs/admin-distribution-m2-production-plan.md#生产迁移执行回执)

## 发布后冒烟

| 范围 | 结果 |
| --- | --- |
| 正式页面与资源 | PASS。`/`、`/en/work`、`/ja/work`、`/admin/login`、`/admin/distribution`、`/admin/distribution/posts`、`/admin/distribution/accounts`、`/admin/media` 的 HTML 均返回 200，强制 CSP 允许生产 Supabase 域名。主 JS、CSS、后台入口与两份 M2 页面脚本均返回 200。首次本机 TLS 连接中断，完整重试通过。 |
| 公开页面浏览器 | PASS。桌面宽度 1588 px 的作品页显示公开项目和封面。打开 LizhangApp 详情并用 `/en/work?project=lizhang` 直达重载，标题显示正常。界面从英语切到 `/ja/work`。在 390×844 视口下，内容宽 375 px，项目与封面加载且无横向溢出。 |
| 匿名边界 | PASS。未登录直达正式后台跳转到 `/admin/login`。使用正式产物的公开客户端配置，已发布项目 HEAD 返回 200 且计数为 1，M1 四张及 M2 两张私有表均返回 401。 |
| M1 与 M2 数据库 | PASS。仓库两份只读安全冒烟各通过五种模拟身份条件，包括管理员 `aal1` 和 `aal2`。两条迁移及数据库对象发布后已复核。查询事务未写业务数据。 |
| 管理员真实 MFA | PASS。2026-11-13（北京时间），管理员在正式站完成 TOTP 后，真实会话进入 `/admin/distribution` 并读取受保护页面。浏览器加载的入口为本次发布的 `/assets/index-Cu-kXTQO.js`。 |
| M1 正式后台 | PASS。分发概览、内容库、矩阵账号和媒体库均读取成功。内容库和矩阵账号显示空态，媒体库列出 2 个文件。 |
| M2 正式后台 | PASS，覆盖授权路由和缺失记录处理。使用不存在的内容 ID 直接打开并刷新平台版本页，均显示缺失内容提示。编辑器也显示缺失稿件提示及返回入口。生产内容库为空，含数据的编辑、同步和导出由既有真实 Staging 验收覆盖。 |

本回执分支从发布后的 `main` 创建。正式后台补验使用只读操作。 [原发布方案与备份记录](https://github.com/Songbreezegit/song/blob/e91fe126c1747ad5080f80efc969ae42ccb14f5d/docs/admin-distribution-m2-production-plan.md)
