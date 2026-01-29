#!/bin/bash
# Complete AVR Deployment - Run on server
set -e

echo "========================================"
echo "Completing AVR Deployment"
echo "========================================"

# Wait for apt to finish (with timeout)
echo "Waiting for apt to finish..."
timeout=600
elapsed=0
while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
    if [ $elapsed -ge $timeout ]; then
        echo "Timeout reached. Killing apt process..."
        pkill -9 apt-get || true
        sleep 5
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    if [ $((elapsed % 30)) -eq 0 ]; then
        echo "Still waiting... ($elapsed seconds)"
    fi
done

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    systemctl start docker
    systemctl enable docker
    echo "Docker installed!"
else
    echo "Docker already installed!"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "Docker Compose installed!"
else
    echo "Docker Compose already installed!"
fi

# Fix .env file with proper secrets
echo "Creating .env file..."
cd /opt/avr/avr-infra
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)
WEBHOOK_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)

cat > .env << EOF
# Deepgram Configuration
DEEPGRAM_API_KEY=ad748182032466add820eed184e6b81aefa06fcd
AGENT_PROMPT=You are a helpful assistant. Be friendly and professional.

# AMI Configuration
AMI_USERNAME=avr
AMI_PASSWORD=avr

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Webhook Secret
WEBHOOK_SECRET=$WEBHOOK_SECRET

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
EOF

echo ".env file created with secrets!"

# Ensure directories exist
mkdir -p asterisk/conf asterisk/recordings data

# Pull Docker images
echo "Pulling Docker images..."
docker-compose -f docker-compose-production.yml pull

# Start services
echo "Starting services..."
docker-compose -f docker-compose-production.yml up -d

# Wait for services to start
echo "Waiting for services to initialize..."
sleep 15

# Show status
echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Services Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Firewall Status:"
ufw status numbered | head -15
echo ""
echo "========================================"
echo "Access Information:"
echo "========================================"
echo "Dashboard: https://agent.callbust.com"
echo "Login: admin / admin"
echo ""
echo "To view logs:"
echo "  cd /opt/avr/avr-infra"
echo "  docker-compose -f docker-compose-production.yml logs -f"
echo ""

