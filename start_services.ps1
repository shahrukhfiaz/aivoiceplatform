# AVR Local Development Services Startup Script
# This script starts all required AVR infrastructure services

Write-Host "=== AVR Local Development Services ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        exit 1
    }
    Write-Host "Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Docker is not installed or not running." -ForegroundColor Red
    Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if docker-compose.yml exists
$composeFile = "docker-compose-local-dev.yml"
if (-not (Test-Path $composeFile)) {
    Write-Host "$composeFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting AVR infrastructure services..." -ForegroundColor Yellow
Write-Host ""

# Start services
docker-compose -f $composeFile up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Services Started Successfully ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services running:" -ForegroundColor Cyan
    Write-Host "  - avr-asterisk  - PBX Server (SIP: 5060, AMI: 5038, ARI: 8088/8089)" -ForegroundColor White
    Write-Host "  - avr-ami       - AMI Service (http://localhost:6006)" -ForegroundColor White
    Write-Host "  - avr-phone     - Web Phone Client (http://localhost:8080)" -ForegroundColor White
    Write-Host ""
    Write-Host "To view logs:" -ForegroundColor Yellow
    Write-Host "  docker-compose -f $composeFile logs -f" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To stop services:" -ForegroundColor Yellow
    Write-Host "  docker-compose -f $composeFile down" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To check service status:" -ForegroundColor Yellow
    Write-Host "  docker-compose -f $composeFile ps" -ForegroundColor Gray
    Write-Host ""
    
    # Wait a moment and check service health
    Start-Sleep -Seconds 3
    Write-Host "Checking service health..." -ForegroundColor Yellow
    docker-compose -f $composeFile ps
} else {
    Write-Host ""
    Write-Host "Failed to start services. Check the error messages above." -ForegroundColor Red
    exit 1
}
