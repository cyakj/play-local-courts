# Shared logic for the hosted-backup scripts. Dot-sourced; not run directly.
#
# Safety model
#  * The hosted database is only ever READ: every psql session starts with default_transaction_read_only = on and pg_dump
#    only reads. Nothing here issues DDL or DML against it.
#  * The database password is supplied through the PGPASSWORD environment variable of the child processes only. It is never
#    put on a command line, written to a file, or printed. Every PG* variable inherited from the caller is cleared first.
#  * "Verified" is only declared when a restore into a throwaway local server reproduces hashes of every row of every
#    table (plus an inventory of the schema objects) taken from the live project.

$script:ProjectRef = 'hqqlrliakttqsbalvuyz'
$script:ToolsRoot = Join-Path $env:USERPROFILE 'tenisx-tools\pgbin17-11\pgsql\bin'
$script:BinDir = $script:ToolsRoot
$script:OutRoot = Join-Path $env:USERPROFILE 'tenisx-backups'
# Schemas that hold the accounts and the app data. Storage FILES (bucket contents) are not in the database.
$script:DumpSchemas = @('public', 'auth', 'storage', 'supabase_migrations', 'backup_20261013')
# Rows in these auth tables change whenever any device refreshes a login token; they are dumped but not fingerprinted.
$script:VolatileTables = @('sessions', 'refresh_tokens', 'audit_log_entries', 'flow_state', 'one_time_tokens', 'mfa_amr_claims')
$script:RequiredFiles = @('full.dump', 'fingerprint-before.txt', 'fingerprint-after.txt', 'volatile-before.txt', 'volatile-after.txt', 'volatile-stable.txt', 'roles.txt', 'extensions.txt')
# pg_restore error lines that are known to be harmless. Empty on purpose: any restore error fails verification until a
# specific message has been examined and added here with a reason.
$script:BenignRestoreErrors = @()

function Assert-Tools {
    foreach ($exe in 'psql.exe', 'pg_dump.exe', 'pg_restore.exe', 'initdb.exe', 'pg_ctl.exe') {
        if (-not (Test-Path -LiteralPath (Join-Path $script:BinDir $exe))) {
            throw "Missing $exe in $script:BinDir. Install the portable PostgreSQL tools first."
        }
    }
}

# Removes every PG* variable (PGHOSTADDR, PGSERVICE, PGOPTIONS, PGPASSFILE ... would silently redirect or alter connections).
function Clear-PgEnv {
    Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' } | ForEach-Object { Remove-Item -LiteralPath "Env:$($_.Name)" }
}

function Set-PgConnection {
    param([string]$PgHost, [string]$Port, [string]$User, [string]$Database, [string]$Password, [string]$SslMode)
    Clear-PgEnv
    $env:PGHOST = $PgHost; $env:PGPORT = $Port; $env:PGUSER = $User; $env:PGDATABASE = $Database
    $env:PGSSLMODE = $SslMode; $env:PGCONNECT_TIMEOUT = '20'; $env:PGCLIENTENCODING = 'UTF8'
    if ($Password) { $env:PGPASSWORD = $Password }
}

