# microservices list
$microservices = @("api","accounts", "content", "graph", "third-party")

# Update hakusci libs for each microservice
foreach ($microservice in $microservices) {
    Write-Host "Installing @haku-sci/utils@latest for microservice: $microservice" -ForegroundColor Green
    npm --prefix ../services/$microservice install @haku-sci/utils@latest --save
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing @haku-sci/utils for $microservice" -ForegroundColor Red
    } else {
        Write-Host "Installation completed for $microservice" -ForegroundColor Cyan
    }
}
