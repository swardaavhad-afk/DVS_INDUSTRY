[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupDirectory = "$PSScriptRoot/backups",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'DATABASE_URL is required.' }
$pgDump = (Get-Command pg_dump -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = Join-Path $BackupDirectory "dvs_factory-$stamp.dump"
& $pgDump $DatabaseUrl --format=custom --file=$output --no-owner --no-privileges
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
Get-ChildItem $BackupDirectory -Filter '*.dump' | Where-Object LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) | Remove-Item -Force
Write-Output "Created $output"
