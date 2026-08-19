# Builds @haku-sci/utils and copies the fresh dist into every service's node_modules,
# so services can pick up local changes without publishing to npm.

$ErrorActionPreference = "Stop"

$libsRoot = Resolve-Path "$PSScriptRoot\.."
$servicesRoot = Resolve-Path "$libsRoot\..\services"

Write-Host "Building @haku-sci/utils..." -ForegroundColor Green
npm --prefix $libsRoot run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}

$sourceDist = Join-Path $libsRoot "dist"
if (-not (Test-Path $sourceDist)) {
    Write-Host "dist folder not found at $sourceDist" -ForegroundColor Red
    exit 1
}

$services = Get-ChildItem -Path $servicesRoot -Directory

foreach ($service in $services) {
    $libPath = Join-Path $service.FullName "node_modules\@haku-sci\utils"
    if (-not (Test-Path $libPath)) {
        continue
    }

    $targetDist = Join-Path $libPath "dist"
    Write-Host "Updating dist for service: $($service.Name)" -ForegroundColor Cyan

    if (Test-Path $targetDist) {
        Remove-Item -Recurse -Force $targetDist
    }
    Copy-Item -Recurse -Force $sourceDist $targetDist
}

Write-Host "Done." -ForegroundColor Green
