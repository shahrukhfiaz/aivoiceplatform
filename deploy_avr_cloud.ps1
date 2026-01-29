# AVR Cloud Server Deployment Script
# This script uses plink to deploy AVR services on a remote server
# Prerequisites: plink.exe must be in PATH or specify full path

$SERVER_IP = "192.241.179.25"
$USERNAME = "root"
$PASSWORD = "Seahub123@"
$PLINK_PATH = "plink.exe"  # Change to full path if plink is not in PATH

# Function to execute remote command
function Execute-RemoteCommand {
    param(
        [string]$Command
    )
    Write-Host "Executing: $Command" -ForegroundColor Cyan
    $result = echo y | & $PLINK_PATH -ssh -pw $PASSWORD $USERNAME@$SERVER_IP $Command
    return $result
}

# Function to execute remote command with output
function Execute-RemoteCommandWithOutput {
    param(
        [string]$Command
    )
    Write-Host "Executing: $Command" -ForegroundColor Cyan
    & $PLINK_PATH -ssh -pw $PASSWORD $USERNAME@$SERVER_IP $Command
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "AVR Cloud Server Deployment" -ForegroundColor Green
Write-Host "Server: $SERVER_IP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Step 1: Update system
Write-Host "Step 1: Updating system packages..." -ForegroundColor Yellow
Execute-RemoteCommand "apt-get update -y && apt-get upgrade -y"

# Step 2: Install prerequisites
Write-Host "Step 2: Installing prerequisites..." -ForegroundColor Yellow
Execute-RemoteCommand "apt-get install -y curl wget git apt-transport-https ca-certificates gnupg lsb-release"

# Step 3: Install Docker
Write-Host "Step 3: Installing Docker..." -ForegroundColor Yellow
Execute-RemoteCommand "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg"
Execute-RemoteCommand "echo 'deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable' | tee /etc/apt/sources.list.d/docker.list > /dev/null"
Execute-RemoteCommand "apt-get update -y"
Execute-RemoteCommand "apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"

# Step 4: Install Docker Compose (standalone)
Write-Host "Step 4: Installing Docker Compose..." -ForegroundColor Yellow
Execute-RemoteCommand "curl -L 'https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64' -o /usr/local/bin/docker-compose"
Execute-RemoteCommand "chmod +x /usr/local/bin/docker-compose"

# Step 5: Start and enable Docker
Write-Host "Step 5: Starting Docker service..." -ForegroundColor Yellow
Execute-RemoteCommand "systemctl start docker && systemctl enable docker"

# Step 6: Create AVR directory
Write-Host "Step 6: Creating AVR directory structure..." -ForegroundColor Yellow
Execute-RemoteCommand "mkdir -p /opt/avr && cd /opt/avr"

# Step 7: Clone all AVR repositories
Write-Host "Step 7: Cloning AVR repositories..." -ForegroundColor Yellow

$repos = @(
    "avr-infra",
    "avr-app",
    "avr-sts-deepgram",
    "avr-ami",
    "avr-webhook",
    "avr-phone",
    "avr-asterisk",
    "avr-vad",
    "avr-docs"
)

foreach ($repo in $repos) {
    Write-Host "  Cloning $repo..." -ForegroundColor Cyan
    Execute-RemoteCommand "cd /opt/avr && git clone https://github.com/agentvoiceresponse/$repo.git"
}

# Step 8: Set up system optimizations
Write-Host "Step 8: Configuring system optimizations..." -ForegroundColor Yellow
Execute-RemoteCommand "echo '* soft nofile 65536' >> /etc/security/limits.conf"
Execute-RemoteCommand "echo '* hard nofile 65536' >> /etc/security/limits.conf"
Execute-RemoteCommand "echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf"
Execute-RemoteCommand "echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf"
Execute-RemoteCommand "echo 'net.ipv4.udp_mem = 8388608 12582912 16777216' >> /etc/sysctl.conf"
Execute-RemoteCommand "sysctl -p"

# Step 9: Create Docker network
Write-Host "Step 9: Creating Docker network..." -ForegroundColor Yellow
Execute-RemoteCommand "docker network create avr 2>/dev/null || true"

# Step 10: Display summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "All AVR repositories have been cloned to: /opt/avr" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. SSH into the server: ssh root@$SERVER_IP" -ForegroundColor White
Write-Host "2. Navigate to: cd /opt/avr/avr-infra" -ForegroundColor White
Write-Host "3. Copy .env.example to .env: cp .env.example .env" -ForegroundColor White
Write-Host "4. Edit .env file with your API keys" -ForegroundColor White
Write-Host "5. Start services: docker-compose -f docker-compose-deepgram.yml up -d" -ForegroundColor White
Write-Host ""
Write-Host "Repositories installed:" -ForegroundColor Yellow
foreach ($repo in $repos) {
    Write-Host "  - /opt/avr/$repo" -ForegroundColor White
}
Write-Host ""
Write-Host "Deployment completed!" -ForegroundColor Green

