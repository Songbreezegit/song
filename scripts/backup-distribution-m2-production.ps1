#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PgBin,
    [Parameter(Mandatory)][string]$CaFile,
    [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$CaSha256,
    [Parameter(Mandatory)][ValidatePattern('^prod-pre-m2-\d{8}-\d{6}-[a-f0-9]{8}$')][string]$RunName
)

$ErrorActionPreference = 'Stop'
$projectRef = 'vfgmptjfcfgptaqblydd'
$databaseHost = "db.$projectRef.supabase.co"
$backupRoot = 'D:\Backups\Songisle'
$schemas = @('public', 'analytics_private', 'distribution_private', 'auth', 'supabase_migrations', 'storage')
$sessionTables = @(
    'sessions', 'refresh_tokens', 'mfa_amr_claims', 'mfa_challenges', 'flow_state',
    'saml_relay_states', 'one_time_tokens', 'oauth_authorizations', 'oauth_client_states', 'webauthn_challenges'
)
$connection = @('--host', $databaseHost, '--port', '5432', '--username', 'postgres', '--dbname', 'postgres', '--no-password')
$receipt = [ordered]@{
    status = 'RUNNING'
    project_ref = $projectRef
    run_name = $RunName
    connection = 'Direct; verify-full; default_transaction_read_only=on'
    started_at = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(8)).ToString('o')
    clients = [ordered]@{}
    exit_status = [ordered]@{}
}

function Invoke-PgClient {
    param([string]$Name, [string]$Step, [string[]]$Arguments, [switch]$Online, [switch]$DiscardOutput)

    $start = [Diagnostics.ProcessStartInfo]::new($receipt.clients[$Name].path)
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.Encoding]::UTF8
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    foreach ($key in @($start.Environment.Keys)) {
        if ($key -like 'PG*') { $null = $start.Environment.Remove($key) }
    }
    $start.Environment['LC_ALL'] = 'C'
    $start.Environment['PGCLIENTENCODING'] = 'UTF8'
    if ($Online) {
        $start.Environment['PGSSLMODE'] = 'verify-full'
        $start.Environment['PGSSLROOTCERT'] = $ca.FullName
        $start.Environment['PGCONNECT_TIMEOUT'] = '10'
        $start.Environment['PGOPTIONS'] = '-c default_transaction_read_only=on'
        $start.Environment['PGAPPNAME'] = 'song-m2-readonly-backup'
        $start.Environment['PGPASSWORD'] = [Net.NetworkCredential]::new('', $password).Password
    }

    $process = [Diagnostics.Process]::new()
    try {
        $process.StartInfo = $start
        if (-not $process.Start()) { throw 'PostgreSQL process did not start' }
        $null = $start.Environment.Remove('PGPASSWORD')
        $output = if ($DiscardOutput) { $process.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null) }
                  else { $process.StandardOutput.ReadToEndAsync() }
        $errors = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(180000)) {
            $receipt.native_timeout = $Step
            if (-not $process.HasExited) { $process.Kill() }
            $process.WaitForExit()
        }
        $receipt.exit_status[$Step] = $process.ExitCode
        $standardError = $errors.GetAwaiter().GetResult()
        $standardOutput = $output.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0 -or $receipt.native_timeout -eq $Step) {
            $receipt.native_failure = switch -Regex ($standardError) {
                'password authentication failed' { 'authentication'; break }
                'certificate verify failed|SSL error|server certificate' { 'tls'; break }
                'permission denied' { 'permission'; break }
                'lock timeout|lock wait' { 'lock_timeout'; break }
                'could not connect|connection.*timed out|could not translate host' { 'connection'; break }
                default { 'postgresql_client' }
            }
            throw 'PostgreSQL step failed'
        }
        if (-not $DiscardOutput) { return $standardOutput }
    } finally {
        $null = $start.Environment.Remove('PGPASSWORD')
        $process.Dispose()
    }
}

