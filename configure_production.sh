#!/bin/bash
# Production Configuration Script for DSAI
# Domain: agent.callbust.com
# Server IP: 192.241.179.25

set -e

echo "========================================"
echo "DSAI Production Configuration"
echo "Domain: agent.callbust.com"
echo "========================================"
echo ""

cd /opt/dsai/dsai-infra

# Create .env file with Deepgram API key
echo "Creating .env file..."
if [ -f "../create_env_file.sh" ]; then
    chmod +x ../create_env_file.sh
    ../create_env_file.sh
else
    # Fallback if script not found
    cat > .env << EOF
# Deepgram Configuration
DEEPGRAM_API_KEY=ad748182032466add820eed184e6b81aefa06fcd
AGENT_PROMPT=You are a helpful assistant. Be friendly and professional.

# AMI Configuration
AMI_USERNAME=dsai
AMI_PASSWORD=dsai

# JWT Secret (change in production)
JWT_SECRET=$(openssl rand -hex 32)

# Webhook Secret (change in production)
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Admin Credentials (change in production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
EOF
    echo ".env file created successfully!"
fi
echo ""

# Configure firewall
echo "Configuring firewall..."
if command -v ufw &> /dev/null; then
    echo "Configuring UFW firewall..."
    
    # Allow SSH
    ufw allow 22/tcp comment 'SSH'
    
    # Allow HTTP/HTTPS
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Allow DSAI Core
    ufw allow 5001/tcp comment 'DSAI Core'
    
    # Allow SIP (if needed externally)
    ufw allow 5060/tcp comment 'SIP'
    ufw allow 5060/udp comment 'SIP UDP'
    
    # Allow RTP Media
    ufw allow 10000:20000/udp comment 'RTP Media'
    
    # Allow Traefik dashboard (restrict in production)
    ufw allow 8080/tcp comment 'Traefik Dashboard'
    
    # Restrict AMI/ARI to localhost only (internal)
    # These are handled by Docker network, but we can add explicit rules
    
    echo "Firewall rules configured!"
    echo "Note: UFW will be enabled. Make sure SSH is allowed before enabling!"
    read -p "Enable UFW now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ufw --force enable
        echo "UFW enabled!"
    else
        echo "UFW not enabled. Run 'ufw enable' manually after verifying SSH access."
    fi
else
    echo "UFW not found. Please configure firewall manually:"
    echo "  - TCP 22 (SSH)"
    echo "  - TCP 80 (HTTP)"
    echo "  - TCP 443 (HTTPS)"
    echo "  - TCP 5001 (DSAI Core)"
    echo "  - TCP 5060 (SIP)"
    echo "  - UDP 10000-20000 (RTP Media)"
fi

echo ""
echo "========================================"
echo "Configuration Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Review .env file: cat .env"
echo "2. Start services: docker-compose -f docker-compose-production.yml up -d"
echo "3. Check logs: docker-compose -f docker-compose-production.yml logs -f"
echo "4. Access dashboard: https://agent.callbust.com"
echo ""
echo "Default login:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "IMPORTANT: Change admin password and secrets in production!"
echo ""

