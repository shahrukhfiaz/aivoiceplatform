#!/bin/bash
# DSAI Cloud Server Deployment Script
# This script can be uploaded to the server and executed directly

set -e

echo "========================================"
echo "DSAI Cloud Server Deployment"
echo "========================================"
echo ""

# Step 1: Update system
echo "Step 1: Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Step 2: Install prerequisites
echo "Step 2: Installing prerequisites..."
apt-get install -y curl wget git apt-transport-https ca-certificates gnupg lsb-release

# Step 3: Install Docker
echo "Step 3: Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Step 4: Install Docker Compose (standalone)
echo "Step 4: Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Step 5: Start and enable Docker
echo "Step 5: Starting Docker service..."
systemctl start docker
systemctl enable docker

# Step 6: Create DSAI directory
echo "Step 6: Creating DSAI directory structure..."
mkdir -p /opt/dsai
cd /opt/dsai

# Step 7: Clone all DSAI repositories
echo "Step 7: Cloning DSAI repositories..."

repos=(
    "dsai-infra"
    "dsai-app"
    "dsai-sts-deepgram"
    "dsai-ami"
    "dsai-webhook"
    "dsai-phone"
    "dsai-asterisk"
    "dsai-vad"
    "dsai-docs"
)

for repo in "${repos[@]}"; do
    echo "  Cloning $repo..."
    git clone https://github.com/agentvoiceresponse/$repo.git || echo "  Warning: $repo may already exist"
done

# Step 8: Set up system optimizations
echo "Step 8: Configuring system optimizations..."
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf
echo "net.core.rmem_max = 16777216" >> /etc/sysctl.conf
echo "net.core.wmem_max = 16777216" >> /etc/sysctl.conf
echo "net.ipv4.udp_mem = 8388608 12582912 16777216" >> /etc/sysctl.conf
sysctl -p

# Step 9: Create Docker network
echo "Step 9: Creating Docker network..."
docker network create dsai 2>/dev/null || true

# Step 10: Display summary
echo ""
echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo "All DSAI repositories have been cloned to: /opt/dsai"
echo ""
echo "Next Steps:"
echo "1. Navigate to: cd /opt/dsai/dsai-infra"
echo "2. Copy .env.example to .env: cp .env.example .env"
echo "3. Edit .env file with your API keys"
echo "4. Start services: docker-compose -f docker-compose-deepgram.yml up -d"
echo ""
echo "Repositories installed:"
for repo in "${repos[@]}"; do
    echo "  - /opt/dsai/$repo"
done
echo ""
echo "Deployment completed!"

