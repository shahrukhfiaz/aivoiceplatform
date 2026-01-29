# AVR Local Development Services Stop Script

Write-Host "=== Stopping AVR Services ===" -ForegroundColor Cyan
Write-Host ""

$composeFile = "docker-compose-local-dev.yml"

if (-not (Test-Path $composeFile)) {
    Write-Host "❌ $composeFile not found!" -ForegroundColor Red
    exit 1
}

docker-compose -f $composeFile down

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Services stopped successfully" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Failed to stop services" -ForegroundColor Red
    exit 1
}

