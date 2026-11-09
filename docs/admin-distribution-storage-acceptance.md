# 内容分发 M1 隔离环境验收

需要 Docker、Supabase CLI、`psql`、PowerShell 7、仓库的 Node 依赖和 TOTP 验证器。以下命令使用一次性的本地 Supabase 实例和临时账号。先确认 54321 至 54323 为该实例的端口。

## 初始化隔离实例

在功能分支的仓库根目录运行。临时目录没有仓库迁移，因此可以先创建并验证管理员的 MFA，满足既有迁移的前置条件。

```powershell
$distributionLocalStack = Join-Path ([System.IO.Path]::GetTempPath()) "song-dist-review-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $distributionLocalStack
Push-Location $distributionLocalStack
supabase init
Pop-Location
```

编辑该临时目录中的 `supabase/config.toml`，把现有 TOTP 区段的两项开关设为 `true`。[本地 MFA 配置](https://supabase.com/docs/guides/local-development/cli/config)

```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

```powershell
Push-Location $distributionLocalStack
supabase start
supabase status
docker ps --format '{{.Names}} {{.Image}}' --filter 'name=supabase_storage'
Pop-Location

$distributionLocalDb = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
psql -X -v ON_ERROR_STOP=1 $distributionLocalDb -f 'supabase/migrations/20260916000000_initial_schema.sql'
psql -X -v ON_ERROR_STOP=1 $distributionLocalDb -f 'supabase/migrations/20260916044953_fix_backend_v1.sql'
```

打开本地 Studio `http://127.0.0.1:54323`，在 Authentication 创建并确认临时用户 `distribution-review@example.invalid`。将该用户登记为本地唯一管理员，确认命令输出 `INSERT 0 1`。

```powershell
psql -X -v ON_ERROR_STOP=1 $distributionLocalDb -c "insert into public.admin_users(user_id) select id from auth.users where email = 'distribution-review@example.invalid'"
$env:DISTRIBUTION_LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:DISTRIBUTION_LOCAL_ANON_KEY = Read-Host '本地 publishable/anon key'
$env:VITE_SUPABASE_URL = $env:DISTRIBUTION_LOCAL_SUPABASE_URL
$env:VITE_SUPABASE_ANON_KEY = $env:DISTRIBUTION_LOCAL_ANON_KEY
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

在 `http://127.0.0.1:5176/admin/login` 登录临时用户，绑定 TOTP 并进入后台。保持浏览器登录，在另一个仓库终端应用剩余迁移。每次 `psql` 成功后再执行下一条。

```powershell
$distributionLocalDb = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
psql -X -v ON_ERROR_STOP=1 $distributionLocalDb -f 'supabase/migrations/20261004093439_enforce_admin_mfa.sql'
psql -X -v ON_ERROR_STOP=1 $distributionLocalDb -f 'supabase/migrations/20261007052225_add_private_analytics.sql'
psql -X -v ON_ERROR_STOP=1 $distributionLocalDb -f 'supabase/migrations/20261108173132_add_private_distribution_m1.sql'
psql -X -v ON_ERROR_STOP=1 $distributionLocalDb -c "notify pgrst, 'reload schema'"
```

## 运行真实 API 验收

在本地后台页面的开发者工具控制台复制临时 aal2 会话的 access token。使用刚通过 TOTP 的会话。

```js
const { supabase } = await import('/src/lib/supabase.ts');
const { data: { session } } = await supabase.auth.getSession();
copy(session.access_token);
```

回到第二个终端执行。脚本只接受环回地址和 `authenticated` 的 aal2 JWT。

```powershell
$env:DISTRIBUTION_LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:DISTRIBUTION_LOCAL_ANON_KEY = Read-Host '本地 publishable/anon key'
$env:DISTRIBUTION_LOCAL_AAL2_TOKEN = Read-Host '临时 aal2 access token' -MaskInput
node scripts/verify-distribution-local.mjs
Remove-Item Env:DISTRIBUTION_LOCAL_AAL2_TOKEN
```

脚本通过真实 SDK 上传并列出 WebP，用 Storage 对象 UUID 保存分发稿件。首次直接 PATCH 归档须停用账号，后续绕过界面进行恢复和改名须返回 `55000`，嵌套查询须仍读到两个关联。被引用时 Storage `remove([path])` 须失败，同时对象 UUID 和下载字节保持一致。解除素材引用后，再调用 `remove` 须成功，列表中无原对象，带新查询参数的下载须返回对象不存在。两次删除都走媒体库使用的 Storage API。[官方对象删除说明](https://supabase.com/docs/guides/storage/management/delete-objects)

保留脚本结果、CLI 版本和 Storage 镜像版本。成功后脚本会删除测试草稿，临时归档账号随隔离实例清理。在第一终端停止 Vite 后，可以从刚创建的临时目录执行 `supabase stop --no-backup`，清除该实例的数据。[本地 CLI](https://supabase.com/docs/reference/cli/supabase-start)
