# Single Command Deployment Script
# This script uploads the deployment script and executes it

$SERVER_IP = "192.241.179.25"
$USERNAME = "root"
$PASSWORD = "Seahub123@"
$PLINK_PATH = "plink.exe"
$PSCP_PATH = "pscp.exe"

Write-Host "========================================" -ForegroundColor Green
Write-Host "AVR Cloud Server Deployment" -ForegroundColor Green
Write-Host "Server: $SERVER_IP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if deployment script exists
if (-not (Test-Path "deploy_avr_cloud.sh")) {
    Write-Host "Error: deploy_avr_cloud.sh not found!" -ForegroundColor Red
    Write-Host "Please ensure deploy_avr_cloud.sh is in the same directory." -ForegroundColor Yellow
    exit 1
}

# Upload the script
Write-Host "Uploading deployment script..." -ForegroundColor Yellow
& $PSCP_PATH -pw $PASSWORD deploy_avr_cloud.sh ${USERNAME}@${SERVER_IP}:/root/

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error uploading script!" -ForegroundColor Red
    exit 1
}

# Make it executable and run
Write-Host "Executing deployment script..." -ForegroundColor Yellow
& $PLINK_PATH -ssh -pw $PASSWORD ${USERNAME}@${SERVER_IP} "chmod +x /root/deploy_avr_cloud.sh && /root/deploy_avr_cloud.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Deployment completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. SSH into server: ssh root@$SERVER_IP" -ForegroundColor White
    Write-Host "2. cd /opt/avr/avr-infra" -ForegroundColor White
    Write-Host "3. Configure .env file with your API keys" -ForegroundColor White
    Write-Host "4. Start services: docker-compose -f docker-compose-deepgram.yml up -d" -ForegroundColor White
} else {
    Write-Host "Deployment encountered errors. Please check the output above." -ForegroundColor Red
}

