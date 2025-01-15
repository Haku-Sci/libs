# Projects list
$projects = @("api","accounts", "content", "graph", "third-party")

# Update hakusci libs for each project
foreach ($project in $projects) {
    Write-Host "Installing @haku-sci/utils@latest for project: $project" -ForegroundColor Green
    npm --prefix ../services/$project install @haku-sci/utils@latest --save
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing @haku-sci/utils for $project" -ForegroundColor Red
    } else {
        Write-Host "Installation completed for $project" -ForegroundColor Cyan
    }
}