# Quotes one argument for the Windows command line (doubles backslashes that precede a quote or the closing quote).
function ConvertTo-WinArg {
    param([string]$Arg)
    $escaped = [regex]::Replace($Arg, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

# Runs a PostgreSQL tool without a shell. Returns the exit code. Output goes only to the given files.
function Invoke-Pg {
    param([string]$Exe, [string[]]$PgArgs, [string]$OutFile, [string]$ErrFile)
    $quoted = ($PgArgs | ForEach-Object { ConvertTo-WinArg $_ }) -join ' '
    $p = Start-Process -FilePath (Join-Path $script:BinDir $Exe) -ArgumentList $quoted `
        -NoNewWindow -Wait -PassThru -RedirectStandardOutput $OutFile -RedirectStandardError $ErrFile
    return $p.ExitCode
}

# Starts a local scratch server. pg_ctl is launched detached (its output is not redirected, otherwise Start-Process would
# wait for the long-running server to exit), then readiness is polled with pg_isready. Returns $true when it accepts connections.
function Start-PgServer {
    param([string]$DataDir, [string]$Port, [string]$LogFile, [string]$WorkDir)
    $argList = (@('-D', $DataDir, '-o', "-p $Port -c listen_addresses=127.0.0.1", '-l', $LogFile, 'start') | ForEach-Object { ConvertTo-WinArg $_ }) -join ' '
    $null = Start-Process -FilePath (Join-Path $script:BinDir 'pg_ctl.exe') -ArgumentList $argList -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        $code = Invoke-Pg -Exe 'pg_isready.exe' -PgArgs @('-h', '127.0.0.1', '-p', $Port) -OutFile (Join-Path $WorkDir 'isready.out') -ErrFile (Join-Path $WorkDir 'isready.err')
        if ($code -eq 0) { return $true }
    }
    return $false
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Text)
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding $false))
}

# Runs read-only SQL with machine-readable output (-q -A -t, '|' separated). Same pipeline for the live and the restored
# database so the outputs are directly comparable. Returns the output file path. Throws on any SQL error.
function Invoke-Query {
    param([string]$Dir, [string]$Name, [string]$Sql)
    $sqlFile = Join-Path $Dir ($Name + '.sql')
    $out = Join-Path $Dir ($Name + '.txt')
    $err = Join-Path $Dir ($Name + '.err.txt')
    Write-Utf8NoBom $sqlFile ("set default_transaction_read_only = on;`nset timezone = 'UTC';`nset datestyle = 'ISO, YMD';`nset intervalstyle = 'postgres';`nset extra_float_digits = 1;`nset bytea_output = 'hex';`n" + $Sql)
    $code = Invoke-Pg -Exe 'psql.exe' -PgArgs @('-X', '-q', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-f', $sqlFile) -OutFile $out -ErrFile $err
    if ($code -ne 0) { throw "Query '$Name' failed (exit $code). See $err" }
    if ((Test-Path -LiteralPath $err) -and ((Get-Item -LiteralPath $err).Length -eq 0)) { Remove-Item -LiteralPath $err }
    return $out
}

# One definition-hash inventory row: count and an order-independent hash of the definitions.
function New-InventoryRow {
    param([string]$Name, [string]$DefSelect)
    return "select 'I|$Name|' || count(*) || '|' || coalesce(md5(string_agg(md5(def), ',' order by md5(def))), '-') as line from ($DefSelect) s_$($Name -replace '[^A-Za-z]', '_')"
}

# SQL whose output is the preservation fingerprint: one line per table (row count + hash of every row) and one line per
# object-type inventory. Lines starting with 'G|' (privileges) are informational; everything else must match exactly.
function Get-FingerprintSql {
    # -Volatile: only the auth token/session tables (V| rows). Without it: everything else (T| rows) plus inventories.
    param([switch]$Volatile)
    $sl = ($script:DumpSchemas | ForEach-Object { "'" + $_ + "'" }) -join ','
    $vol = ($script:VolatileTables | ForEach-Object { "'" + $_ + "'" }) -join ','
    $tag = if ($Volatile) { 'V' } else { 'T' }
    $volFilter = if ($Volatile) { "and (n.nspname = 'auth' and c.relname in ($vol))" } else { "and not (n.nspname = 'auth' and c.relname in ($vol))" }
    $parts = @()
    # Ordinary and partitioned tables. Materialized views are derived data that pg_restore rebuilds with REFRESH, so their
    # contents may legitimately differ from a stale live copy; their definition and populated flag are in the inventories.
    $parts += @"
select '$tag|' || n.nspname || '.' || c.relname || '|' || (xpath('/row/c/text()', q.x))[1]::text || '|' || (xpath('/row/h/text()', q.x))[1]::text as line
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral (select query_to_xml(format('select count(*) as c, coalesce(md5(string_agg(md5(t::text), %L order by md5(t::text))), %L) as h from %I.%I as t', ',', '-', n.nspname, c.relname), false, true, '') as x) q
 where c.relkind in ('r', 'p') and n.nspname in ($sl)
   $volFilter
"@
    if ($Volatile) { return "select line from (`n$($parts -join "`nunion all`n")`n) v_lines;`n" }
    $parts += New-InventoryRow 'relflags' "select n.nspname || '.' || c.relname || ':' || c.relkind::text || ':rls=' || c.relrowsecurity::text || ':force=' || c.relforcerowsecurity::text || ':populated=' || c.relispopulated::text || ':persist=' || c.relpersistence::text || ':opts=' || coalesce(c.reloptions::text, '') as def from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','p','v','m','S') and n.nspname in ($sl)"
    $parts += New-InventoryRow 'columns' "select n.nspname || '.' || c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':ident=' || a.attidentity::text || ':gen=' || a.attgenerated::text || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') as def from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m') and n.nspname in ($sl)"
    $parts += New-InventoryRow 'policies' "select schemaname || '.' || tablename || '.' || policyname || ':' || cmd || ':' || permissive || ':' || roles::text || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') as def from pg_policies where schemaname in ($sl)"
    $parts += New-InventoryRow 'functions' "select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.prokind in ('f','p') and n.nspname in ($sl) and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')"
    $parts += New-InventoryRow 'triggers' "select n.nspname || '.' || c.relname || ':' || t.tgenabled::text || ':' || pg_get_triggerdef(t.oid) as def from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ($sl)"
    $parts += New-InventoryRow 'indexes' "select schemaname || '.' || indexdef as def from pg_indexes where schemaname in ($sl)"
    $parts += New-InventoryRow 'constraints' "select n.nspname || '.' || c.relname || '.' || con.conname || ':' || pg_get_constraintdef(con.oid) as def from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ($sl)"
    $parts += New-InventoryRow 'views' "select n.nspname || '.' || c.relname || ':' || pg_get_viewdef(c.oid) as def from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('v','m') and n.nspname in ($sl)"
    $parts += New-InventoryRow 'enums' "select n.nspname || '.' || t.typname || ':' || e.enumlabel || ':' || (row_number() over (partition by e.enumtypid order by e.enumsortorder))::text as def from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname in ($sl)"
    $parts += New-InventoryRow 'sequences' "select schemaname || '.' || sequencename || ':' || data_type::text || ':' || start_value::text || ':' || increment_by::text || ':' || min_value::text || ':' || max_value::text || ':' || cache_size::text || ':' || cycle::text || ':last=' || coalesce(last_value::text, 'null') as def from pg_sequences where schemaname in ($sl)"
    # Privileges depend on which role owns the objects (the restore runs as a different owner), so they are informational.
    $parts += New-InventoryRow 'G-table-grants' "select n.nspname || '.' || c.relname || ':' || case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end || ':' || a.privilege_type as def from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join lateral aclexplode(c.relacl) a where c.relkind in ('r','p','v','m','S') and n.nspname in ($sl) and a.grantee <> c.relowner"
    $parts += New-InventoryRow 'G-function-grants' "select p.oid::regprocedure::text || ':' || case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end || ':' || a.privilege_type as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join lateral aclexplode(p.proacl) a where p.prokind in ('f','p') and n.nspname in ($sl) and a.grantee <> p.proowner"
    # 'G-' rows are renamed to 'G|...' so the comparison can recognise them.
    $body = ($parts -join "`nunion all`n")
    return "select replace(line, 'I|G-', 'G|') as line from (`n$body`n) all_lines;`n"
}

function Get-InventorySqlFiles {
    # name -> SQL, saved as human-readable reference (not compared). No password verifiers are read.
    $sl = ($script:DumpSchemas | ForEach-Object { "'" + $_ + "'" }) -join ','
    return [ordered]@{
        'roles'            = "select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls, rolconnlimit, coalesce(rolconfig::text,'') from pg_roles where rolname !~ '^pg_' order by 1;"
        'role-memberships' = "select r.rolname, m.rolname from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member where r.rolname !~ '^pg_' order by 1, 2;"
        'extensions'       = "select e.extname, e.extversion, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1;"
        'role-settings'    = "select coalesce(r.rolname,'(all)'), coalesce(d.datname,'(all)'), s.setconfig::text from pg_db_role_setting s left join pg_roles r on r.oid = s.setrole left join pg_database d on d.oid = s.setdatabase order by 1, 2;"
        'owners'           = "select n.nspname, c.relname, c.relkind, pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ($sl) and c.relkind in ('r','p','v','m','S') order by 1, 2;"
        'storage-buckets'  = "select b.id, b.public, b.file_size_limit, (select count(*) from storage.objects o where o.bucket_id = b.id) from storage.buckets b order by 1;"
    }
}

# Reads a query output file as lines, sorted ordinally (collation independent).
function Read-SortedLines {
    param([string]$Path)
    $lines = [string[]][IO.File]::ReadAllLines($Path)
    [Array]::Sort($lines, [StringComparer]::Ordinal)
    return , $lines
}

# Compares two fingerprint files. Returns @{ Match; Differences; Informational } (G| rows never cause a mismatch).
function Compare-Fingerprints {
    param([string]$ExpectedPath, [string]$ActualPath, [switch]$AllInformational)
    $e = Read-SortedLines $ExpectedPath
    $a = Read-SortedLines $ActualPath
    if ($AllInformational) {
        $info = @(Compare-Object $e $a -CaseSensitive | ForEach-Object { '{0} {1}' -f $_.SideIndicator, $_.InputObject })
        return @{ Match = $true; Differences = @(); Informational = $info; Lines = 0 }
    }
    $strictE = @($e | Where-Object { $_ -notlike 'G|*' })
    $strictA = @($a | Where-Object { $_ -notlike 'G|*' })
    $infoE = @($e | Where-Object { $_ -like 'G|*' })
    $infoA = @($a | Where-Object { $_ -like 'G|*' })
    $diff = @()
    foreach ($d in Compare-Object $strictE $strictA -CaseSensitive) { $diff += ('{0} {1}' -f $d.SideIndicator, $d.InputObject) }
    $infoDiff = @()
    foreach ($d in Compare-Object $infoE $infoA -CaseSensitive) { $infoDiff += ('{0} {1}' -f $d.SideIndicator, $d.InputObject) }
    return @{ Match = ($diff.Count -eq 0 -and $strictE.Count -gt 0); Differences = $diff; Informational = $infoDiff; Lines = $strictE.Count }
}

function Get-TableCount {
    param([string]$FingerprintPath, [string]$Table)
    foreach ($l in [IO.File]::ReadAllLines($FingerprintPath)) {
        $p = $l -split '\|'
        if ($p.Count -ge 4 -and $p[0] -eq 'T' -and $p[1] -eq $Table) { return [int64]$p[2] }
    }
    return $null
}

function Lock-Directory {
    param([string]$Dir)
    # Backups contain password hashes: restrict the folder to the current Windows user (no administrator rights needed).
    $null = & icacls.exe $Dir /inheritance:r /grant:r ("{0}:(OI)(CI)F" -f $env:USERNAME) 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Warning "Could not restrict permissions on $Dir" }
}

# Takes the backup into $Dir using the connection already configured in the PG* environment variables.
function Invoke-BackupCore {
    param([string]$Dir, [string]$VerifySqlPath)

    function Step([string]$name, [string]$exe, [string[]]$pgArgs) {
        $err = Join-Path $Dir ($name + '.err.txt')
        $code = Invoke-Pg -Exe $exe -PgArgs $pgArgs -OutFile (Join-Path $Dir ($name + '.out.txt')) -ErrFile $err
        if ($code -ne 0) { throw "$name failed (exit $code). See $err" }
        foreach ($f in $err, (Join-Path $Dir ($name + '.out.txt'))) {
            if ((Test-Path -LiteralPath $f) -and ((Get-Item -LiteralPath $f).Length -eq 0)) { Remove-Item -LiteralPath $f }
        }
        Write-Host "  ok  $name"
    }

    Write-Host 'Checking the connection (read-only)...'
    $pre = Invoke-Query $Dir 'preflight' "select current_database() || '|' || (select count(*) from auth.users) || '|' || (select (rolsuper or rolbypassrls)::text from pg_roles where rolname = current_user) || '|' || version();"
    $f = (Get-Content -LiteralPath $pre -TotalCount 1) -split '\|'
    if ($f[2] -ne 'true') { throw 'This database role cannot bypass row level security, so a dump could silently omit rows. Use the postgres role.' }
    if ([int64]$f[1] -lt 1) { throw 'auth.users is empty - refusing to treat this as the expected project.' }
    Write-Host ("  database={0} accounts={1}" -f $f[0], $f[1])

    foreach ($kv in (Get-InventorySqlFiles).GetEnumerator()) { $null = Invoke-Query $Dir $kv.Key $kv.Value }

    $fpSql = Get-FingerprintSql
    $volSql = Get-FingerprintSql -Volatile
    $null = Invoke-Query $Dir 'fingerprint-before' $fpSql
    $null = Invoke-Query $Dir 'volatile-before' $volSql

    Write-Host 'Dumping (this can take a few minutes)...'
    $schemaArgs = @(); foreach ($s in $script:DumpSchemas) { $schemaArgs += @('-n', $s) }
    Step 'dump-full' 'pg_dump.exe' (@('-Fc', '--no-owner', '-f', (Join-Path $Dir 'full.dump')) + $schemaArgs)
    Step 'dump-schema-only' 'pg_dump.exe' (@('-s', '--no-owner', '-f', (Join-Path $Dir 'schema-only.sql')) + $schemaArgs)
    Step 'dump-data-only' 'pg_dump.exe' (@('-a', '--no-owner', '-f', (Join-Path $Dir 'data-only.sql')) + $schemaArgs)

    $null = Invoke-Query $Dir 'fingerprint-after' $fpSql
    $cmp = Compare-Fingerprints (Join-Path $Dir 'fingerprint-before.txt') (Join-Path $Dir 'fingerprint-after.txt')
    if (-not $cmp.Match -or $cmp.Informational.Count -gt 0) {
        Write-Utf8NoBom (Join-Path $Dir 'INVALID-data-changed-during-backup.txt') (($cmp.Differences + $cmp.Informational) -join "`n")
        throw 'Data changed while the backup ran, so it may not be consistent. Close the app on every device and run the backup again.'
    }

    # Login tokens/sessions can change legitimately while a dump runs; they are compared strictly at restore time only
    # when they did not change during this backup.
    $null = Invoke-Query $Dir 'volatile-after' $volSql
    $volCmp = Compare-Fingerprints (Join-Path $Dir 'volatile-before.txt') (Join-Path $Dir 'volatile-after.txt') -AllInformational
    Write-Utf8NoBom (Join-Path $Dir 'volatile-stable.txt') ($(if ($volCmp.Informational.Count -eq 0) { 'true' } else { 'false' }))

    $toc = Join-Path $Dir 'full.toc.txt'
    $code = Invoke-Pg 'pg_restore.exe' @('--list', (Join-Path $Dir 'full.dump')) $toc (Join-Path $Dir 'toc.err.txt')
    if ($code -ne 0) { throw 'pg_restore could not read the dump it just wrote.' }
    if (-not (Select-String -LiteralPath $toc -Pattern 'TABLE DATA auth users' -Quiet)) { throw 'The dump does not list auth.users data.' }
    if ((Get-Item -LiteralPath (Join-Path $Dir 'full.dump')).Length -lt 10000) { throw 'full.dump is suspiciously small.' }

    if ($VerifySqlPath -and (Test-Path -LiteralPath $VerifySqlPath)) {
        Write-Host 'Recording the runbook read-only verification baseline (sections 0-9)...'
        $baseSql = Join-Path $Dir 'baseline-verify-all.sql'
        Write-Utf8NoBom $baseSql ("set default_transaction_read_only = on;`n" + [IO.File]::ReadAllText($VerifySqlPath))
        $null = Invoke-Pg 'psql.exe' @('-X', '-v', 'ON_ERROR_STOP=0', '-f', $baseSql) (Join-Path $Dir 'baseline-verify-all.txt') (Join-Path $Dir 'baseline-verify-all.err.txt')
    }

    $manifest = Join-Path $Dir 'MANIFEST.sha256'
    $lines = Get-ChildItem -LiteralPath $Dir -File | Where-Object { $_.Name -ne 'MANIFEST.sha256' } | Sort-Object Name | ForEach-Object {
        '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash, $_.Name
    }
    [IO.File]::WriteAllLines($manifest, [string[]]$lines)
    $accounts = Get-TableCount (Join-Path $Dir 'fingerprint-before.txt') 'auth.users'
    $summary = @(
        "BACKUP COMPLETE $(Get-Date -Format s)",
        "manifest-sha256: $((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash)",
        "accounts in auth.users: $accounts",
        'NOT covered: Storage FILES, Auth dashboard settings, edge function secrets, Supabase-managed roles/extensions code.',
        'NEXT: run verify-restore.ps1 -BackupDir <this folder> to prove it can be restored.'
    )
    Write-Utf8NoBom (Join-Path $Dir 'BACKUP-COMPLETE.txt') ($summary -join "`n")
    return $summary
}

# Removes every artifact of an earlier verification attempt (so a failed run can never leave a stale success marker).
# Terminating on failure; returns the resolved backup folder path.
function Clear-VerificationEvidence {
    param([string]$BackupDir)
    $BackupDir = (Resolve-Path -LiteralPath $BackupDir).Path
    foreach ($stale in 'RESTORE-VERIFIED.txt', 'restore-test.errors.txt', 'restore-test.report.txt', 'fingerprint-restored.txt', 'volatile-restored.txt') {
        $p = Join-Path $BackupDir $stale
        if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force -ErrorAction Stop }
        if (Test-Path -LiteralPath $p) { throw "Could not remove stale evidence $stale" }
    }
    $diag = Join-Path $BackupDir 'restore-test-diagnostics'
    if (Test-Path -LiteralPath $diag) { Remove-Item -LiteralPath $diag -Recurse -Force -ErrorAction Stop }
    return $BackupDir
}

