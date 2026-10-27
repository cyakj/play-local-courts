<#
Takes a read-only backup of the hosted TenisX Supabase project (TENISX REAL) into a new folder OUTSIDE the repo
(%USERPROFILE%\tenisx-backups\<timestamp>). Nothing in the hosted database is changed.

Run in a NEW PowerShell window (no transcript running):
  powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\backup.ps1

The only thing it asks for is the database password, typed hidden. The server name, user and database are fixed in this
script, so no connection string is ever pasted. The password is passed to the PostgreSQL tools through a process
environment variable only and is cleared when the script ends.
#>
[CmdletBinding()]
param(
    # Only needed if neither default pooler host works; must be a Supabase session-pooler host name.
    [string]$PoolerHost = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-Tools

$verifySql = Join-Path $PSScriptRoot '..\..\docs\onboarding\HOSTED-VERIFY-READONLY.sql'
$hostPattern = '^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$'
$candidates = if ($PoolerHost) { @($PoolerHost) } else { @('aws-1-us-east-1.pooler.supabase.com', 'aws-0-us-east-1.pooler.supabase.com') }
foreach ($h in $candidates) { if ($h -cnotmatch $hostPattern) { throw "'$h' is not a Supabase session-pooler host name." } }

$dbUser = "postgres.$script:ProjectRef"

Write-Host ''
Write-Host 'TenisX hosted backup (read-only). Type the database password for the "postgres" user and press Enter.'
Write-Host 'Nothing will appear while you type or paste. That is normal.'
$secure = Read-Host -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrEmpty($plain)) { throw 'Empty password.' }

    New-Item -ItemType Directory -Force $script:OutRoot | Out-Null
    $stamp = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), ([guid]::NewGuid().ToString('N').Substring(0, 6))
    $dir = Join-Path $script:OutRoot $stamp
    New-Item -ItemType Directory $dir | Out-Null    # no -Force: must be a brand new folder
    Lock-Directory $dir
    Write-Host "Backup folder: $dir"

    $connected = $false
    foreach ($h in $candidates) {
        Set-PgConnection -PgHost $h -Port '5432' -User $dbUser -Database 'postgres' -Password $plain -SslMode 'require'
        try { $null = Invoke-Query $dir ('connect-' + $h.Split('.')[0]) 'select 1;'; $connected = $true; Write-Host "Connected via $h"; break }
        catch { Write-Host "  could not connect via $h" }
    }
    $plain = $null
    if (-not $connected) {
        throw ("Could not connect. Check the password, then see the *.err.txt files in $dir. If the password is right, copy the host name " +
            "from Supabase > Connect > Session pooler and run again with -PoolerHost <that host name>.")
    }

    $summary = Invoke-BackupCore -Dir $dir -VerifySqlPath $verifySql
    Write-Host ''
    $summary | ForEach-Object { Write-Host $_ }
    Write-Host ''
    Write-Host "Backup folder: $dir" -ForegroundColor Green
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Clear-PgEnv
}
