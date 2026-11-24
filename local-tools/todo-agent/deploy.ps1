# Installs or updates todo-agent on a remote host over SSH.
# Usage: .\deploy.ps1 <ssh-host>   (e.g. .\deploy.ps1 gateway)
param(
    [Parameter(Mandatory = $true)][string]$Server
)
$ErrorActionPreference = 'Stop'

$remoteDir = '/tmp/todo-agent'

function Invoke-Native([string]$Label, [scriptblock]$Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit code $LASTEXITCODE)" }
}

Write-Host "==> Copying files to ${Server}:$remoteDir"
Invoke-Native 'Cleaning remote directory' { ssh $Server "rm -rf $remoteDir" }
Invoke-Native 'Copying files' { scp -r -q $PSScriptRoot "${Server}:$remoteDir" }

Write-Host "==> Running the installer on $Server"
# -t gives the remote installer the terminal it needs for login and trust prompts.
ssh -t $Server "sudo bash $remoteDir/install.sh; rc=`$?; rm -rf $remoteDir; exit `$rc"
if ($LASTEXITCODE -ne 0) { throw "Remote installation failed (exit code $LASTEXITCODE)" }