function Get-FreePort {
    foreach ($port in 55432..55470) {
        $l = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $port)
        try { $l.Start(); $l.Stop(); return $port } catch { }
    }
    throw 'No free local port for the scratch server.'
}

# Restores $BackupDir\full.dump into a throwaway local server and compares it with the live fingerprint.
# Returns $true only when everything strict matches. Never contacts Supabase.
function Invoke-RestoreVerify {
    param([string]$BackupDir)

    $BackupDir = Clear-VerificationEvidence $BackupDir
    if (-not (Test-Path -LiteralPath (Join-Path $BackupDir 'BACKUP-COMPLETE.txt'))) { throw 'Not a complete backup (BACKUP-COMPLETE.txt missing).' }
    if (Test-Path -LiteralPath (Join-Path $BackupDir 'INVALID-data-changed-during-backup.txt')) { throw 'This backup was marked invalid.' }

    # 1. Manifest: strict, covers the required files, matches the recorded hash and every file's content.
    $manifestPath = Join-Path $BackupDir 'MANIFEST.sha256'
    $complete = [IO.File]::ReadAllText((Join-Path $BackupDir 'BACKUP-COMPLETE.txt'))
    if ($complete -notmatch 'manifest-sha256: ([0-9A-F]{64})') { throw 'BACKUP-COMPLETE.txt has no manifest hash.' }
    if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne $Matches[1]) { throw 'MANIFEST.sha256 was modified after the backup.' }
    $seen = @{}
    foreach ($line in [IO.File]::ReadAllLines($manifestPath)) {
        if ($line -notmatch '^([0-9A-F]{64})  ([A-Za-z0-9._-]+)$') { throw "Malformed manifest line: $line" }
        $hash = $Matches[1]; $name = $Matches[2]
        if ($seen.ContainsKey($name)) { throw "Duplicate manifest entry: $name" }
        $seen[$name] = $true
        $path = Join-Path $BackupDir $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Manifest lists a missing file: $name" }
        if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $hash) { throw "Checksum mismatch for $name - the backup is damaged." }
    }
    foreach ($req in $script:RequiredFiles) { if (-not $seen.ContainsKey($req)) { throw "Manifest does not cover required file $req" } }
    Write-Host 'ok  every backup file matches its recorded checksum'

    $before = Join-Path $BackupDir 'fingerprint-before.txt'
    $afterCmp = Compare-Fingerprints $before (Join-Path $BackupDir 'fingerprint-after.txt')
    if (-not $afterCmp.Match) { throw 'The before/after fingerprints recorded at backup time differ.' }
    $accounts = Get-TableCount $before 'auth.users'
    if (-not $accounts -or $accounts -lt 1) { throw 'The live baseline contains no accounts; nothing meaningful to verify.' }

    $scratch = Join-Path $BackupDir 'scratch-restore'
    if (Test-Path -LiteralPath $scratch) { throw "$scratch already exists (a previous run may have left a server); remove it first." }
    New-Item -ItemType Directory $scratch | Out-Null
    $data = Join-Path $scratch 'data'
    $port = Get-FreePort
    $report = @()
    $verified = $false
    $everStarted = $false
    $savedPassword = $env:PGPASSWORD

    try {
        Set-PgConnection -PgHost '127.0.0.1' -Port "$port" -User 'postgres' -Database 'postgres' -Password '' -SslMode 'disable'
        $code = Invoke-Pg 'initdb.exe' @('-D', $data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C') (Join-Path $scratch 'initdb.out.txt') (Join-Path $scratch 'initdb.err.txt')
        if ($code -ne 0) { throw 'initdb failed (see scratch-restore).' }
        $everStarted = $true
        if (-not (Start-PgServer -DataDir $data -Port "$port" -LogFile (Join-Path $scratch 'server.log') -WorkDir $scratch)) { throw 'could not start the scratch server' }

        $null = Invoke-Query $scratch 'create-db' 'select 1;'
        $createDb = Join-Path $scratch 'createdb.sql'
        Write-Utf8NoBom $createDb "create database restore_test;`n"
        $code = Invoke-Pg 'psql.exe' @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $createDb) (Join-Path $scratch 'createdb.out.txt') (Join-Path $scratch 'createdb.err.txt')
        if ($code -ne 0) { throw 'could not create the scratch database' }
        $env:PGDATABASE = 'restore_test'

        # Roles and extensions recorded from the live project (names only; no password verifiers were ever read).
        $setup = @()
        foreach ($l in [IO.File]::ReadAllLines((Join-Path $BackupDir 'roles.txt'))) {
            $name = ($l -split '\|')[0]
            if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_.-]*$') { throw "Unexpected role name in roles.txt: $name" }
            if ($name -ne 'postgres') { $setup += "create role `"$name`" nologin;" }
        }
        Write-Utf8NoBom (Join-Path $scratch 'roles.sql') ($setup -join "`n")
        $code = Invoke-Pg 'psql.exe' @('-X', '-q', '-v', 'ON_ERROR_STOP=0', '-f', (Join-Path $scratch 'roles.sql')) (Join-Path $scratch 'roles.out.txt') (Join-Path $scratch 'roles.err.txt')

        $avail = [IO.File]::ReadAllLines((Join-Path $BackupDir 'extensions.txt'))
        $missingExt = @()
        foreach ($l in $avail) {
            $p = $l -split '\|'
            if ($p[0] -eq 'plpgsql') { continue }
            if ($p[0] -notmatch '^[A-Za-z0-9_-]+$' -or $p[2] -notmatch '^[A-Za-z0-9_]+$') { continue }
            $sql = "create schema if not exists `"$($p[2])`";`ncreate extension if not exists `"$($p[0])`" schema `"$($p[2])`";"
            $f = Join-Path $scratch ("ext-$($p[0]).sql"); Write-Utf8NoBom $f $sql
            $code = Invoke-Pg 'psql.exe' @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $f) (Join-Path $scratch "ext-$($p[0]).out.txt") (Join-Path $scratch "ext-$($p[0]).err.txt")
            if ($code -ne 0) { $missingExt += $p[0] }
        }
        $report += "extensions not available in the portable tools (restore must not depend on them): $($missingExt -join ', ')"

        $restoreErr = Join-Path $scratch 'restore.err.txt'
        $rcode = Invoke-Pg 'pg_restore.exe' @('--clean', '--if-exists', '--no-owner', '-h', '127.0.0.1', '-p', "$port", '-U', 'postgres', '-d', 'restore_test', (Join-Path $BackupDir 'full.dump')) (Join-Path $scratch 'restore.out.txt') $restoreErr
        $errLines = @(Get-Content -LiteralPath $restoreErr -ErrorAction SilentlyContinue | Where-Object { $_ -match 'error:' })
        Copy-Item -LiteralPath $restoreErr -Destination (Join-Path $BackupDir 'restore-test.errors.txt') -Force
        $unexpected = @($errLines | Where-Object { $line = $_; -not ($script:BenignRestoreErrors | Where-Object { $line -like $_ }) })
        $report += "pg_restore exit code $rcode; $($errLines.Count) error line(s), $($unexpected.Count) not on the known-harmless list (saved in restore-test.errors.txt)"
        if ($unexpected.Count -gt 0) { $report += 'RESTORE ERRORS (first 20):'; $report += @($unexpected | Select-Object -First 20) }

        $null = Invoke-Query $scratch 'fingerprint-restored' (Get-FingerprintSql)
        Copy-Item -LiteralPath (Join-Path $scratch 'fingerprint-restored.txt') -Destination (Join-Path $BackupDir 'fingerprint-restored.txt') -Force
        $cmp = Compare-Fingerprints $before (Join-Path $BackupDir 'fingerprint-restored.txt')
        $restoredAccounts = Get-TableCount (Join-Path $BackupDir 'fingerprint-restored.txt') 'auth.users'
        $report += "strict comparison lines: $($cmp.Lines); differences: $($cmp.Differences.Count)"
        $report += "privilege (informational) differences: $($cmp.Informational.Count)"
        foreach ($t in 'auth.users', 'auth.identities', 'public.profiles', 'public.hoa_memberships', 'public.bookings', 'public.hoas', 'public.maintenance_reports') {
            $report += ("{0,-28} live={1} restored={2}" -f $t, (Get-TableCount $before $t), (Get-TableCount (Join-Path $BackupDir 'fingerprint-restored.txt') $t))
        }
        if ($cmp.Differences.Count -gt 0) { $report += 'DIFFERENCES (< live only, > restored only), first 40:'; $report += @($cmp.Differences | Select-Object -First 40) }
        if ($cmp.Informational.Count -gt 0) { $report += 'PRIVILEGE DIFFERENCES (informational), first 20:'; $report += @($cmp.Informational | Select-Object -First 20) }
        # Login tokens/sessions: strict only if they were stable while the backup ran.
        $null = Invoke-Query $scratch 'volatile-restored' (Get-FingerprintSql -Volatile)
        Copy-Item -LiteralPath (Join-Path $scratch 'volatile-restored.txt') -Destination (Join-Path $BackupDir 'volatile-restored.txt') -Force
        $volStable = ([IO.File]::ReadAllText((Join-Path $BackupDir 'volatile-stable.txt')).Trim() -eq 'true')
        $volCmp = Compare-Fingerprints (Join-Path $BackupDir 'volatile-before.txt') (Join-Path $BackupDir 'volatile-restored.txt') -AllInformational
        $volOk = ($volCmp.Informational.Count -eq 0) -or (-not $volStable)
        $report += "login-token tables stable during backup: $volStable; differences after restore: $($volCmp.Informational.Count)"
        if ($volCmp.Informational.Count -gt 0) { $report += @($volCmp.Informational | Select-Object -First 10) }
        # A non-zero pg_restore exit is only acceptable when every reported error is on the known-harmless list.
        $restoreOk = ($rcode -eq 0) -or ($errLines.Count -gt 0 -and $unexpected.Count -eq 0)
        $verified = ($cmp.Match -and $restoredAccounts -eq $accounts -and $unexpected.Count -eq 0 -and $restoreOk -and $volOk)
    }
    finally {
        # Keep the small log/SQL files for diagnosis; the data directory is never copied.
        $diag = Join-Path $BackupDir 'restore-test-diagnostics'
        if (Test-Path -LiteralPath $scratch) {
            New-Item -ItemType Directory -Force $diag | Out-Null
            Get-ChildItem -LiteralPath $scratch -File -ErrorAction SilentlyContinue | Copy-Item -Destination $diag -Force -ErrorAction SilentlyContinue
        }
        $env:PGPASSWORD = $savedPassword
        $stopped = $true
        if ($everStarted -and (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid'))) {
            $null = Invoke-Pg 'pg_ctl.exe' @('-D', $data, '-m', 'fast', '-w', 'stop') (Join-Path $scratch 'stop.out.txt') (Join-Path $scratch 'stop.err.txt')
            $stopped = -not (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid'))
        }
        $item = Get-Item -LiteralPath $scratch -ErrorAction SilentlyContinue
        $safe = $item -and ($item.Name -eq 'scratch-restore') -and ($item.Parent.FullName -eq $BackupDir) -and (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint))
        if ($stopped -and $safe) { Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue }
        elseif (-not $stopped) { Write-Warning "The scratch server did not stop; $scratch was kept. Stop it with pg_ctl before deleting." }
    }

    Write-Utf8NoBom (Join-Path $BackupDir 'restore-test.report.txt') ($report -join "`n")
    $report | ForEach-Object { Write-Host $_ }
    if ($verified) {
        $dumpHash = (Get-FileHash -LiteralPath (Join-Path $BackupDir 'full.dump') -Algorithm SHA256).Hash
        Write-Utf8NoBom (Join-Path $BackupDir 'RESTORE-VERIFIED.txt') "RESTORE VERIFIED $(Get-Date -Format s)`nfull.dump sha256: $dumpHash`naccounts: $accounts"
    }
    return $verified
}
