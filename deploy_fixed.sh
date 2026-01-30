#!/bin/bash
# DSAI Production Deployment Script - Fixed Version
# Domain: agent.callbust.com
# Deepgram API Key: ad748182032466add820eed184e6b81aefa06fcd

set -e

echo "========================================"
echo "DSAI Production Deployment"
echo "Domain: agent.callbust.com"
echo "========================================"
echo ""

# Function to wait for apt with timeout
wait_for_apt() {
    local timeout=300  # 5 minutes
    local elapsed=0
    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
        if [ $elapsed -ge $timeout ]; then
            echo "Timeout waiting for apt. Proceeding anyway..."
            return 1
        fi
        echo "Waiting for apt to finish... ($elapsed/$timeout seconds)"
        sleep 10
        elapsed=$((elapsed + 10))
    done
    return 0
}

# Step 1: Install prerequisites (skip if Docker already installed)
echo "Step 1: Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing prerequisites..."
    wait_for_apt || echo "Continuing despite apt lock..."
    apt-get update -y
    apt-get install -y curl wget git apt-transport-https ca-certificates gnupg lsb-release openssl ufw
else
    echo "Docker already installed, skipping prerequisites..."
fi

# Step 2: Install Docker
echo "Step 2: Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    wait_for_apt || echo "Continuing despite apt lock..."
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl start docker
    systemctl enable docker
else
    echo "Docker already installed!"
fi

# Step 3: Install Docker Compose (standalone)
echo "Step 3: Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose already installed!"
fi

# Step 4: Create DSAI directory
echo "Step 4: Creating DSAI directory..."
mkdir -p /opt/dsai
cd /opt/dsai

# Step 5: Clone repositories
echo "Step 5: Cloning DSAI repositories..."
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
    if [ ! -d "$repo" ]; then
        echo "  Cloning $repo..."
        git clone https://github.com/agentvoiceresponse/$repo.git || echo "  Warning: Failed to clone $repo"
    else
        echo "  $repo already exists, updating..."
        cd $repo && git pull && cd .. || echo "  Warning: Failed to update $repo"
    fi
done

# Step 6: Create production docker-compose file
echo "Step 6: Setting up production configuration..."
cd /opt/dsai/dsai-infra
mkdir -p asterisk/conf
mkdir -p asterisk/recordings
mkdir -p data

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
      - dsai

  dsai-core:
    image: agentvoiceresponse/dsai-core
    platform: linux/x86_64
    container_name: dsai-core
    restart: always
    environment:
      - PORT=5001
      - STS_URL=ws://dsai-sts-deepgram:6033
    ports:
      - 5001:5001
    networks:
      - dsai

  dsai-sts-deepgram:
    image: agentvoiceresponse/dsai-sts-deepgram
    platform: linux/x86_64
    container_name: dsai-sts-deepgram
    restart: always
    environment:
      - PORT=6033
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - AGENT_PROMPT=${AGENT_PROMPT:-You are a helpful assistant. Be friendly and professional.}
      - AMI_URL=http://dsai-ami:6006
    networks:
      - dsai

  dsai-asterisk:
    image: agentvoiceresponse/dsai-asterisk
    platform: linux/x86_64
    container_name: dsai-asterisk
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
      - dsai

  dsai-ami:
    image: agentvoiceresponse/dsai-ami
    platform: linux/x86_64
    container_name: dsai-ami
    restart: always
    environment:
      - PORT=6006
      - AMI_HOST=dsai-asterisk
      - AMI_PORT=5038
      - AMI_USERNAME=${AMI_USERNAME:-dsai}
      - AMI_PASSWORD=${AMI_PASSWORD:-dsai}
    networks:
      - dsai

  dsai-app-backend:
    image: agentvoiceresponse/dsai-app-backend
    platform: linux/x86_64
    container_name: dsai-app-backend
    restart: always
    environment:
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET:-change-this-secret-key-in-production}
      - FRONTEND_URL=https://agent.callbust.com
      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
      - WEBHOOK_URL=http://dsai-app-backend:3001/webhooks
      - WEBHOOK_SECRET=${WEBHOOK_SECRET:-change-this-webhook-secret}
      - ARI_URL=http://dsai-asterisk:8088/ari
      - ARI_USERNAME=${ARI_USERNAME:-dsai}
      - ARI_PASSWORD=${ARI_PASSWORD:-dsai}
      - TENANT=${TENANT:-demo}
      - CORE_DEFAULT_IMAGE=agentvoiceresponse/dsai-core
      - DB_TYPE=sqlite
      - DB_DATABASE=/app/data/data.db
      - ASTERISK_CONFIG_PATH=/app/asterisk
      - ASTERISK_RECORDINGS_PATH=/app/recordings
    labels:
      - traefik.enable=true
      - traefik.http.routers.dsai-app-backend.entrypoints=web
      - traefik.http.routers.dsai-app-backend.rule=Host(`agent.callbust.com`) && PathPrefix(`/api`)
      - traefik.http.routers.dsai-app-backend.middlewares=strip-api
      - traefik.http.middlewares.strip-api.stripprefix.prefixes=/api
      - traefik.http.services.dsai-app-backend.loadbalancer.server.port=3001
    volumes:
      - ./asterisk/conf:/app/asterisk
      - ./data:/app/data
      - ./asterisk/recordings:/app/recordings
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - dsai

  dsai-app-frontend:
    image: agentvoiceresponse/dsai-app-frontend
    platform: linux/x86_64
    container_name: dsai-app-frontend
    restart: always
    environment:
      - NEXT_PUBLIC_API_URL=https://agent.callbust.com/api
      - NEXT_PUBLIC_WEBRTC_CLIENT_URL=https://phone.agentvoiceresponse.com/index.html
    labels:
      - traefik.enable=true
      - traefik.http.routers.dsai-app-frontend.entrypoints=web
      - traefik.http.routers.dsai-app-frontend.rule=Host(`agent.callbust.com`)
      - traefik.http.services.dsai-app-frontend.loadbalancer.server.port=3000
    networks:
      - dsai