function Read-ProductionInventory {
    param([string]$Step)

    $sql = @'
with scope as (
  select oid, nspname from pg_namespace where nspname in
    ('public','analytics_private','distribution_private','auth','supabase_migrations','storage')
), tables as (
  select c.oid, s.nspname as schema, c.relname as name, c.relkind as kind, c.relrowsecurity as rls
  from pg_class c join scope s on s.oid=c.relnamespace
  where c.relkind in ('r','p') and not exists (
    select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e'
  )
), definitions as (
  select 'SCHEMA' as kind, oid from scope
  union all select 'TABLE', oid from tables
  union all select 'ROW SECURITY', oid from tables where rls
  union all select case p.prokind when 'a' then 'AGGREGATE' when 'p' then 'PROCEDURE' else 'FUNCTION' end, p.oid
    from pg_proc p join scope s on s.oid=p.pronamespace where not exists (
      select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'
    )
  union all select 'TRIGGER', t.oid from pg_trigger t join tables b on b.oid=t.tgrelid where not t.tgisinternal
  union all select 'POLICY', p.oid from pg_policy p join tables b on b.oid=p.polrelid
  union all select 'FK CONSTRAINT', c.oid from pg_constraint c join tables b on b.oid=c.conrelid where c.contype='f'
)
select jsonb_build_object(
  'database', current_database(), 'server_version', current_setting('server_version'),
  'read_only', current_setting('transaction_read_only'),
  'tls', (select jsonb_build_object('ssl',ssl,'version',version) from pg_stat_ssl where pid=pg_backend_pid()),
  'schemas', (select jsonb_agg(nspname order by nspname) from scope),
  'history', (select jsonb_agg(jsonb_build_object('version',version,'name',name,
    'sha256',case when cardinality(statements)=1 then encode(sha256(convert_to(statements[1],'UTF8')),'hex') end)
    order by version) from supabase_migrations.schema_migrations),
  'tables', (select jsonb_agg(to_jsonb(t) order by oid) from tables t),
  'definitions', (select jsonb_agg(to_jsonb(d) order by kind,oid) from definitions d),
  'extensions', (select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) order by e.extname)
    from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
  'managed_roles', (select jsonb_agg(rolname order by rolname) from pg_roles where rolname in
    ('postgres','pg_database_owner','supabase_admin','supabase_auth_admin','supabase_storage_admin','anon','authenticated','service_role')),
  'buckets', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'limit',file_size_limit) order by id),'[]') from storage.buckets),
  'objects', (select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'id',id,'path',name,'bytes',metadata->>'size',
    'type',metadata->>'mimetype','etag',metadata->>'eTag','version',version,'updated_at',updated_at) order by bucket_id,name,id),'[]') from storage.objects)
);
'@
    $flags = $connection + @('--no-psqlrc', '--quiet', '--no-align', '--tuples-only', '--set=ON_ERROR_STOP=1', '--command', $sql)
    $inventory = Invoke-PgClient 'psql' $Step $flags -Online | ConvertFrom-Json -Depth 20
    if ($inventory.database -ne 'postgres' -or $inventory.server_version -notmatch '^17\.' -or
        $inventory.read_only -ne 'on' -or $inventory.tls.ssl -ne $true -or
        ($inventory.schemas -join ',') -ne (($schemas | Sort-Object) -join ',')) { throw 'Unexpected production database identity' }
    $expectedVersions = '20260916115042,20260916115056,20261004093439,20261007052225,20261109184705,20261109185903'
    if (($inventory.history.version -join ',') -ne $expectedVersions -or
        $inventory.history[4].name -ne 'add_private_distribution_m1' -or
        $inventory.history[4].sha256 -ne 'b61ddb41080441f7591582ecccd80fac494b7988bfcb14f9c4f1ea985f3f9f62' -or
        $inventory.history[5].name -ne 'report_distribution_version_conflicts' -or
        $inventory.history[5].sha256 -ne '3aaf6c8e6ec40071cd6c1a91e4fe80ac2c27cff95547172327bb9e261ee8ee77' -or
        @($inventory.tables | Where-Object { $_.schema -eq 'public' -and $_.name -like 'distribution_variant*' }).Count -ne 0) {
        throw 'Production is no longer at the reviewed pre-M2 baseline'
    }
    if (@($inventory.buckets).Count -ne 1 -or $inventory.buckets[0].id -ne 'media' -or $inventory.buckets[0].public -ne $true) {
        throw 'Storage inventory is outside the reviewed public media bucket'
    }
    return $inventory
}

