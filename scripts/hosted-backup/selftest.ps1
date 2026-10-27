<#
Self-test for the backup tooling. Builds a MOCK database on a throwaway local server (127.0.0.1 only), runs the real
backup and restore-verification code against it, and checks that deliberately damaged backups are rejected.
It never contacts Supabase and needs no password.

Run:  powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\selftest.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Tools

$script:fail = 0
$script:completed = $false
function Check([string]$what, [bool]$cond) {
    if ($cond) { Write-Host "  PASS  $what" -ForegroundColor Green } else { Write-Host "  FAIL  $what" -ForegroundColor Red; $script:fail++ }
}
function Throws([scriptblock]$block) { try { & $block | Out-Null; return $false } catch { return $true } }

$root = Join-Path $script:OutRoot ('selftest-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $script:OutRoot | Out-Null
New-Item -ItemType Directory $root | Out-Null
$srcData = Join-Path $root 'source-data'
$port = Get-FreePort
$started = $false

$mock = @'
do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service' || '_role', 'supabase_auth_admin'] loop execute format('create role %I nologin', r); end loop; end $$;
create schema extensions; create extension pgcrypto schema extensions; create extension btree_gist schema extensions;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, encrypted_password text, created_at timestamptz default now(), raw_user_meta_data jsonb);
create table auth.identities(id uuid primary key, user_id uuid references auth.users(id), provider text, identity_data jsonb);
create table auth.sessions(id uuid primary key, user_id uuid, refreshed_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create schema storage;
create table storage.buckets(id text primary key, public boolean, file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, name text);
create schema backup_20261013; create table backup_20261013.bookings(id int primary key);
create type public.mstatus as enum ('pending', 'approved');
create table public.profiles(id uuid primary key references auth.users(id), full_name text, bio text);
create table public.hoas(id uuid primary key default gen_random_uuid(), name text);
create table public.hoa_memberships(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), hoa_id uuid references public.hoas(id), status public.mstatus);
create table public.bookings(id serial primary key, user_id uuid, d date, note text, blob bytea, amount numeric(10,2), f float8, span tstzrange, exclude using gist (user_id with =, span with &&));
create table public.maintenance_reports(id uuid primary key default gen_random_uuid(), body text);
create table public.ident(id int generated always as identity primary key, v text);
alter table public.profiles enable row level security;
create policy own on public.profiles for select to authenticated using (id = auth.uid());
create function public.touch() returns trigger language plpgsql security definer set search_path = public as $$ begin new.bio := coalesce(new.bio, 'x'); return new; end $$;
create trigger t_touch before insert on public.profiles for each row execute function public.touch();
create view public.v_names as select full_name from public.profiles;
create materialized view public.mv_names as select full_name from public.profiles;
grant select on public.profiles to authenticated;
grant execute on function public.touch() to anon;
insert into auth.users(id, email, encrypted_password, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111', 'a@example.test', '$2a$10$abcdefghijklmnopqrstuv', '{"k": [1, 2, {"x": null}]}'),
 ('22222222-2222-2222-2222-222222222222', 'josé@example.test', '$2a$10$zyxwvutsrqponmlkjihgfe', null);
insert into auth.identities values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'email', '{"sub": "1"}');
insert into auth.sessions(id, user_id) values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');
insert into public.profiles values ('11111111-1111-1111-1111-111111111111', 'Ann Äö', null), ('22222222-2222-2222-2222-222222222222', 'José', 'bio');
insert into public.hoas(id, name) values ('55555555-5555-5555-5555-555555555555', 'Greens');
insert into public.hoa_memberships(user_id, hoa_id, status) values ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'approved');
insert into public.bookings(user_id, d, note, blob, amount, f, span) values ('11111111-1111-1111-1111-111111111111', '2026-10-20', E'multi\nline "quoted" \\ back', '\xdeadbeef', 12.50, 0.1, tstzrange('2026-10-20 10:00+00', '2026-10-20 11:00+00'));
insert into storage.buckets values ('reports', false, 1000); insert into storage.objects(bucket_id, name) values ('reports', 'a.jpg');
insert into supabase_migrations.schema_migrations values ('20261013181317', 'x'); insert into backup_20261013.bookings values (1);
insert into public.maintenance_reports(body) values ('leak');
'@

