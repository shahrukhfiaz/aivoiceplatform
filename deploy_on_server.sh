#!/bin/bash
# AVR Production Deployment Script - Execute on Server
# Domain: agent.callbust.com
# Deepgram API Key: ad748182032466add820eed184e6b81aefa06fcd

set -e

echo "========================================"
echo "AVR Production Deployment"
echo "Domain: agent.callbust.com"
echo "========================================"
echo ""

# Wait for any existing apt processes
echo "Waiting for any existing apt processes to finish..."
while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
    echo "Waiting for apt to finish..."
    sleep 5
done

# Step 1: Install prerequisites
echo "Step 1: Installing prerequisites..."
apt-get update -y
apt-get install -y curl wget git apt-transport-https ca-certificates gnupg lsb-release openssl ufw

# Step 2: Install Docker
echo "Step 2: Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# Step 3: Install Docker Compose (standalone)
echo "Step 3: Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Step 4: Start Docker
echo "Step 4: Starting Docker service..."
systemctl start docker
systemctl enable docker

# Step 5: Create AVR directory
echo "Step 5: Creating AVR directory..."
mkdir -p /opt/avr
cd /opt/avr

# Step 6: Clone repositories
echo "Step 6: Cloning AVR repositories..."
repos=(
    "avr-infra"
    "avr-app"
    "avr-sts-deepgram"
    "avr-ami"
    "avr-webhook"
    "avr-phone"
    "avr-asterisk"
    "avr-vad"
    "avr-docs"
)

for repo in "${repos[@]}"; do
    if [ ! -d "$repo" ]; then
        echo "  Cloning $repo..."
        git clone https://github.com/agentvoiceresponse/$repo.git || echo "  Warning: Failed to clone $repo"
    else
        echo "  $repo already exists, skipping..."
    fi
done

# Step 7: Copy production docker-compose file
echo "Step 7: Setting up production configuration..."
cd /opt/avr/avr-infra
if [ ! -f "docker-compose-production.yml" ]; then
    cat > docker-compose-production.yml << 'COMPOSEEOF'
services:
  traefik:
    image: traefik:v3.6
    container_name: traefik
    restart: always
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - avr

  avr-core:
    image: agentvoiceresponse/avr-core
    platform: linux/x86_64
    container_name: avr-core
    restart: always
    environment:
      - PORT=5001
      - STS_URL=ws://avr-sts-deepgram:6033
    ports:
      - 5001:5001
    networks:
      - avr

  avr-sts-deepgram:
    image: agentvoiceresponse/avr-sts-deepgram
    platform: linux/x86_64
    container_name: avr-sts-deepgram
    restart: always
    environment:
      - PORT=6033
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - AGENT_PROMPT=${AGENT_PROMPT:-You are a helpful assistant. Be friendly and professional.}
      - AMI_URL=http://avr-ami:6006
    networks:
      - avr

  avr-asterisk:
    image: agentvoiceresponse/avr-asterisk
    platform: linux/x86_64
    container_name: avr-asterisk
    restart: always
    ports:
      - 5038:5038
      - 5060:5060
      - 8088:8088
      - 8089:8089
      - 10000-10050:10000-10050/udp
    volumes:
      - ./asterisk/conf/manager.conf:/etc/asterisk/my_manager.conf
      - ./asterisk/conf/pjsip.conf:/etc/asterisk/my_pjsip.conf
      - ./asterisk/conf/extensions.conf:/etc/asterisk/my_extensions.conf
      - ./asterisk/conf/queues.conf:/etc/asterisk/my_queues.conf
      - ./asterisk/conf/ari.conf:/etc/asterisk/my_ari.conf
      - ./asterisk/recordings:/var/spool/asterisk/monitor
    networks:
      - avr

  avr-ami:
    image: agentvoiceresponse/avr-ami
    platform: linux/x86_64
    container_name: avr-ami
    restart: always
    environment:
      - PORT=6006
      - AMI_HOST=avr-asterisk
      - AMI_PORT=5038
      - AMI_USERNAME=${AMI_USERNAME:-avr}
      - AMI_PASSWORD=${AMI_PASSWORD:-avr}
    networks:
      - avr

  avr-app-backend:
    image: agentvoiceresponse/avr-app-backend
    platform: linux/x86_64
    container_name: avr-app-backend
    restart: always
    environment:
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET:-change-this-secret-key-in-production}
      - FRONTEND_URL=https://agent.callbust.com
      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
      - WEBHOOK_URL=http://avr-app-backend:3001/webhooks
      - WEBHOOK_SECRET=${WEBHOOK_SECRET:-change-this-webhook-secret}
      - ARI_URL=http://avr-asterisk:8088/ari
      - ARI_USERNAME=${ARI_USERNAME:-avr}
      - ARI_PASSWORD=${ARI_PASSWORD:-avr}
      - TENANT=${TENANT:-demo}
      - CORE_DEFAULT_IMAGE=agentvoiceresponse/avr-core
      - DB_TYPE=sqlite
      - DB_DATABASE=/app/data/data.db
      - ASTERISK_CONFIG_PATH=/app/asterisk
      - ASTERISK_RECORDINGS_PATH=/app/recordings
    labels:
      - traefik.enable=true
      - traefik.http.routers.avr-app-backend.entrypoints=web
      - traefik.http.routers.avr-app-backend.rule=Host(`agent.callbust.com`) && PathPrefix(`/api`)
      - traefik.http.routers.avr-app-backend.middlewares=strip-api
      - traefik.http.middlewares.strip-api.stripprefix.prefixes=/api
      - traefik.http.services.avr-app-backend.loadbalancer.server.port=3001
    volumes:
      - ./asterisk/conf:/app/asterisk
      - ./data:/app/data
      - ./asterisk/recordings:/app/recordings
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - avr

  avr-app-frontend:
    image: agentvoiceresponse/avr-app-frontend
    platform: linux/x86_64
    container_name: avr-app-frontend
    restart: always
    environment:
      - NEXT_PUBLIC_API_URL=https://agent.callbust.com/api
      - NEXT_PUBLIC_WEBRTC_CLIENT_URL=https://phone.agentvoiceresponse.com/index.html
    labels:
      - traefik.enable=true
      - traefik.http.routers.avr-app-frontend.entrypoints=web
      - traefik.http.routers.avr-app-frontend.rule=Host(`agent.callbust.com`)
      - traefik.http.services.avr-app-frontend.loadbalancer.server.port=3000
    networks:
      - avr