function Test-ArchiveContents {
    param([string]$Toc, [object]$Inventory)

    $entries = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $entryCount = 0
    foreach ($line in ($Toc -split '\r?\n')) {
        if ($line -match '^\d+; ') { $entryCount++ }
        if ($line -cmatch '^\d+; \d+ (\d+) (SCHEMA|TABLE DATA|TABLE|FUNCTION|PROCEDURE|AGGREGATE|TRIGGER|POLICY|ROW SECURITY|FK CONSTRAINT) ') {
            $null = $entries.Add("$($Matches[2]) $($Matches[1])")
        }
    }
    foreach ($definition in $Inventory.definitions) {
        if (-not $entries.Contains("$($definition.kind) $($definition.oid)")) {
            $receipt.missing_definition = $definition.kind
            throw 'Archive is missing a catalog definition'
        }
    }
    $dataSegments = 0
    foreach ($table in $Inventory.tables) {
        $expected = $table.kind -eq 'r' -and -not ($table.schema -eq 'auth' -and $table.name -in $sessionTables)
        if ($entries.Contains("TABLE DATA $($table.oid)") -ne $expected) { throw 'Unexpected table data segment' }
        if ($expected) { $dataSegments++ }
    }
    $criticalTables = @(
        'public.admin_users', 'public.projects', 'public.articles', 'public.site_settings',
        'public.distribution_accounts', 'public.distribution_posts', 'public.distribution_post_targets', 'public.distribution_post_media',
        'auth.users', 'auth.identities', 'auth.mfa_factors', 'storage.buckets', 'storage.objects', 'supabase_migrations.schema_migrations'
    )
    $dataTables = @($Inventory.tables | Where-Object { $entries.Contains("TABLE DATA $($_.oid)") } | ForEach-Object { "$($_.schema).$($_.name)" })
    if (@($criticalTables | Where-Object { $_ -notin $dataTables }).Count -ne 0 -or
        $Toc -cnotmatch '(?m)^\d+; \d+ \d+ ACL public TABLE distribution_posts ' -or
        $Toc -cnotmatch '(?m)^\d+; \d+ \d+ ACL - SCHEMA distribution_private ') {
        throw 'Archive is missing a required data segment or ACL'
    }
    return [ordered]@{
        toc_entries = $entryCount
        tables = @($Inventory.tables).Count
        table_data_segments = $dataSegments
        definitions = @($Inventory.definitions | Group-Object kind | ForEach-Object { [ordered]@{kind=$_.Name; count=$_.Count} })
        critical_data_segments = $criticalTables.Count
    }
}