try {
    Write-Host 'Argument quoting'
    Check 'trailing backslash is doubled' ((ConvertTo-WinArg 'C:\a b\') -eq '"C:\a b\\"')
    Check 'embedded quote is escaped' ((ConvertTo-WinArg 'a"b') -eq '"a\"b"')

    Write-Host 'Building the mock source database'
    Clear-PgEnv
    Set-PgConnection -PgHost '127.0.0.1' -Port "$port" -User 'postgres' -Database 'postgres' -Password '' -SslMode 'disable'
    $code = Invoke-Pg 'initdb.exe' @('-D', $srcData, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C') (Join-Path $root 'i.out') (Join-Path $root 'i.err')
    if ($code -ne 0) { throw 'initdb failed' }
    $started = $true
    if (-not (Start-PgServer -DataDir $srcData -Port "$port" -LogFile (Join-Path $root 'src.log') -WorkDir $root)) { throw 'source server did not start' }
    Write-Utf8NoBom (Join-Path $root 'mock.sql') $mock
    $code = Invoke-Pg 'psql.exe' @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', (Join-Path $root 'mock.sql')) (Join-Path $root 'm.out') (Join-Path $root 'm.err')
    if ($code -ne 0) { throw "mock data failed: $(Get-Content (Join-Path $root 'm.err') -Raw)" }

    Write-Host 'Backup'
    $bk = Join-Path $root 'backup1'
    New-Item -ItemType Directory $bk | Out-Null
    $null = Invoke-BackupCore -Dir $bk -VerifySqlPath (Join-Path $PSScriptRoot '..\..\docs\onboarding\HOSTED-VERIFY-READONLY.sql')
    Check 'BACKUP-COMPLETE written' (Test-Path (Join-Path $bk 'BACKUP-COMPLETE.txt'))
    Check 'main fingerprint leaves the login-token table out' (-not (Select-String -Path (Join-Path $bk 'fingerprint-before.txt') -Pattern 'auth.sessions' -Quiet))
    Check 'login-token table has its own fingerprint' (Select-String -Path (Join-Path $bk 'volatile-before.txt') -Pattern 'V\|auth.sessions\|1\|' -Quiet)
    Check 'row level security flag is recorded' (Select-String -Path (Join-Path $bk 'fingerprint-before.txt') -Pattern 'I\|relflags\|' -Quiet)
    Check 'login tokens were stable' (([IO.File]::ReadAllText((Join-Path $bk 'volatile-stable.txt'))).Trim() -eq 'true')
    Check 'fingerprint has auth.users' ((Get-TableCount (Join-Path $bk 'fingerprint-before.txt') 'auth.users') -eq 2)
    Check 'no password-like material in saved SQL/logs' (-not (Select-String -Path (Join-Path $bk '*.err.txt') -Pattern 'PGPASSWORD' -Quiet -ErrorAction SilentlyContinue))

    Write-Host 'The fingerprint must notice a change that keeps every row the same'
    $probe = Join-Path $root 'probe'; New-Item -ItemType Directory $probe | Out-Null
    $null = Invoke-Query $probe 'p-before' (Get-FingerprintSql)
    $null = Invoke-Query $probe 'p-same' (Get-FingerprintSql)
    Check 'fingerprint is repeatable' ((Compare-Fingerprints (Join-Path $probe 'p-before.txt') (Join-Path $probe 'p-same.txt')).Match)
    $alter = Join-Path $probe 'alter.sql'
    Write-Utf8NoBom $alter "alter table public.ident alter column id set generated by default;`nalter table public.profiles disable row level security;"
    $null = Invoke-Pg 'psql.exe' @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $alter) (Join-Path $probe 'a.out') (Join-Path $probe 'a.err')
    $null = Invoke-Query $probe 'p-after' (Get-FingerprintSql)
    $chg = Compare-Fingerprints (Join-Path $probe 'p-before.txt') (Join-Path $probe 'p-after.txt')
    Check 'identity mode / RLS flag changes are detected' ((-not $chg.Match) -and $chg.Differences.Count -ge 2)

    Write-Host 'Restore verification of the good backup'
    Clear-PgEnv
    $ok = Invoke-RestoreVerify -BackupDir $bk
    Check 'good backup verifies' ($ok -eq $true)
    Check 'RESTORE-VERIFIED written' (Test-Path (Join-Path $bk 'RESTORE-VERIFIED.txt'))
    Check 'scratch folder removed' (-not (Test-Path (Join-Path $bk 'scratch-restore')))

    Write-Host 'Damaged backups must be rejected'
    $bad1 = Join-Path $root 'backup-tampered-dump'
    Copy-Item -LiteralPath $bk -Destination $bad1 -Recurse
    $bytes = [IO.File]::ReadAllBytes((Join-Path $bad1 'full.dump')); $bytes[$bytes.Length - 40] = $bytes[$bytes.Length - 40] -bxor 0xFF
    [IO.File]::WriteAllBytes((Join-Path $bad1 'full.dump'), $bytes)
    Check 'modified dump is rejected by the checksum' (Throws { Invoke-RestoreVerify -BackupDir $bad1 })
    Check 'stale RESTORE-VERIFIED removed on a failed attempt' (-not (Test-Path (Join-Path $bad1 'RESTORE-VERIFIED.txt')))

    $bad2 = Join-Path $root 'backup-wrong-baseline'
    Copy-Item -LiteralPath $bk -Destination $bad2 -Recurse
    foreach ($f in 'fingerprint-before.txt', 'fingerprint-after.txt') {
        $p = Join-Path $bad2 $f
        $t = [IO.File]::ReadAllText($p) -replace '(T\|public\.profiles\|2\|)[0-9a-f]{32}', '${1}00000000000000000000000000000000'
        [IO.File]::WriteAllText($p, $t)
    }
    # Rebuild the manifest over exactly the files the original manifest listed (a forger who also fixes the checksums).
    $names = [IO.File]::ReadAllLines((Join-Path $bk 'MANIFEST.sha256')) | ForEach-Object { ($_ -split '  ', 2)[1] }
    $lines = $names | Sort-Object | ForEach-Object { '{0}  {1}' -f (Get-FileHash -LiteralPath (Join-Path $bad2 $_) -Algorithm SHA256).Hash, $_ }
    [IO.File]::WriteAllLines((Join-Path $bad2 'MANIFEST.sha256'), [string[]]$lines)
    $c = [IO.File]::ReadAllText((Join-Path $bad2 'BACKUP-COMPLETE.txt')) -replace 'manifest-sha256: [0-9A-F]{64}', ('manifest-sha256: ' + (Get-FileHash -LiteralPath (Join-Path $bad2 'MANIFEST.sha256') -Algorithm SHA256).Hash)
    [IO.File]::WriteAllText((Join-Path $bad2 'BACKUP-COMPLETE.txt'), $c)
    Clear-PgEnv
    $ok2 = Invoke-RestoreVerify -BackupDir $bad2
    Check 'a baseline that disagrees with the restored data is NOT verified' ($ok2 -eq $false)
    Check 'no RESTORE-VERIFIED for it' (-not (Test-Path (Join-Path $bad2 'RESTORE-VERIFIED.txt')))

    $bad3 = Join-Path $root 'backup-no-manifest-entry'
    Copy-Item -LiteralPath $bk -Destination $bad3 -Recurse
    [IO.File]::WriteAllText((Join-Path $bad3 'MANIFEST.sha256'), '')
    Check 'empty manifest is rejected' (Throws { Invoke-RestoreVerify -BackupDir $bad3 })

    $bad4 = Join-Path $root 'backup-stale-readonly-marker'
    Copy-Item -LiteralPath $bk -Destination $bad4 -Recurse
    Set-ItemProperty -LiteralPath (Join-Path $bad4 'RESTORE-VERIFIED.txt') -Name IsReadOnly -Value $true
    [IO.File]::WriteAllText((Join-Path $bad4 'MANIFEST.sha256'), '')
    $null = Throws { Invoke-RestoreVerify -BackupDir $bad4 }
    Check 'a read-only stale success marker is removed even when verification fails' (-not (Test-Path (Join-Path $bad4 'RESTORE-VERIFIED.txt')))
    $script:completed = $true
}
finally {
    Clear-PgEnv
    $stopped = $true
    if ($started -and (Test-Path -LiteralPath (Join-Path $srcData 'postmaster.pid'))) {
        $env:PGHOST = '127.0.0.1'
        $null = Invoke-Pg 'pg_ctl.exe' @('-D', $srcData, '-m', 'fast', '-w', 'stop') (Join-Path $root 'stop.out') (Join-Path $root 'stop.err')
        Clear-PgEnv
        $stopped = -not (Test-Path -LiteralPath (Join-Path $srcData 'postmaster.pid'))
    }
    $item = Get-Item -LiteralPath $root -ErrorAction SilentlyContinue
    # Keep the folder (mock data only) when anything failed so the logs can be inspected.
    if ($item -and $stopped -and $script:completed -and ($script:fail -eq 0) -and $item.Name -like 'selftest-*' -and $item.Parent.FullName -eq (Resolve-Path $script:OutRoot).Path -and -not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    }
    elseif ($item) { Write-Warning "Self-test folder kept for inspection: $root" }
}
Write-Host ''
if ($script:fail -eq 0) { Write-Host 'SELF-TEST PASSED' -ForegroundColor Green; exit 0 }
Write-Host "SELF-TEST FAILED ($script:fail check(s))" -ForegroundColor Red; exit 1