networks:
  avr:
    name: avr
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
COMPOSEEOF
    echo "docker-compose-production.yml created!"
fi

# Step 8: Create .env file
echo "Step 8: Creating .env file..."
cat > .env << ENVEOF
# Deepgram Configuration
DEEPGRAM_API_KEY=ad748182032466add820eed184e6b81aefa06fcd
AGENT_PROMPT=You are a helpful assistant. Be friendly and professional.

# AMI Configuration
AMI_USERNAME=avr
AMI_PASSWORD=avr

# JWT Secret
JWT_SECRET=$(openssl rand -hex 32)

# Webhook Secret
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
ENVEOF
echo ".env file created!"

# Step 9: System optimizations
echo "Step 9: Configuring system optimizations..."
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf
echo "net.core.rmem_max = 16777216" >> /etc/sysctl.conf
echo "net.core.wmem_max = 16777216" >> /etc/sysctl.conf
echo "net.ipv4.udp_mem = 8388608 12582912 16777216" >> /etc/sysctl.conf
sysctl -p

# Step 10: Create Docker network
echo "Step 10: Creating Docker network..."
docker network create avr 2>/dev/null || true

# Step 11: Configure firewall
echo "Step 11: Configuring firewall..."
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 5001/tcp comment 'AVR Core'
ufw allow 5060/tcp comment 'SIP'
ufw allow 5060/udp comment 'SIP UDP'
ufw allow 10000:20000/udp comment 'RTP Media'
ufw allow 8080/tcp comment 'Traefik Dashboard'
ufw --force enable

# Step 12: Start services
echo "Step 12: Starting AVR services..."
cd /opt/avr/avr-infra
docker-compose -f docker-compose-production.yml pull
docker-compose -f docker-compose-production.yml up -d

# Step 13: Verify installation
echo ""
echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo ""
echo "Services status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Firewall status:"
ufw status
echo ""
echo "========================================"
echo "Deployment completed!"
echo "========================================"
echo ""
echo "Dashboard URL: https://agent.callbust.com"
echo "Default login: admin / admin"
echo ""
echo "To check logs:"
echo "  cd /opt/avr/avr-infra"
echo "  docker-compose -f docker-compose-production.yml logs -f"
echo ""