function Backup-StorageMedia {
    param([object[]]$Objects, [long]$SizeLimit, [string]$PartialZip)

    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(40)
    $client.MaxResponseContentBufferSize = $SizeLimit
    $client.DefaultRequestHeaders.CacheControl = [Net.Http.Headers.CacheControlHeaderValue]::new()
    $client.DefaultRequestHeaders.CacheControl.NoCache = $true
    $manifest = [Collections.Generic.List[object]]::new()
    $seenIds = [Collections.Generic.HashSet[string]]::new()
    $seenPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    try {
        $zip = [IO.Compression.ZipFile]::Open($PartialZip, [IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($object in $Objects) {
                $parts = $object.path -split '/'
                if ($object.bucket -ne 'media' -or $object.id -cnotmatch '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' -or
                    -not $seenIds.Add($object.id) -or -not $seenPaths.Add($object.path) -or
                    $object.path -match '[\\\x00-\x1f]' -or @($parts | Where-Object { $_ -in @('', '.', '..') }).Count -ne 0 -or
                    $object.bytes -notmatch '^[1-9][0-9]{0,9}$' -or [long]$object.bytes -gt $SizeLimit -or
                    $object.type -notin @('image/jpeg', 'image/png', 'image/webp')) { throw 'Unexpected Storage object metadata' }

                $encodedPath = ($parts | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
                $uri = "https://$projectRef.supabase.co/storage/v1/object/public/media/$encodedPath" + "?backup=$RunName"
                $response = $client.GetAsync($uri).GetAwaiter().GetResult()
                try {
                    if ([int]$response.StatusCode -ne 200 -or $response.Content.Headers.ContentType.MediaType -ne $object.type) {
                        $receipt.storage_http = [int]$response.StatusCode
                        throw 'Storage download response mismatch'
                    }
                    $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
                    if ($bytes.LongLength -ne [long]$object.bytes) { throw 'Storage object length mismatch' }
                    if ($object.etag -and $response.Headers.ETag -and $object.etag.Trim('"') -cne $response.Headers.ETag.Tag.Trim('"')) {
                        throw 'Storage object ETag mismatch'
                    }
                    $entryName = "objects/$($object.id).bin"
                    $stream = $zip.CreateEntry($entryName).Open()
                    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
                    $manifest.Add([ordered]@{
                        bucket=$object.bucket; path=$object.path; uuid=$object.id; bytes=$bytes.LongLength; content_type=$object.type
                        archive_entry=$entryName; sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
                    })
                } finally { $response.Dispose() }
            }
            $manifestJson = ConvertTo-Json -InputObject @($manifest.ToArray()) -Depth 5 -Compress
            $writer = [IO.StreamWriter]::new($zip.CreateEntry('manifest.json').Open(), [Text.UTF8Encoding]::new($false))
            try { $writer.Write($manifestJson) } finally { $writer.Dispose() }
        } finally { $zip.Dispose() }
    } finally { $client.Dispose() }

    $zip = [IO.Compression.ZipFile]::OpenRead($PartialZip)
    try {
        if ($zip.Entries.Count -ne $manifest.Count + 1) { throw 'Storage ZIP entry count mismatch' }
        $reader = [IO.StreamReader]::new($zip.GetEntry('manifest.json').Open())
        try {
            if ($reader.ReadToEnd() -cne $manifestJson) { throw 'Storage ZIP manifest mismatch' }
        } finally { $reader.Dispose() }
        foreach ($item in $manifest) {
            $entry = $zip.GetEntry($item.archive_entry)
            if ($null -eq $entry -or $entry.Length -ne $item.bytes) { throw 'Storage ZIP entry length mismatch' }
            $stream = $entry.Open()
            try { $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant() }
            finally { $stream.Dispose() }
            if ($digest -ne $item.sha256) { throw 'Storage ZIP entry SHA-256 mismatch' }
        }
    } finally { $zip.Dispose() }
    $objectBytes = ($manifest | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum
    return [ordered]@{ object_count=$manifest.Count; object_bytes=[long]$objectBytes; manifest_verified=$true; entry_hashes_verified=$true }
}

function Assert-LocalAcl {
    param([string]$Path)

    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Backup path is a reparse point' }
    $acl = Get-Acl -LiteralPath $item.FullName
    $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    $allowed = @($rules | Where-Object { $_.AccessControlType -eq 'Allow' } | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
    if ($allowed.Count -ne 2 -or $ownerSid.Value -notin $allowed -or 'S-1-5-18' -notin $allowed) { throw 'Unexpected backup ACL' }
}

$phase = 'local_protection'
$protected = $false
$password = $null
$promoted = [Collections.Generic.List[object]]::new()
try {
    foreach ($ancestor in @('D:\Backups', $backupRoot)) {
        $item = Get-Item -LiteralPath $ancestor -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unexpected backup ancestor' }
    }
    $directory = (New-Item -ItemType Directory -Path (Join-Path $backupRoot $RunName)).FullName
    $ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($ownerSid)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($ownerSid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
        ))
    }
    Set-Acl -LiteralPath $directory -AclObject $acl
    Assert-LocalAcl $directory
    $protected = $true
    $dump = Join-Path $directory 'song-pre-m2.dump'
    $media = Join-Path $directory 'media-objects.zip'

    $phase = 'client_and_ca'
    $ca = Get-Item -LiteralPath $CaFile
    if ($ca.PSIsContainer -or (Get-FileHash -LiteralPath $ca.FullName -Algorithm SHA256).Hash -ne $CaSha256) { throw 'CA hash mismatch' }
    $receipt.ssl_ca_sha256 = $CaSha256.ToLowerInvariant()
    foreach ($name in @('psql','pg_dump','pg_restore')) {
        $exe = Get-Item -LiteralPath (Join-Path $PgBin "$name.exe")
        if ($exe.PSIsContainer -or ($exe.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Expected a regular PostgreSQL executable' }
        $receipt.clients[$name] = [ordered]@{path=$exe.FullName; sha256=(Get-FileHash -LiteralPath $exe.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
        $version = (Invoke-PgClient $name "version_$name" @('--version')).Trim()
        if ($version -notmatch '^.+ \(PostgreSQL\) 17\.\d+') { throw 'Expected PostgreSQL 17 client' }
        $receipt.clients[$name].version = $version
    }

    $phase = 'psql_preflight'
    $password = Read-Host "Production song ($projectRef) database password" -AsSecureString
    if ($password.Length -eq 0) { throw 'Password is empty' }
    $before = Read-ProductionInventory $phase
    $receipt.server_version = $before.server_version
    $receipt.tls_version = $before.tls.version
    $receipt.schemas = $before.schemas
    $receipt.managed_dependencies = [ordered]@{ roles=$before.managed_roles; extensions=$before.extensions }
    $receipt.auth_data_excluded = $sessionTables

    $phase = 'pg_dump'
    Write-Host 'Production read-only connection verified. Exporting the six schemas.'
    $dumpArgs = $connection + @('--format=custom', '--strict-names', '--lock-wait-timeout=10s', "--file=$dump.partial")
    $dumpArgs += @($schemas | ForEach-Object { "--schema=$_" })
    $dumpArgs += @($sessionTables | ForEach-Object { "--exclude-table-data=auth.$_" })
    Invoke-PgClient 'pg_dump' $phase $dumpArgs -Online -DiscardOutput
    if ((Get-Item -LiteralPath "$dump.partial").Length -le 0) { throw 'Empty database archive' }
    Assert-LocalAcl "$dump.partial"

    $phase = 'pg_restore_list'
    $toc = Invoke-PgClient 'pg_restore' $phase @('--list', "$dump.partial")
    $phase = 'archive_contents'
    $receipt.archive_contents = Test-ArchiveContents $toc $before
    $phase = 'pg_restore_decode'
    Invoke-PgClient 'pg_restore' $phase @('--exit-on-error', '--file=-', "$dump.partial") -DiscardOutput

    $phase = 'storage_files'
    $sizeLimit = [long]$before.buckets[0].limit
    if ($sizeLimit -le 0 -or $sizeLimit -gt 5242880) { throw 'Storage file size limit is outside the reviewed bounds' }
    $receipt.storage = Backup-StorageMedia @($before.objects) $sizeLimit "$media.partial"
    Assert-LocalAcl "$media.partial"

    $phase = 'psql_postflight'
    $after = Read-ProductionInventory $phase
    foreach ($key in @('history','definitions','tables','buckets','objects')) {
        $initial = ConvertTo-Json -InputObject $before.$key -Depth 10 -Compress
        $current = ConvertTo-Json -InputObject $after.$key -Depth 10 -Compress
        if ($initial -cne $current) { throw 'Production catalog or Storage identity changed during backup' }
    }
    $receipt.storage.inventory_verified_before_and_after = $true
    $password.Dispose()
    $password = $null

    $phase = 'finalize'
    $receipt.artifacts = [ordered]@{}
    foreach ($target in @($dump, $media)) {
        $partial = "$target.partial"
        $partialHash = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash
        [IO.File]::Move($partial, $target)
        $promoted.Add($target)
        Assert-LocalAcl $target
        $file = Get-Item -LiteralPath $target
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        if ($file.Length -le 0 -or $hash -ne $partialHash) { throw 'Final archive verification failed' }
        $receipt.artifacts[$file.Name] = [ordered]@{path=$file.FullName; bytes=$file.Length; sha256=$hash.ToLowerInvariant()}
    }
    $receipt.completed_at = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(8)).ToString('o')
    $receipt.status = 'PASS'
    $receiptFile = Join-Path $directory 'backup-receipt.json'
    $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$receiptFile.partial" -Encoding utf8NoBOM
    Assert-LocalAcl "$receiptFile.partial"
    [IO.File]::Move("$receiptFile.partial", $receiptFile)
} catch {
    $receipt.status = 'FAIL'
    $receipt.failed_phase = $phase
    $receipt.error_type = $_.Exception.GetType().Name
    $receipt.script_line = $_.InvocationInfo.ScriptLineNumber
    $receipt.Remove('artifacts')
    foreach ($target in $promoted) {
        try { [IO.File]::Move($target, "$target.partial") } catch { $receipt.reversion_incomplete = $true }
    }
    if ($protected) {
        $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $directory 'backup-failure.json') -Encoding utf8NoBOM
    }
    Write-Host "FAIL at $phase. Only a completed PASS receipt validates a backup."
    exit 1
} finally {
    if ($null -ne $password) { $password.Dispose() }
}
Write-Host "PASS. Verified backup receipt at $receiptFile"
