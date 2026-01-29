# AVR Recording Fixes - Local Deployment Script (PowerShell)
# This script builds and restarts services locally for testing

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "AVR Recording Fixes - Local Deployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Backend
Write-Host "[1/7] Building Backend..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
Set-Location "avr-app\backend"

Write-Host "Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Building TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build backend" -ForegroundColor Red
    exit 1
}

Write-Host "Building Docker image..."
docker build -t agentvoiceresponse/avr-app-backend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build backend Docker image" -ForegroundColor Red
    exit 1
}

Set-Location "..\..\"
Write-Host "✓ Backend built successfully!" -ForegroundColor Green
Write-Host ""

# Step 2: Build Frontend
Write-Host "[2/7] Building Frontend..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
Set-Location "avr-app\frontend"

Write-Host "Installing dependencies (including @radix-ui/react-switch)..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Building Next.js application..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build frontend" -ForegroundColor Red
    exit 1
}

Write-Host "Building Docker image..."
docker build -t agentvoiceresponse/avr-app-frontend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build frontend Docker image" -ForegroundColor Red
    exit 1
}

Set-Location "..\..\"
Write-Host "✓ Frontend built successfully!" -ForegroundColor Green
Write-Host ""

# Step 3: Create Recordings Directory
Write-Host "[3/7] Creating Recordings Directory..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
$recordingsPath = "asterisk\recordings\demo"
if (-not (Test-Path $recordingsPath)) {
    New-Item -Path $recordingsPath -ItemType Directory -Force | Out-Null
    Write-Host "Created: $recordingsPath" -ForegroundColor Green
} else {
    Write-Host "Directory already exists: $recordingsPath" -ForegroundColor Green
}
Get-ChildItem -Path $recordingsPath -Force
Write-Host ""

# Step 4: Stop Services
Write-Host "[4/7] Stopping Services..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker-compose -f docker-compose-production.yml down
Write-Host "✓ Services stopped" -ForegroundColor Green
Write-Host ""

# Step 5: Start Services
Write-Host "[5/7] Starting Services..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker-compose -f docker-compose-production.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start services" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Services started" -ForegroundColor Green
Write-Host ""

# Step 6: Wait for Services
Write-Host "[6/7] Waiting for Services to Initialize..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
Write-Host "Waiting 15 seconds for services to start..."
Start-Sleep -Seconds 15
Write-Host ""

# Step 7: Verify Services
Write-Host "[7/7] Verifying Services..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

Write-Host "`nRunning containers:"
docker-compose -f docker-compose-production.yml ps

Write-Host "`nChecking backend environment variable:"
docker exec avr-app-backend env | Select-String "ASTERISK_MONITOR_PATH"

Write-Host "`nBackend logs (last 30 lines):"
docker logs --tail 30 avr-app-backend

Write-Host "`nFrontend status:"
docker logs --tail 10 avr-app-frontend

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✓ Deployment Completed Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Services are now running locally:" -ForegroundColor Yellow
Write-Host "  - Frontend: " -NoNewline
Write-Host "https://agent.callbust.com" -ForegroundColor Cyan
Write-Host "  - Backend API: " -NoNewline
Write-Host "https://agent.callbust.com/api" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open https://agent.callbust.com in your browser"
Write-Host "2. Log in to the dashboard"
Write-Host "3. Go to Numbers page"
Write-Host "4. Create or edit a number"
Write-Host "5. " -NoNewline
Write-Host "Toggle 'Recording' to ON" -ForegroundColor Green -NoNewline
Write-Host " (you'll see the new switch UI!)"
Write-Host "6. Make a test call"
Write-Host "7. Check Recordings page"
Write-Host ""

Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  - View backend logs:  " -NoNewline
Write-Host "docker logs -f avr-app-backend" -ForegroundColor Cyan
Write-Host "  - View frontend logs: " -NoNewline
Write-Host "docker logs -f avr-app-frontend" -ForegroundColor Cyan
Write-Host "  - List recordings:    " -NoNewline
Write-Host "Get-ChildItem asterisk\recordings\demo" -ForegroundColor Cyan
Write-Host "  - Restart services:   " -NoNewline
Write-Host "docker-compose -f docker-compose-production.yml restart" -ForegroundColor Cyan
Write-Host ""
