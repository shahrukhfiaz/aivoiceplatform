# Start AVR Local Development Environment
# This script starts both backend and frontend in separate windows

Write-Host "=== Starting AVR Development Environment ===" -ForegroundColor Cyan
Write-Host ""

# Check if services are already running
$backendRunning = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
$frontendRunning = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($backendRunning) {
    Write-Host "WARNING: Backend is already running on port 3001" -ForegroundColor Yellow
    Write-Host "You may need to stop it first or use a different port" -ForegroundColor Yellow
}
if ($frontendRunning) {
    Write-Host "WARNING: Frontend is already running on port 3000" -ForegroundColor Yellow
    Write-Host "You may need to stop it first or use a different port" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Backend in new window..." -ForegroundColor Yellow
$backendScript = @"
cd '$PSScriptRoot\avr-app\backend'
Write-Host 'Starting Backend on http://localhost:3001' -ForegroundColor Cyan
npm run start:dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

Start-Sleep -Seconds 3

Write-Host "Starting Frontend in new window..." -ForegroundColor Yellow
$frontendScript = @"
cd '$PSScriptRoot\avr-app\frontend'
Write-Host 'Starting Frontend on http://localhost:3000' -ForegroundColor Cyan
npm run start:dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

Write-Host ""
Write-Host "=== Development servers starting ===" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Two PowerShell windows have been opened:" -ForegroundColor Yellow
Write-Host "- One for Backend (NestJS)" -ForegroundColor White
Write-Host "- One for Frontend (Next.js)" -ForegroundColor White
Write-Host ""
Write-Host "Close those windows to stop the servers." -ForegroundColor Yellow
Write-Host "Wait a few seconds for servers to start, then open http://localhost:3000" -ForegroundColor Green
Write-Host ""
