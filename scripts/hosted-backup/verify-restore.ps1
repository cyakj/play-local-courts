<#
Proves a backup made by backup.ps1 can be restored: restores full.dump into a throwaway PostgreSQL server that listens on
127.0.0.1 only (no service, no administrator rights), then compares hashes of every row of every table, and an inventory of
policies/functions/triggers/indexes/constraints/views, with the values recorded from the live project.
Needs no password and never contacts Supabase. The scratch server and its files are removed afterwards.

Run:  powershell -ExecutionPolicy Bypass -File scripts\hosted-backup\verify-restore.ps1 -BackupDir C:\Users\info\tenisx-backups\<folder>
#>
[CmdletBinding()]
param([Parameter(Mandatory)][string]$BackupDir)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
try {
    # Invalidate any earlier success marker first, so no later failure (even a missing tool) can leave a stale one behind.
    $null = Clear-VerificationEvidence -BackupDir $BackupDir
    Assert-Tools
    $ok = Invoke-RestoreVerify -BackupDir $BackupDir
}
finally { Clear-PgEnv }
Write-Host ''
if ($ok) { Write-Host 'RESTORE VERIFIED - this backup is recoverable.' -ForegroundColor Green; exit 0 }
Write-Host 'RESTORE NOT VERIFIED - see restore-test.report.txt in the backup folder.' -ForegroundColor Red
exit 2
