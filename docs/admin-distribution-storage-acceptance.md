# 内容分发 M1 隔离环境验收

需要可用的本地 Docker Linux 引擎、Supabase CLI、PowerShell 7、仓库的 Node 依赖和 TOTP 验证器。以下步骤使用数据库容器自带的 `psql`。先确认 Docker context 指向本机，并为隔离实例保留 54321 至 54323。

```powershell
docker context inspect --format '{{(index .Endpoints "docker").Host}}'
docker info --format '{{.OSType}} {{.ServerVersion}}'
supabase --version
Get-Command psql -ErrorAction SilentlyContinue
node --version
$PSVersionTable.PSVersion
```

## 初始化隔离实例

在新开的终端 A 中进入功能分支的仓库根目录。临时目录没有仓库迁移，因此可以先创建并验证管理员的 MFA，满足既有迁移的前置条件。

```powershell
$distributionProjectId = "song-dist-review-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$distributionLocalStack = Join-Path ([System.IO.Path]::GetTempPath()) $distributionProjectId
New-Item -ItemType Directory -Path $distributionLocalStack
$env:SUPABASE_PROJECT_ID = $distributionProjectId
$env:SUPABASE_HOME = Join-Path $distributionLocalStack 'cli-home'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
supabase init --workdir $distributionLocalStack
```

