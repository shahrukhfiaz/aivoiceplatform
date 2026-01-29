# Quick Start Script - Run Backend and Frontend Locally
# This script starts both backend and frontend for local testing

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AVR Local Test - Recording Fixes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will start:" -ForegroundColor Yellow
Write-Host "  - Backend on http://localhost:3001" -ForegroundColor White
Write-Host "  - Frontend on http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop both services" -ForegroundColor Yellow
Write-Host ""

# Check if ports are available
$backendPort = Test-NetConnection -ComputerName localhost -Port 3001 -InformationLevel Quiet -WarningAction SilentlyContinue
$frontendPort = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue

if ($backendPort) {
    Write-Host "⚠ Port 3001 is already in use!" -ForegroundColor Red
    Write-Host "Run this to kill the process: " -NoNewline
    Write-Host "Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force" -ForegroundColor Cyan
    exit 1
}

if ($frontendPort) {
    Write-Host "⚠ Port 3000 is already in use!" -ForegroundColor Red
    Write-Host "Run this to kill the process: " -NoNewline
    Write-Host "Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force" -ForegroundColor Cyan
    exit 1
}

Write-Host "[1/2] Starting Backend..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Start backend in background
$backendJob = Start-Job -ScriptBlock {
    Set-Location "c:\AVR Multiple Campaigns\avr-app\backend"
    $env:PORT = "3001"
    $env:ASTERISK_MONITOR_PATH = "c:\AVR Multiple Campaigns\asterisk\recordings"
    $env:TENANT = "demo"
    $env:DB_DATABASE = "c:\AVR Multiple Campaigns\data\data.db"
    $env:ASTERISK_CONFIG_PATH = "c:\AVR Multiple Campaigns\asterisk"
    $env:FRONTEND_URL = "http://localhost:3000"
    $env:ARI_URL = "http://localhost:9088/ari"
    $env:ARI_USERNAME = "avr"
    $env:ARI_PASSWORD = "avr"
    $env:JWT_SECRET = "supersecret"
    npm run start:dev
}

Write-Host "✓ Backend job started (ID: $($backendJob.Id))" -ForegroundColor Green
Write-Host "Waiting 10 seconds for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host ""

Write-Host "[2/2] Starting Frontend..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Start frontend in background
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "c:\AVR Multiple Campaigns\avr-app\frontend"
    $env:NEXT_PUBLIC_API_URL = "http://localhost:3001"
    npm run start:dev
}

Write-Host "✓ Frontend job started (ID: $($frontendJob.Id))" -ForegroundColor Green
Write-Host "Waiting 15 seconds for frontend to build..." -ForegroundColor Yellow
Start-Sleep -Seconds 15
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Access the application:" -ForegroundColor Yellow
Write-Host "  Frontend: " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:  " -NoNewline
Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host ""

Write-Host "Backend logs (last 20 lines):" -ForegroundColor Yellow
Receive-Job -Job $backendJob -Keep | Select-Object -Last 20
Write-Host ""

Write-Host "Frontend logs (last 10 lines):" -ForegroundColor Yellow
Receive-Job -Job $frontendJob -Keep | Select-Object -Last 10
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to view logs and stop" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    while ($true) {
        Start-Sleep -Seconds 5

        # Check if jobs are still running
        if ($backendJob.State -eq "Failed") {
            Write-Host "⚠ Backend job failed!" -ForegroundColor Red
            Receive-Job -Job $backendJob
            break
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "⚠ Frontend job failed!" -ForegroundColor Red
            Receive-Job -Job $frontendJob
            break
        }

        # Show periodic status
        Write-Host "." -NoNewline -ForegroundColor Green
    }
}
catch {
    Write-Host ""
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
}
finally {
    Write-Host ""
    Write-Host "Backend logs:" -ForegroundColor Yellow
    Receive-Job -Job $backendJob
    Write-Host ""
    Write-Host "Frontend logs:" -ForegroundColor Yellow
    Receive-Job -Job $frontendJob
    Write-Host ""

    Write-Host "Stopping jobs..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob -Force

    Write-Host "✓ Services stopped" -ForegroundColor Green
}
