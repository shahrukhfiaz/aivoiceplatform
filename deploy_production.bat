@echo off
REM AVR Production Deployment Script
REM Server: 192.241.179.25
REM Domain: agent.callbust.com
REM Deepgram API Key: ad748182032466add820eed184e6b81aefa06fcd

echo ========================================
echo AVR Production Deployment
echo Domain: agent.callbust.com
echo ========================================
echo.

REM Check if plink exists
where plink.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: plink.exe not found in PATH
    echo Please download plink.exe from PuTTY website
    pause
    exit /b 1
)

echo Step 1: Updating system packages...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "apt-get update -y && apt-get upgrade -y"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 2: Installing prerequisites...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "apt-get install -y curl wget git apt-transport-https ca-certificates gnupg lsb-release openssl"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 3: Installing Docker...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "echo 'deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable' | tee /etc/apt/sources.list.d/docker.list > /dev/null"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "apt-get update -y"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 4: Installing Docker Compose...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "curl -L 'https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64' -o /usr/local/bin/docker-compose"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "chmod +x /usr/local/bin/docker-compose"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 5: Starting Docker service...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "systemctl start docker && systemctl enable docker"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 6: Creating AVR directory...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "mkdir -p /opt/avr"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 7: Cloning AVR repositories...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-infra.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-app.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-sts-deepgram.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-ami.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-webhook.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-phone.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-asterisk.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-vad.git || true"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr && git clone https://github.com/agentvoiceresponse/avr-docs.git || true"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 8: Uploading production docker-compose file...
pscp.exe -pw Seahub123@ docker-compose-production.yml root@192.241.179.25:/opt/avr/avr-infra/
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 9: Configuring system optimizations...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "echo '* soft nofile 65536' >> /etc/security/limits.conf"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "echo '* hard nofile 65536' >> /etc/security/limits.conf"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "echo 'net.ipv4.udp_mem = 8388608 12582912 16777216' >> /etc/sysctl.conf"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "sysctl -p"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 10: Creating Docker network...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "docker network create avr 2>/dev/null || true"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 11: Uploading .env creation script...
pscp.exe -pw Seahub123@ create_env_file.sh root@192.241.179.25:/opt/avr/avr-infra/
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 12: Creating .env file with Deepgram API key...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr/avr-infra && chmod +x create_env_file.sh && ./create_env_file.sh"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 13: Configuring firewall...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "apt-get install -y ufw"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 22/tcp comment 'SSH'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 80/tcp comment 'HTTP'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 443/tcp comment 'HTTPS'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 5001/tcp comment 'AVR Core'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 5060/tcp comment 'SIP'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 5060/udp comment 'SIP UDP'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 10000:20000/udp comment 'RTP Media'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw allow 8080/tcp comment 'Traefik Dashboard'"
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "ufw --force enable"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 14: Starting services...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "cd /opt/avr/avr-infra && docker-compose -f docker-compose-production.yml up -d"
if %ERRORLEVEL% NEQ 0 goto :error

echo.
echo Step 15: Verifying installation...
plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "docker ps && echo '' && echo 'Firewall status:' && ufw status"

echo.
echo ========================================
echo Deployment completed successfully!
echo ========================================
echo.
echo Dashboard URL: https://agent.callbust.com
echo Default login:
echo   Username: admin
echo   Password: admin
echo.
echo IMPORTANT: Change admin password in the dashboard!
echo.
echo To check logs:
echo   ssh root@192.241.179.25
echo   cd /opt/avr/avr-infra
echo   docker-compose -f docker-compose-production.yml logs -f
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo ERROR: Deployment failed!
echo ========================================
echo Please check the error messages above.
echo.
pause
exit /b 1

