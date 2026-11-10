# 内容分发 M2 Staging 迁移通道复核

迁移 1 已通过获批的官方单条迁移 API 执行并读回核验，平台登记版本为 `20261110174923`。下面保留此前通道调查和第 1 条完整命令供审查。第 2 条另行审批。[迁移 2 完整命令与回退](admin-distribution-m2-staging-migration-2.md)

## 迁移前的只读证据

2026-11-11 复核的目标是 `song-staging`（`uartrtcmskyuqxawjqlx`），状态为 `ACTIVE_HEALTHY`，PostgreSQL 为 17.11。远端历史共六条，其中分发 M1 为 `20261109153506 add_private_distribution_m1` 和 `20261109161000 report_distribution_version_conflicts`。M1 四张分发表仍强制 RLS，保存 RPC 仍使用 `PT409`。两条 M2 记录、两张 M2 表、函数及触发器均不存在。

| 诊断 | 结果 | 证据 |
| --- | --- | --- |
| 操作审批超时 | 已确认 | 第一次和第三次 `apply_migration` 返回 `expired` / `INVALID_ARGUMENT`，确认时限为两分钟。Supabase MCP 的公开实现先处理 SQL 确认，再调用迁移执行层。此次证据无法判断确认卡是否在客户端正常显示。 |
| MCP 请求传输中断 | 已确认 | 第二次是工具传输层发送 HTTP 请求失败，未取得 Supabase 迁移或 PostgreSQL 回执。 |
| SQL 执行超时 | 未发现 | 三次均没有 SQL 执行超时回执。2026-11-11 00:44–01:01（北京时间）的 Staging 日志中有 11 条 PostgreSQL 事件，匹配 M2 的 `57014` 和 statement timeout 事件均为零。 |
| 数据库返回实际错误 | 未发现 | 同一窗口匹配 M2 的 PostgreSQL 错误为零，三次均未返回 PostgreSQL SQLSTATE。每次事后与本轮只读回查均未见 M2 对象或记录。 |

