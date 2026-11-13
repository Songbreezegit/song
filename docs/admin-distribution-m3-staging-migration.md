# M3 Staging 单条迁移方案与回执

目标为 Supabase `song-staging`，项目 Ref `uartrtcmskyuqxawjqlx`。已批准的 `apply_migration` 调用遇到连接器传输错误。随后数据库只读查询和迁移列表均显示原八条记录，三张 M3 表、私有 schema、写入角色和 RPC 均未创建。取得该通道的独立批准后，改用官方单条迁移 API。

[完整原始 SQL](https://github.com/Songbreezegit/song/blob/df5fc7b35224d420381c1d90d6697e6c61989298/supabase/migrations/20261112190304_add_distribution_publish_calendar.sql) 为 25,929 字节，SHA-256 为 `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396`。新增三张强制 RLS 表、六个 RESTRICT 外键、索引、私有 schema、不可登录且遵守 RLS 的审计写入角色、公开 Invoker RPC 和私有写入函数。[权限与事务审查](admin-distribution-m3-security.md)

## 已批准的执行命令

执行前只读核对项目、八条历史、M2 存储哈希和 M3 对象。脚本固定项目和 Git blob，在单次提交前记录本机尝试标记，提交 `{ name, query }` 到 `POST /v1/projects/uartrtcmskyuqxawjqlx/database/migrations`。请求携带与文件 SHA-256 绑定的幂等键。成功后核对平台分配的版本、名称及存储 SQL 哈希。[完整脚本](../scripts/apply-distribution-m3-staging.mjs) · [官方迁移 API](https://supabase.com/docs/reference/api/v1-apply-a-migration) · [官方 OpenAPI](https://api.supabase.com/api/v1-json)

短期 Scoped PAT 仅选择 `song-staging`。迁移使用 `Project Settings (Read)` 与 `Migrations (Read-write)`。后续验收复用同一短期令牌时需要 `API Keys (Read-write)`，用于创建和撤销本轮临时 Auth 测试密钥。Windows 交接文件使用当前用户 DPAPI 加密，位于工作树的 Git 忽略目录。令牌只传入本机子进程，结束后清除进程变量。[Supabase 权限范围](https://supabase.com/docs/guides/platform/personal-access-tokens#permission-scopes)

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'D:\code\song\.worktrees\distribution-m3'
$m3Handoff = 'node_modules\.cache\song-staging-m3-management.dpapi'
$m3Secret = $null
$m3Exit = 1
try {
    $m3File = Get-Item -LiteralPath $m3Handoff
    if ($m3File.PSIsContainer -or ($m3File.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Expected a regular DPAPI handoff file'
    }
    $m3Secret = Get-Content -LiteralPath $m3Handoff -Raw | ConvertTo-SecureString
    $env:DISTRIBUTION_STAGING_MANAGEMENT_TOKEN = [Net.NetworkCredential]::new('', $m3Secret).Password
    node scripts/apply-distribution-m3-staging.mjs --execute-approved-sql
    $m3Exit = $LASTEXITCODE
} finally {
    Remove-Item Env:DISTRIBUTION_STAGING_MANAGEMENT_TOKEN -ErrorAction SilentlyContinue
    if ($null -ne $m3Secret) { $m3Secret.Dispose() }
}
exit $m3Exit
```

已在本机用离线夹具验证 403、历史变化、M2 哈希变化、POST 无回执、重复提交拦截及存储 SQL 读回。

## 读回与回退

SQL 使用原有 `BEGIN` / `COMMIT`。官方接口未承诺平台迁移历史登记和脚本内 `COMMIT` 共用同一事务。独立核对迁移记录、存储哈希、对象、RLS 和 Security Advisor 后再进入真实验收。调用无回执或返回错误时，先读回记录和对象，保留单次尝试标记。若发现对象和登记不一致，保留现场等待处理。

如需撤销已成功的迁移，先备份并确认三张 M3 表为空，再另行批准 [回滚草案](../supabase/rollbacks/distribution_m3.sql) 及历史登记处理。有任务或日志时保留历史并另行审查向前修复。

## 2026-11-13 Staging 回执

| 核验 | 结果 |
| --- | --- |
| 官方 API 提交 | 06:26 UTC 仅提交一次，HTTP 200，执行脚本退出码 0 |
| 平台登记 | `20261113062649`，`add_distribution_publish_calendar` |
| SQL 读回 | 管理 API 与 PostgreSQL 迁移历史分别确认 25,929 字节的原 SQL，存储 SHA-256 为 `c9aa94c8a63df0fb8e521bf77c5bbb9bb71755bbf496224ea8f30dc12e260396` |
| 历史顺序 | 共九条迁移，M2 的 `20261110174923` 和 `20261110175856` 哈希与先前验收一致 |
| 数据库目录 | 三张强制 RLS 表、26 项约束（含六个 RESTRICT 外键）、12 个索引、10 条策略（含三条 restrictive 策略）。公开入口为 Invoker，私有函数由受 RLS 约束的 NOLOGIN writer 持有 |
| Security Advisor | 仅有两条既有 `analytics_private` INFO |
| 清理后读回 | 九条迁移和 M3 存储哈希复核通过，三张 M3 表的行数及注入的审计触发器计数均为零 |

此回执对应当日验收快照。[真实集成结果与清理记录](admin-distribution-m3-delivery.md#staging)
