$ErrorActionPreference = "Stop"

Write-Host "[gitlab-cleanup] Connecting to gateway..."

$remoteScript = Join-Path $PSScriptRoot "gitlab-cleanup-remote.sh"

Get-Content -Raw $remoteScript | ssh gateway "bash -s"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[gitlab-cleanup] ERROR: SSH command failed."
    exit 1
}

Write-Host "[gitlab-cleanup] Done."