托管日志只反映已捕获事件，不能用零匹配确定请求在客户端内部的传递位置。[Supabase MCP 确认与执行顺序](https://github.com/supabase/mcp/blob/main/packages/mcp-server-supabase/src/tools/database-operation-tools.ts) · [托管日志字段和采集限制](https://supabase.com/docs/guides/observability/log-field-reference)

## 候选执行通道

| 通道 | 本轮结论 |
| --- | --- |
| 当前 Supabase MCP | 读取可用。写入独立确认已有两次过期，本轮未重发写入。 |
| Dashboard SQL Editor 或受控裸 SQL | 可执行 SQL，原生迁移历史不会随执行登记，因此不采用。[迁移历史说明](https://supabase.com/docs/guides/deployment/database-migrations) |
| Supabase CLI 3.0.0 `migration up` | 本机帮助显示它应用目标的待执行迁移集合，当前命令没有单版本选择参数，因此不在现有工作树使用。 |
| Supabase Management API 单条迁移 | 候选通道。`POST /v1/projects/{ref}/database/migrations` 接收一份 `query` 和 `name`，由平台登记历史，支持 `Idempotency-Key`。请求体没有自定义版本字段。远端回执按实际版本、名称和完整 SQL 哈希记账。[官方端点](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [官方 OpenAPI](https://api.supabase.com/api/v1-json) |

已交接的 `song-staging-m2-review` Scoped PAT 仍能读取项目和 API Keys。用同一令牌读取该项目的迁移历史得到 HTTP 403。单条迁移的写入需要 `Migrations Read-write`。验收继续使用现有令牌。只有批准改走单条迁移 API，且现有令牌仍缺迁移权限时，才交接一枚仅限该项目、仅有 `Migrations Read-write` 的短效 Scoped PAT。[Scoped PAT 权限表](https://supabase.com/docs/guides/platform/personal-access-tokens#permission-scopes)

## 第 1 条的审批命令

审查基线 `3acd6f8d7d0124349f42922ba4b25f7b4d4e972a`。两条迁移均保留文件原始 LF 字节及其显式事务。

| 顺序 | 完整 SQL 与 Git SHA-256 | 影响 |
| --- | --- | --- |
| 1 | [平台稿基础](../supabase/migrations/20261110100401_add_distribution_platform_variants.sql) · `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174` | 新增两张表及约束、索引、五个触发器、强制 RLS 与三个 Invoker RPC。 |
| 2 | [字段级核对增量](../supabase/migrations/20261110114036_review_distribution_source_fields.sql) · `acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21` | 新增一个字段与约束，更新同步入口及触发器函数，新增保留和版本确认 RPC。第 1 条读回通过后单独展示命令并申请写入审批。 |

以下为仅提交第 1 条的已审批命令。执行前已重新核验 Staging 对象和历史。现有验收令牌负责核验项目身份，迁移专用令牌由用户在 Windows 下以 DPAPI 加密交接至 `node_modules/.cache/song-staging-m2-migrations.dpapi`。此命令保留供核对历史操作。

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'D:\code\song\.worktrees\distribution-m2'
$reviewHandoff = 'node_modules\.cache\song-staging-m2-management.dpapi'
$migrationHandoff = 'node_modules\.cache\song-staging-m2-migrations.dpapi'
$reviewSecret = $null
$migrationSecret = $null
$exitStatus = 1

try {
  foreach ($handoff in @($reviewHandoff, $migrationHandoff)) {
    if (!(Test-Path -LiteralPath $handoff -PathType Leaf)) {
      throw 'Missing encrypted Staging handoff'
    }
    if ((Get-Item -LiteralPath $handoff).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
      throw 'Staging handoff must be a regular file'
    }
  }

  $reviewSecret = Get-Content -LiteralPath $reviewHandoff -Raw | ConvertTo-SecureString
  $migrationSecret = Get-Content -LiteralPath $migrationHandoff -Raw | ConvertTo-SecureString
  $env:SONG_M2_REVIEW_PAT = [System.Net.NetworkCredential]::new('', $reviewSecret).Password
  $env:SONG_M2_MIGRATION_PAT = [System.Net.NetworkCredential]::new('', $migrationSecret).Password

  $applyFirst = @'
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createStagingTarget } from './scripts/lib/distribution-staging-target.mjs';

const ref = 'uartrtcmskyuqxawjqlx';
const reviewed = '3acd6f8d7d0124349f42922ba4b25f7b4d4e972a';
const file = 'supabase/migrations/20261110100401_add_distribution_platform_variants.sql';
const name = 'add_distribution_platform_variants';
const expected = '48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174';
const reviewPat = process.env.SONG_M2_REVIEW_PAT;
const migrationPat = process.env.SONG_M2_MIGRATION_PAT;
delete process.env.SONG_M2_REVIEW_PAT;
delete process.env.SONG_M2_MIGRATION_PAT;

const endpoint = 'https://api.supabase.com/v1/projects/uartrtcmskyuqxawjqlx/database/migrations';
const headers = { Authorization: 'Bearer ' + migrationPat, Accept: 'application/json' };
const bounded = { redirect: 'error' };

async function history() {
  const response = await fetch(endpoint, {
    ...bounded, method: 'GET', headers, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error('Migration history GET HTTP ' + response.status);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.some(row => !/^\d{14}$/.test(row?.version ?? ''))) {
    throw Error('Unexpected migration history');
  }
  return rows;
}

try {
  if (!migrationPat?.startsWith('sbp_fc')) throw Error('Project-scoped migration PAT required');
  const bytes = execFileSync('git', ['show', reviewed + ':' + file]);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const query = bytes.toString('utf8');
  if (digest !== expected || !Buffer.from(query, 'utf8').equals(bytes)) {
    throw Error('Reviewed SQL digest or encoding mismatch');
  }

  const target = createStagingTarget(ref, 'https://uartrtcmskyuqxawjqlx.supabase.co', reviewPat);
  await target.verifyProject();
  const before = await history();
  const m1 = [
    { version: '20261109153506', name: 'add_private_distribution_m1' },
    { version: '20261109161000', name: 'report_distribution_version_conflicts' },
  ];
  if (m1.some(want => !before.some(row => row.version === want.version && row.name === want.name))
    || before.some(row => [name, 'review_distribution_source_fields'].includes(row.name)
      || ['20261110100401', '20261110114036'].includes(row.version))) {
    throw Error('Staging history precondition failed');
  }

  let receipt;
  try {
    receipt = await fetch(endpoint, {
      ...bounded, method: 'POST', signal: AbortSignal.timeout(120000),
      headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': 'song-m2-1-' + expected },
      body: JSON.stringify({ name, query }),
    });
  } catch {
    throw Error('Migration POST outcome uncertain. Read back history and objects before any retry.');
  }
  if (!receipt.ok) throw Error('Migration POST HTTP ' + receipt.status + '. Read back before retry.');
  const after = await history();
  const prior = new Set(before.map(row => row.version + ':' + (row.name ?? '')));
  const added = after.filter(row => !prior.has(row.version + ':' + (row.name ?? '')));
  if (after.length !== before.length + 1 || added.length !== 1 || added[0].name !== name) {
    throw Error('Unexpected migration history after POST. Stop for read-only investigation.');
  }
  console.log(JSON.stringify({ ref, name, version: added[0].version, sha256: digest, http: receipt.status }));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unknown Staging migration error');
  process.exitCode = 1;
}
'@

  $applyFirst | node --input-type=module -
  $exitStatus = $LASTEXITCODE
} finally {
  Remove-Item Env:SONG_M2_REVIEW_PAT, Env:SONG_M2_MIGRATION_PAT -ErrorAction SilentlyContinue
  if ($null -ne $reviewSecret) { $reviewSecret.Dispose() }
  if ($null -ne $migrationSecret) { $migrationSecret.Dispose() }
}
exit $exitStatus
```

已在本机检查完整 PowerShell 语法，并以替换网络请求的离线夹具验证 Node 命令。成功夹具校验原 SQL 哈希并只发送一次模拟 POST，403 与已有迁移夹具均在 POST 前退出。此检查未访问真实写入端点。

## 读回与回退

- 每条只发送一次原始 SQL。收到回执后立即通过独立只读查询核对平台登记的迁移版本、名称、存储 SQL 的 SHA-256、表、约束、索引、触发器、RLS 策略和角色授权。第 2 条还须验证 Invoker、空 `search_path`、核对字段约束和 `PT409`。
- 两份 SQL 的显式事务保留。官方公开规范没有承诺脚本内 `COMMIT` 与迁移历史写入共用同一事务，因此 SQL 对象和历史都吻合才算通过。若 HTTP 回执不明、哈希不同，或只看到对象或记录其中之一，保留只读证据并停在该条，交由 Supabase 或单独获批的补偿操作处理。
- SQL 在提交前报错时按其事务回滚，随后查验对象和历史。若第 1 条成功而第 2 条失败，保留已核验的第 1 条状态。已成功的迁移如需撤销，先备份并确认 M2 两张表为空，再就补偿迁移单独送审。现有回退草案只清除 M2 对象，并拒绝空表检查被 RLS 过滤的会话。Git LF SHA-256 为 `8ac7eae45fb307b04bc9d1283c774943ed70095fe92e12369feea49fc0b75d5c`。[回退草案](../supabase/rollbacks/distribution_m2.sql)
- 两条记录、对象与安全检查都通过后才运行真实 Staging 验收。完成并核对临时资源后，从 Access Tokens 页面按名称撤销本轮凭据，再清除本机相应加密副本。[Access Tokens](https://supabase.com/dashboard/account/tokens)
