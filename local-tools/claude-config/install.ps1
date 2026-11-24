# Installs the versioned Claude config into the services workspace. Safe to rerun.
# Usage: .\install.ps1            (defaults to D:\Haku-Sci\services)
param([string]$Workspace = (Join-Path $PSScriptRoot '..\..\..\services'))
$ErrorActionPreference = 'Stop'
$Workspace = (Resolve-Path $Workspace).Path
$source = Join-Path $PSScriptRoot '.claude'
$backup = Join-Path (Split-Path $Workspace) ".claude-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"

function Backup-Item([string]$Path) {
    New-Item -ItemType Directory -Force $backup | Out-Null
    Move-Item $Path $backup
    Write-Host "  moved $Path to $backup"
}

Write-Host "==> $Workspace\.claude -> $source"
$target = Join-Path $Workspace '.claude'
$item = Get-Item $target -Force -ErrorAction SilentlyContinue
if ($item -and $item.LinkType -eq 'Junction' -and $item.Target -contains $source) {
    Write-Host '  junction already in place'
} else {
    if ($item) {
        # Keep the machine-local settings across the switch.
        $local = Join-Path $target 'settings.local.json'
        if ((Test-Path $local) -and -not (Test-Path (Join-Path $source 'settings.local.json'))) {
            Copy-Item $local $source
        }
        Backup-Item $target
    }
    New-Item -ItemType Junction -Path $target -Target $source | Out-Null
    Write-Host '  junction created'
}

# CLAUDE.md sits in the workspace's parent: Claude Code also loads parent CLAUDE.md files,
# so the services folder keeps only the services.
$root = Split-Path $Workspace
Write-Host "==> $root\CLAUDE.md"
$claudeMd = Join-Path $root 'CLAUDE.md'
$import = '@libs/local-tools/claude-config/CLAUDE.md'
if ((Test-Path $claudeMd) -and ((Get-Content $claudeMd -Raw).Trim() -ne $import)) { Backup-Item $claudeMd }
# No BOM: Windows PowerShell's utf8 adds one, which would hide the leading @ import.
[IO.File]::WriteAllText($claudeMd, "$import`n", (New-Object Text.UTF8Encoding $false))
$oldClaudeMd = Join-Path $Workspace 'CLAUDE.md'
if (Test-Path $oldClaudeMd) { Backup-Item $oldClaudeMd }

Write-Host "==> $Workspace\.mcp.json"
$mcp = Join-Path $Workspace '.mcp.json'
if (Test-Path $mcp) {
    $same = (Get-FileHash $mcp).Hash -eq (Get-FileHash (Join-Path $PSScriptRoot 'mcp.json')).Hash
    if (-not $same) { Backup-Item $mcp }
}
Copy-Item (Join-Path $PSScriptRoot 'mcp.json') $mcp -Force

Write-Host '==> git pre-push /qa gate'
$gate = (Join-Path $PSScriptRoot 'git-hooks\qa-gate.js') -replace '\\', '/'
$gateLine = "node `"$gate`" || exit 1"
$noBom = New-Object Text.UTF8Encoding $false
$repos = @(Get-ChildItem $Workspace -Directory) + @(Get-Item (Join-Path (Split-Path $Workspace) 'libs'))
foreach ($repo in $repos | Where-Object { Test-Path (Join-Path $_.FullName '.git') -PathType Container }) {
    $hook = Join-Path $repo.FullName '.git\hooks\pre-push'
    if (-not (Test-Path $hook)) {
        $content = "#!/usr/bin/env bash`n$gateLine`n"
    } else {
        $lines = (Get-Content $hook -Raw) -split "`r?`n"
        if ($lines -contains $gateLine) { Write-Host "  $($repo.Name): already gated"; continue }
        Copy-Item $hook "$hook.before-qa-gate"
        # The gate goes first: it must refuse the push before any other pre-push work runs.
        $content = (@($lines[0], $gateLine) + $lines[1..($lines.Count - 1)]) -join "`n"
    }
    [IO.File]::WriteAllText($hook, $content, $noBom)
    Write-Host "  $($repo.Name): gated"
}
Write-Host 'Done. Restart Claude Code, then check /mcp and /hooks.'
