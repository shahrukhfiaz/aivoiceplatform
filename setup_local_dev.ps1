# AVR Local Development Setup Script for Windows
# This script sets up the local development environment

Write-Host "=== AVR Local Development Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Node.js version: $nodeVersion" -ForegroundColor Green

$npmVersion = npm --version 2>$null
Write-Host "[OK] npm version: $npmVersion" -ForegroundColor Green

# Check Docker
Write-Host ""
Write-Host "Checking Docker installation..." -ForegroundColor Yellow
$dockerVersion = docker --version 2>$null
if (-not $dockerVersion) {
    Write-Host "WARNING: Docker is not installed or not running!" -ForegroundColor Yellow
    Write-Host "Docker is required for running agent containers." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Docker version: $dockerVersion" -ForegroundColor Green
}

# Create necessary directories
Write-Host ""
Write-Host "Creating necessary directories..." -ForegroundColor Yellow
$directories = @(
    "avr-app\backend\data",
    "avr-app\frontend\.next"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "[OK] Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "[OK] Exists: $dir" -ForegroundColor Gray
    }
}

# Install Backend Dependencies
Write-Host ""
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "avr-app\backend"
if (Test-Path "node_modules") {
    Write-Host "node_modules exists, skipping install..." -ForegroundColor Gray
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Backend npm install failed!" -ForegroundColor Red
        Set-Location ..\..
        exit 1
    }
}
Write-Host "[OK] Backend dependencies installed" -ForegroundColor Green
Set-Location ..\..

# Install Frontend Dependencies
Write-Host ""
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "avr-app\frontend"
if (Test-Path "node_modules") {
    Write-Host "node_modules exists, skipping install..." -ForegroundColor Gray
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend npm install failed!" -ForegroundColor Red
        Set-Location ..\..
        exit 1
    }
}
Write-Host "[OK] Frontend dependencies installed" -ForegroundColor Green
Set-Location ..\..

# Create .env files if they don't exist
Write-Host ""
Write-Host "Setting up environment files..." -ForegroundColor Yellow

# Backend .env
$backendEnv = "avr-app\backend\.env"
if (-not (Test-Path $backendEnv)) {
    $backendEnvContent = @"
# Database
DB_PATH=./data/avr.db

# JWT
JWT_SECRET=$(New-Guid)
JWT_EXPIRES_IN=7d

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# Docker
# On Windows, dockerode automatically uses named pipe: \\.\pipe\docker_engine
# Leave empty for auto-detection, or set to /var/run/docker.sock for Linux
DOCKER_SOCKET_PATH=

# Asterisk ARI
ARI_URL=http://localhost:8088/ari
ARI_USERNAME=asterisk
ARI_PASSWORD=asterisk

# Webhooks
WEBHOOK_URL=http://localhost:3001/webhooks
WEBHOOK_SECRET=$(New-Guid)

# AMI
AMI_URL=http://localhost:6006
"@
    Set-Content -Path $backendEnv -Value $backendEnvContent
    Write-Host "Created: $backendEnv" -ForegroundColor Green
} else {
    Write-Host "Exists: $backendEnv" -ForegroundColor Gray
}

# Frontend .env.local
$frontendEnv = "avr-app\frontend\.env.local"
if (-not (Test-Path $frontendEnv)) {
    $frontendEnvContent = @"
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBRTC_CLIENT_URL=http://localhost:3000/phone
"@
    Set-Content -Path $frontendEnv -Value $frontendEnvContent
    Write-Host "Created: $frontendEnv" -ForegroundColor Green
} else {
    Write-Host "Exists: $frontendEnv" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start Backend:  cd avr-app\backend; npm run start:dev" -ForegroundColor White
Write-Host "2. Start Frontend: cd avr-app\frontend; npm run start:dev" -ForegroundColor White
Write-Host ""
Write-Host "Then open http://localhost:3000 in your browser" -ForegroundColor Green
Write-Host ""

