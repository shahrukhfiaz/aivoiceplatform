@echo off
REM AVR Recording Fixes - Local Deployment Script
REM This script builds and restarts services locally for testing

echo ==========================================
echo AVR Recording Fixes - Local Deployment
echo ==========================================
echo.

echo [1/7] Building Backend...
echo ----------------------------------------
cd avr-app\backend
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)

echo Building TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build backend
    pause
    exit /b 1
)

echo Building Docker image...
docker build -t agentvoiceresponse/avr-app-backend:latest .
if errorlevel 1 (
    echo ERROR: Failed to build backend Docker image
    pause
    exit /b 1
)
cd ..\..
echo Backend built successfully!
echo.

echo [2/7] Building Frontend...
echo ----------------------------------------
cd avr-app\frontend
echo Installing dependencies (including @radix-ui/react-switch)...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)

echo Building Next.js application...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build frontend
    pause
    exit /b 1
)

echo Building Docker image...
docker build -t agentvoiceresponse/avr-app-frontend:latest .
if errorlevel 1 (
    echo ERROR: Failed to build frontend Docker image
    pause
    exit /b 1
)
cd ..\..
echo Frontend built successfully!
echo.

echo [3/7] Creating Recordings Directory...
echo ----------------------------------------
if not exist "asterisk\recordings\demo" (
    mkdir asterisk\recordings\demo
    echo Created: asterisk\recordings\demo
) else (
    echo Directory already exists: asterisk\recordings\demo
)
dir asterisk\recordings\demo
echo.

echo [4/7] Stopping Services...
echo ----------------------------------------
docker-compose -f docker-compose-production.yml down
echo Services stopped
echo.

echo [5/7] Starting Services...
echo ----------------------------------------
docker-compose -f docker-compose-production.yml up -d
if errorlevel 1 (
    echo ERROR: Failed to start services
    pause
    exit /b 1
)
echo Services started
echo.

echo [6/7] Waiting for Services to Initialize...
echo ----------------------------------------
echo Waiting 15 seconds...
timeout /t 15 /nobreak
echo.

echo [7/7] Verifying Services...
echo ----------------------------------------
echo Running containers:
docker-compose -f docker-compose-production.yml ps
echo.

echo Checking backend environment variable:
docker exec avr-app-backend env | findstr ASTERISK_MONITOR_PATH
echo.

echo Backend logs (last 20 lines):
docker logs --tail 20 avr-app-backend
echo.

echo ==========================================
echo Deployment Completed Successfully!
echo ==========================================
echo.
echo Services are now running locally:
echo   - Frontend: https://agent.callbust.com
echo   - Backend API: https://agent.callbust.com/api
echo.
echo Next Steps:
echo 1. Open https://agent.callbust.com in your browser
echo 2. Log in to the dashboard
echo 3. Go to Numbers page
echo 4. Create or edit a number
echo 5. Toggle 'Recording' to ON (you'll see the new switch UI!)
echo 6. Make a test call
echo 7. Check Recordings page
echo.
echo Useful Commands:
echo   - View backend logs:  docker logs -f avr-app-backend
echo   - View frontend logs: docker logs -f avr-app-frontend
echo   - List recordings:    dir asterisk\recordings\demo
echo   - Restart services:   docker-compose -f docker-compose-production.yml restart
echo.
pause
