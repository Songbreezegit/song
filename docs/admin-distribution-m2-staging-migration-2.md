# 内容分发 M2 Staging 迁移 2 审批

## 目标和已核验前置条件

仅适用于 `song-staging`（`uartrtcmskyuqxawjqlx`）。2026-11-11，迁移 1 通过 Supabase 官方单条迁移 API 返回 HTTP 200，平台登记版本为 `20261110174923`。数据库目录和原生迁移详情都读回了相同的完整 SQL SHA-256 `48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174`。已核对两张表、22 个约束、七个索引、五个触发器、四条 RLS 策略和三个 Invoker RPC。M1 四张表仍强制 RLS，保存 RPC 仍使用 `PT409`。安全顾问未报告 M2 对象问题，两张 M2 表当前为空。

## 迁移 2 影响与回退

执行文件为 `20261110114036_review_distribution_source_fields.sql`，取自二次审查提交 `3acd6f8d7d0124349f42922ba4b25f7b4d4e972a`，SHA-256 为 `acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21`。[完整原 SQL](../supabase/migrations/20261110114036_review_distribution_source_fields.sql)

新增 `source_retained_fields` 字段和约束，更新触发器函数及原同步 RPC，新增私有核对辅助函数和 `retain_distribution_variant_source` 公开入口。保存既有稿件、素材引用和已核对快照，保持 M1、Storage 和原有 RLS 策略。RPC 继续采用 Invoker、空 `search_path` 及管理员加 `aal2` 的授权检查。

命令复用已交接的两份项目级 Scoped PAT，检查远端迁移 1 的名称、版本和完整 SQL 哈希，只向官方端点提交一份原始迁移 2。执行前需获得该条写入的独立批准并重新只读核验目标状态。执行后独立读回两条历史记录及哈希、约束、触发器、RLS 和 RPC 授权。两条均核验通过后进入真实验收。[官方迁移应用 API](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [原生迁移详情 API](https://supabase.com/docs/reference/api/v1-get-a-migration)

保留迁移 2 文件的显式事务。失败或回执不明时先查历史及对象，保持已核验的迁移 1，停止后续操作。历史与对象不一致时需单独调查和审批。已成功的迁移如需补偿回退，先备份并核对两张 M2 表为空，再单独送审。现有草案回退整个 M2，使用前须确认所需范围。[回退草案](../supabase/rollbacks/distribution_m2.sql)

## 待审批的第 2 条完整命令

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

  $applySecond = @'
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createStagingTarget } from './scripts/lib/distribution-staging-target.mjs';

const ref = 'uartrtcmskyuqxawjqlx';
const reviewed = '3acd6f8d7d0124349f42922ba4b25f7b4d4e972a';
const file = 'supabase/migrations/20261110114036_review_distribution_source_fields.sql';
const name = 'review_distribution_source_fields';
const expected = 'acc63a2cf5d088da312353a8adc652dc5b01119518433a3fb2db8f6ffb081d21';
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
  const first = {
    version: '20261110174923',
    name: 'add_distribution_platform_variants',
    sha256: '48ba065036b71438dddcb548fb8f733e2475b9e09da80e197873799179c69174',
  };
  const matchingFirst = before.filter(row => row.name === first.name || row.version === first.version);
  if (m1.some(want => !before.some(row => row.version === want.version && row.name === want.name))
    || matchingFirst.length !== 1 || matchingFirst[0].version !== first.version || matchingFirst[0].name !== first.name
    || before.some(row => row.name === name || row.version === '20261110114036')) {
    throw Error('Staging migration 2 history precondition failed');
  }
  const firstResponse = await fetch(endpoint + '/' + first.version, {
    ...bounded, method: 'GET', headers, signal: AbortSignal.timeout(15000),
  });
  if (!firstResponse.ok) throw Error('Migration 1 detail GET HTTP ' + firstResponse.status);
  const firstDetail = await firstResponse.json();
  const firstSql = firstDetail?.statements;
  if (firstDetail?.version !== first.version || firstDetail?.name !== first.name
    || !Array.isArray(firstSql) || firstSql.length !== 1 || typeof firstSql[0] !== 'string'
    || createHash('sha256').update(firstSql[0], 'utf8').digest('hex') !== first.sha256) {
    throw Error('Migration 1 stored SQL digest does not match the verified receipt');
  }

  let receipt;
  try {
    receipt = await fetch(endpoint, {
      ...bounded, method: 'POST', signal: AbortSignal.timeout(120000),
      headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': 'song-m2-2-' + expected },
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

  $applySecond | node --input-type=module -
  $exitStatus = $LASTEXITCODE
} finally {
  Remove-Item Env:SONG_M2_REVIEW_PAT, Env:SONG_M2_MIGRATION_PAT -ErrorAction SilentlyContinue
  if ($null -ne $reviewSecret) { $reviewSecret.Dispose() }
  if ($null -ne $migrationSecret) { $migrationSecret.Dispose() }
}
exit $exitStatus
```

本机语法检查与离线夹具通过。成功夹具检查原 SQL 哈希并只发送一次模拟 POST。迁移 1 存储哈希不符或迁移 2 已存在时，命令在 POST 前退出。

## 执行回执

2026-11-11（UTC+08:00）取得迁移 2 的独立批准后，仅向 `song-staging`（`uartrtcmskyuqxawjqlx`）执行一次上述命令。官方单条迁移 API 返回 HTTP 200，远端登记为 `20261110175856 review_distribution_source_fields`。执行前核对 `20261110174923` 的原 SQL 哈希及迁移 2 缺失。执行后读取数据库历史的两条完整 SQL，分别与送审文件的 SHA-256 匹配。

目录复核确认两张表强制 RLS，四条策略、23 个约束、七个索引、五个启用触发器和四个 Invoker RPC。新增 `source_retained_fields` 为非空 JSONB，默认值为 `{}`。M1 保存 RPC 仍使用 `PT409`。独立 SQL smoke 和真实 GoTrue、PostgREST、Storage、Edge 测试通过，已清理本轮测试资源和临时凭据。[完整验收结果](admin-distribution-m2-delivery.md#真实测试与资源清理)
