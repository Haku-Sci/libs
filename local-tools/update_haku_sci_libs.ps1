# Local version of the lib we want every service to align on
$libPackageJson = Get-Content "$PSScriptRoot\..\package.json" -Raw | ConvertFrom-Json
$expectedVersion = $libPackageJson.version
Write-Host "Local @haku-sci/utils version: $expectedVersion" -ForegroundColor Yellow

# Resolve the actual latest version from the registry (bypasses npm's local metadata cache,
# which can otherwise make `@latest` resolve to a stale version)
$registryLatest = (npm view @haku-sci/utils version --prefer-online).Trim()
if ($LASTEXITCODE -ne 0 -or -not $registryLatest) {
    Write-Host "Could not resolve @haku-sci/utils latest version from the registry." -ForegroundColor Red
    exit 1
}
Write-Host "Registry @haku-sci/utils latest version: $registryLatest" -ForegroundColor Yellow

if ($registryLatest -ne $expectedVersion) {
    Write-Host "Warning: registry latest ($registryLatest) does not match local libs version ($expectedVersion). Did you forget to publish?" -ForegroundColor Red
}

# Discover every service under ../../services that depends on @haku-sci/utils
$servicesRoot = Resolve-Path "$PSScriptRoot\..\..\services"
$services = Get-ChildItem -Path $servicesRoot -Directory | Where-Object {
    $pkgPath = Join-Path $_.FullName "package.json"
    if (-not (Test-Path $pkgPath)) { return $false }
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    ($pkg.dependencies.PSObject.Properties.Name -contains "@haku-sci/utils") -or
    ($pkg.devDependencies.PSObject.Properties.Name -contains "@haku-sci/utils")
}

if (-not $services) {
    Write-Host "No service using @haku-sci/utils was found." -ForegroundColor Red
    exit 1
}

Write-Host "Services using @haku-sci/utils: $($services.Name -join ', ')" -ForegroundColor Yellow

foreach ($service in $services) {
    $serviceName = $service.Name
    $servicePath = $service.FullName
    $updatedPkg = $null
    $installedVersion = $null

    Write-Host "Installing @haku-sci/utils@$registryLatest for microservice: $serviceName" -ForegroundColor Green
    npm --prefix $servicePath install "@haku-sci/utils@$registryLatest" --save --prefer-online
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing @haku-sci/utils for $serviceName" -ForegroundColor Red
        continue
    }

    $updatedPkg = Get-Content (Join-Path $servicePath "package.json") -Raw | ConvertFrom-Json
    $installedVersion = $updatedPkg.dependencies.'@haku-sci/utils'
    if (-not $installedVersion) { $installedVersion = $updatedPkg.devDependencies.'@haku-sci/utils' }
    $installedVersion = $installedVersion.TrimStart('^', '~')

    if ($installedVersion -eq $registryLatest) {
        Write-Host "Installation completed for $serviceName (version $installedVersion matches registry latest)" -ForegroundColor Cyan
    } else {
        Write-Host "Warning: $serviceName installed version $installedVersion does not match registry latest $registryLatest" -ForegroundColor Red
    }
}
