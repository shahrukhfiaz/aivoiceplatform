#!/bin/bash
# Create .env file for AVR production

cd /opt/avr/avr-infra

cat > .env << 'EOF'
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
EOF

# Replace the random secrets
JWT_SECRET_VAL=$(openssl rand -hex 32)
WEBHOOK_SECRET_VAL=$(openssl rand -hex 32)

sed -i "s|JWT_SECRET=\$(openssl rand -hex 32)|JWT_SECRET=$JWT_SECRET_VAL|g" .env
sed -i "s|WEBHOOK_SECRET=\$(openssl rand -hex 32)|WEBHOOK_SECRET=$WEBHOOK_SECRET_VAL|g" .env

echo ".env file created successfully!"
cat .env