编辑该临时目录中的 `supabase/config.toml`，把现有 TOTP 区段的两项开关设为 `true`。[本地 MFA 配置](https://supabase.com/docs/guides/local-development/cli/config)

```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

```powershell
supabase start --workdir $distributionLocalStack
if ($LASTEXITCODE -ne 0) { throw '隔离 Supabase 启动失败' }
docker ps --filter "name=$distributionProjectId" --format '{{.Names}} {{.Image}}'
$distributionDb = "supabase_db_$distributionProjectId"
if ((docker ps --filter "name=^/$distributionDb$" --format '{{.Names}}') -ne $distributionDb) {
  throw '找不到本次隔离实例的 PostgreSQL 容器'
}

docker exec $distributionDb psql --version
docker exec $distributionDb psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'show server_version'
function Invoke-DistributionLocalMigration([string]$Migration) {
  $distributionSql = Get-Content -LiteralPath $Migration -Raw -ErrorAction Stop
  $distributionSql | docker exec -i $distributionDb psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { throw "迁移失败 $Migration" }
}
Invoke-DistributionLocalMigration 'supabase/migrations/20260916000000_initial_schema.sql'
Invoke-DistributionLocalMigration 'supabase/migrations/20260916044953_fix_backend_v1.sql'
```

从本次容器列表记录 Storage、PostgREST、GoTrue 镜像版本。

打开本地 Studio `http://127.0.0.1:54323`，在 Authentication 创建并确认临时用户 `distribution-review@example.invalid` 和 `distribution-member@example.invalid`。将前者登记为本地唯一管理员，确认命令输出 `INSERT 0 1`。

```powershell
docker exec $distributionDb psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "insert into public.admin_users(user_id) select id from auth.users where email = 'distribution-review@example.invalid'"
```

在终端 B 的仓库根目录启动 Vite。使用该隔离实例的 publishable 或 anon key。

```powershell
$env:DISTRIBUTION_LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:DISTRIBUTION_LOCAL_ANON_KEY = Read-Host '本地 publishable/anon key'
$env:VITE_SUPABASE_URL = $env:DISTRIBUTION_LOCAL_SUPABASE_URL
$env:VITE_SUPABASE_ANON_KEY = $env:DISTRIBUTION_LOCAL_ANON_KEY
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

在 `http://127.0.0.1:5176/admin/login` 登录临时管理员，绑定 TOTP 并进入后台。保持浏览器登录，回到终端 A 应用剩余迁移。

```powershell
Invoke-DistributionLocalMigration 'supabase/migrations/20261004093439_enforce_admin_mfa.sql'
Invoke-DistributionLocalMigration 'supabase/migrations/20261007052225_add_private_analytics.sql'
Invoke-DistributionLocalMigration 'supabase/migrations/20261108173132_add_private_distribution_m1.sql'
docker exec $distributionDb psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -c "notify pgrst, 'reload schema'"
```

## 运行真实 API 验收

准备三种临时会话。密码和验证码只在本机操作。每复制一个 access token，就在终端 A 通过对应的 `Read-Host -MaskInput` 保存到本次进程环境。

1. **管理员 aal2**。用完成 TOTP 验证的本地后台会话。通过本地页面的开发者工具复制 token，保存为 `DISTRIBUTION_LOCAL_AAL2_TOKEN`。
2. **同一管理员 aal1**。管理员完成初次 TOTP 绑定后，在独立浏览器会话重新输临时密码，停在验证码页面。用相同命令复制 token，保存为 `DISTRIBUTION_LOCAL_AAL1_TOKEN`。Supabase 在初次验证新因子时可能注销其他会话，因此先完成绑定，再创建 aal1 会话。[Supabase MFA enroll](https://supabase.com/docs/reference/javascript/auth-mfa-enroll)

```js
const { supabase } = await import('/src/lib/supabase.ts');
const { data: { session } } = await supabase.auth.getSession();
copy(session.access_token);
```

3. **普通用户 aal2**。在独立的本地浏览器会话打开 `http://127.0.0.1:5176/admin/login`，使用以下命令直接走本地 Auth SDK。扫描页面显示的临时二维码后再运行第二段。将结果保存为 `DISTRIBUTION_LOCAL_NON_ADMIN_AAL2_TOKEN`。

```js
const { supabase } = await import('/src/lib/supabase.ts');
const memberLogin = await supabase.auth.signInWithPassword({
  email: 'distribution-member@example.invalid',
  password: prompt('隔离实例普通用户的临时密码'),
});
if (memberLogin.error) throw memberLogin.error;
const factor = await supabase.auth.mfa.enroll({ factorType: 'totp' });
if (factor.error) throw factor.error;
const qr = new Image();
qr.alt = '隔离实例普通用户的临时 TOTP 二维码';
qr.src = factor.data.totp.qr_code;
qr.style.cssText = 'position:fixed;top:1rem;left:1rem;z-index:10000;background:white;padding:1rem';
document.body.append(qr);
```

```js
const verified = await supabase.auth.mfa.challengeAndVerify({
  factorId: factor.data.id,
  code: prompt('普通用户的六位验证码'),
});
if (verified.error) throw verified.error;
copy(verified.data.access_token);
qr.remove();
```

在终端 A 完成录入并运行脚本。脚本只请求同一个环回端点，通过 GoTrue 校验三份 JWT，再通过 PostgREST 检查各会话的管理员资格。

```powershell
$env:DISTRIBUTION_LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:DISTRIBUTION_LOCAL_ANON_KEY = Read-Host '本地 publishable/anon key'
$env:DISTRIBUTION_LOCAL_AAL2_TOKEN = Read-Host '临时管理员 aal2 token' -MaskInput
$env:DISTRIBUTION_LOCAL_AAL1_TOKEN = Read-Host '同一临时管理员 aal1 token' -MaskInput
$env:DISTRIBUTION_LOCAL_NON_ADMIN_AAL2_TOKEN = Read-Host '临时普通用户 aal2 token' -MaskInput
try {
  node scripts/verify-distribution-local.mjs
  if ($LASTEXITCODE -ne 0) { throw "隔离验收失败，退出码 $LASTEXITCODE" }
} finally {
  Remove-Item Env:DISTRIBUTION_LOCAL_AAL2_TOKEN, Env:DISTRIBUTION_LOCAL_AAL1_TOKEN, Env:DISTRIBUTION_LOCAL_NON_ADMIN_AAL2_TOKEN
}
```

脚本通过真实 SDK 上传并列出 WebP，用 Storage 对象 UUID 保存分发稿件。匿名请求访问四张分发表及写入时须收到权限拒绝。普通用户 aal2 和管理员 aal1 的读取、PATCH 和 DELETE 须得到零行，INSERT 和保存 RPC 须返回权限错误。管理员 aal2 须可以读取和保存。首次直接 PATCH 归档须停用账号，后续恢复和改名须返回 `55000`，嵌套查询须仍读到两个关联。

被引用时 Storage `remove([path])` 须失败，同时对象 UUID 和下载字节保持一致。解除素材引用后，再调用 `remove` 须成功，列表中无原对象，带新查询参数的下载须返回对象不存在。两次删除都走媒体库使用的 Storage API。[官方对象删除说明](https://supabase.com/docs/guides/storage/management/delete-objects)

保留脚本结果、CLI 版本、PostgreSQL 服务端版本及 Storage、PostgREST、GoTrue 镜像版本。成功后脚本会删除测试草稿，临时归档账号随隔离实例清理。停止终端 B 的 Vite 后，在终端 A 核对临时目录及项目 ID，执行 `supabase stop --workdir $distributionLocalStack --no-backup`，清除该实例的卷，再移除该临时目录。用 `docker ps -a --filter "name=$distributionProjectId"` 检查该实例的容器已移除。[本地 CLI](https://supabase.com/docs/reference/cli/supabase-stop)
