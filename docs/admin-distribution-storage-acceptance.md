# 内容分发 M1 隔离环境验收

## 云端 Staging

云端 runner 固定使用本轮创建的 `song-staging`。项目 Ref 为 `uartrtcmskyuqxawjqlx`，组织为 `hzrxoowmgbfkxtechkoz`，区域为 `ap-northeast-1`。启动参数必须显式传入 Ref 和完全匹配的 HTTPS origin。每次云端写入前，runner 会通过 Management API 检查项目身份和 `ACTIVE_HEALTHY`。拒绝两个保护 Ref、其他项目和跨域重定向。[本轮云端记录](admin-distribution-integration-report.md)

使用只限此项目的短期 Scoped PAT，权限为 Project Settings 的 Read 和 API Keys 的 Read-write。打开新的 PowerShell 终端，在功能分支仓库根目录执行。令牌在隐藏提示输入，仅保存在当前进程环境。runner 会从已验证项目读取 publishable key，创建本轮专用的临时 secret key，并仅以它初始化和清理 Auth 用户。权限与 Storage 探针使用 GoTrue 实际签发的用户会话。[Supabase PAT 权限](https://supabase.com/docs/guides/platform/personal-access-tokens)

```powershell
$env:DISTRIBUTION_STAGING_PROJECT_REF = 'uartrtcmskyuqxawjqlx'
$env:DISTRIBUTION_STAGING_API_URL = 'https://uartrtcmskyuqxawjqlx.supabase.co'
$stagingPat = Read-Host 'Staging scoped PAT' -AsSecureString
$env:DISTRIBUTION_STAGING_MANAGEMENT_TOKEN = [System.Net.NetworkCredential]::new('', $stagingPat).Password
try {
  node scripts/verify-distribution-staging.mjs
  if ($LASTEXITCODE -ne 0) { throw "Staging 验收未通过，退出码 $LASTEXITCODE" }
} finally {
  Remove-Item Env:DISTRIBUTION_STAGING_MANAGEMENT_TOKEN
  $stagingPat.Dispose()
}
```

runner 在三个 SQL 检查点输出 `NEXT`。在另一个授权管理会话完成对应操作。对每个写操作重新核对目标 Ref、名称、组织、区域和状态，再在 runner 的标准输入发送该检查点名称。

| 检查点 | 发送前应实际完成的操作 |
| --- | --- |
| `admin-registered` | 已应用前两条基础迁移。从 runner 记录中取得本次管理员 UUID 和 run ID，按 UUID、临时邮箱及 `auth.users.raw_app_meta_data` 中的 `distribution_staging_run_id` 核对该用户。仅登记管理员 A，确认 `admin_users` 恰有一行，普通用户 B 无登记。 |
| `schema-ready` | 已通过真实 TOTP 并核对管理员因子为 verified。依序应用 MFA、analytics、distribution 迁移，已执行的迁移从管理面历史确认。检查策略、约束、invoker 和 FORCE RLS，刷新 PostgREST schema cache，执行只读 smoke。 |
| `database-clean` | 已通过 API 和界面用例，runner 已删自己的草稿和 WebP。使用它列出的两个账号 UUID 与精确 run ID 标记核对记录归属，再删除这两条归档测试记录。确认结果包含且仅包含该两个 UUID。 |

浏览器冒烟在 `127.0.0.1:5198` 启动 Vite，配置来自进程内的 Staging 地址和公开密钥。浏览器只转发来自 Staging 的实际响应，限制访问本地预览和该项目。UI 检查结束后停止 Vite。

runner 在正常完成、探针失败或收到可处理的中断信号后尝试清理本轮凭据。它先按 UUID、临时邮箱和 Auth 管理端写入的 run ID 删除用户，再按 UUID 和含完整 run ID 的密钥说明撤销临时 Secret API Key。每次删除前重新核对项目身份。创建响应丢失时，以预先记录的用户 UUID 或唯一完整的密钥标记找回资源。

失败后停止后续探针。若进程被强制终止、服务不可达或资源归属无法确认，按日志中的 Project Ref、run ID 和资源 UUID 记录残留。人工清理前应核对同样的归属字段。退出后用管理面查询核对临时数据，保留 Staging 项目、已应用的 schema 和脱敏结果，清除本地凭据缓存。

## 本地隔离环境

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