networks:
  dsai:
    name: dsai
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
COMPOSEEOF
echo "docker-compose-production.yml created!"

# Step 7: Create .env file
echo "Step 7: Creating .env file..."
cat > .env << ENVEOF
# Deepgram Configuration
DEEPGRAM_API_KEY=ad748182032466add820eed184e6b81aefa06fcd
AGENT_PROMPT=You are a helpful assistant. Be friendly and professional.

# AMI Configuration
AMI_USERNAME=dsai
AMI_PASSWORD=dsai

# JWT Secret
JWT_SECRET=$(openssl rand -hex 32)

# Webhook Secret
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
ENVEOF
echo ".env file created!"

# Step 8: System optimizations
echo "Step 8: Configuring system optimizations..."
grep -q "* soft nofile 65536" /etc/security/limits.conf || echo "* soft nofile 65536" >> /etc/security/limits.conf
grep -q "* hard nofile 65536" /etc/security/limits.conf || echo "* hard nofile 65536" >> /etc/security/limits.conf
grep -q "net.core.rmem_max" /etc/sysctl.conf || echo "net.core.rmem_max = 16777216" >> /etc/sysctl.conf
grep -q "net.core.wmem_max" /etc/sysctl.conf || echo "net.core.wmem_max = 16777216" >> /etc/sysctl.conf
grep -q "net.ipv4.udp_mem" /etc/sysctl.conf || echo "net.ipv4.udp_mem = 8388608 12582912 16777216" >> /etc/sysctl.conf
sysctl -p >/dev/null 2>&1 || true

# Step 9: Create Docker network
echo "Step 9: Creating Docker network..."
docker network create dsai 2>/dev/null || true

# Step 10: Configure firewall
echo "Step 10: Configuring firewall..."
ufw --version >/dev/null 2>&1 || apt-get install -y ufw
ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
ufw allow 5001/tcp comment 'DSAI Core' 2>/dev/null || true
ufw allow 5060/tcp comment 'SIP' 2>/dev/null || true
ufw allow 5060/udp comment 'SIP UDP' 2>/dev/null || true
ufw allow 10000:20000/udp comment 'RTP Media' 2>/dev/null || true
ufw allow 8080/tcp comment 'Traefik Dashboard' 2>/dev/null || true
ufw --force enable 2>/dev/null || echo "UFW already enabled or failed to enable"

# Step 11: Start services
echo "Step 11: Starting DSAI services..."
cd /opt/dsai/dsai-infra
docker-compose -f docker-compose-production.yml pull
docker-compose -f docker-compose-production.yml up -d

# Step 12: Verify installation
echo ""
echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo ""
echo "Services status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Firewall status:"
ufw status numbered 2>/dev/null || echo "UFW status unavailable"
echo ""
echo "========================================"
echo "Deployment completed!"
echo "========================================"
echo ""
echo "Dashboard URL: https://agent.callbust.com"
echo "Default login: admin / admin"
echo ""
echo "To check logs:"
echo "  cd /opt/dsai/dsai-infra"
echo "  docker-compose -f docker-compose-production.yml logs -f"
echo ""

