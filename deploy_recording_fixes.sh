#!/bin/bash

# DSAI Recording Fixes Deployment Script
# This script deploys the recording fixes to production server

set -e  # Exit on any error

echo "=================================="
echo "DSAI Recording Fixes Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server details
SERVER_USER="root"
SERVER_IP="192.241.179.25"
SERVER_PATH="/opt/dsai/dsai-app"

echo -e "${YELLOW}Step 1: Building Backend Docker Image${NC}"
echo "--------------------------------------"
cd dsai-app/backend
echo "Installing dependencies..."
npm install
echo "Building TypeScript..."
npm run build
echo "Building Docker image..."
docker build -t agentvoiceresponse/dsai-app-backend:latest .
cd ../..
echo -e "${GREEN}✓ Backend image built successfully${NC}"
echo ""

echo -e "${YELLOW}Step 2: Building Frontend Docker Image${NC}"
echo "---------------------------------------"
cd dsai-app/frontend
echo "Installing dependencies (including @radix-ui/react-switch)..."
npm install
echo "Building Next.js application..."
npm run build
echo "Building Docker image..."
docker build -t agentvoiceresponse/dsai-app-frontend:latest .
cd ../..
echo -e "${GREEN}✓ Frontend image built successfully${NC}"
echo ""

echo -e "${YELLOW}Step 3: Saving Docker Images${NC}"
echo "-----------------------------"
echo "Saving backend image..."
docker save agentvoiceresponse/dsai-app-backend:latest | gzip > dsai-app-backend.tar.gz
echo "Saving frontend image..."
docker save agentvoiceresponse/dsai-app-frontend:latest | gzip > dsai-app-frontend.tar.gz
echo -e "${GREEN}✓ Images saved successfully${NC}"
echo ""

echo -e "${YELLOW}Step 4: Uploading to Production Server${NC}"
echo "---------------------------------------"
echo "Uploading backend image..."
scp dsai-app-backend.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
echo "Uploading frontend image..."
scp dsai-app-frontend.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
echo "Uploading updated docker-compose file..."
scp docker-compose-production.yml ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/
echo "Uploading updated backend service file..."
scp dsai-app/backend/src/recordings/recordings.service.ts ${SERVER_USER}@${SERVER_IP}:/tmp/
echo -e "${GREEN}✓ Files uploaded successfully${NC}"
echo ""

echo -e "${YELLOW}Step 5: Loading Images on Server${NC}"
echo "---------------------------------"
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /tmp
echo "Loading backend image..."
docker load < dsai-app-backend.tar.gz
echo "Loading frontend image..."
docker load < dsai-app-frontend.tar.gz
echo "Cleaning up..."
rm -f dsai-app-backend.tar.gz dsai-app-frontend.tar.gz
ENDSSH
echo -e "${GREEN}✓ Images loaded on server${NC}"
echo ""

echo -e "${YELLOW}Step 6: Creating Recordings Directory${NC}"
echo "--------------------------------------"
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /opt/dsai/dsai-app
# Create recordings directory structure
mkdir -p asterisk/recordings/demo
chmod 755 asterisk/recordings
chmod 755 asterisk/recordings/demo
echo "Recordings directory created: $(pwd)/asterisk/recordings/demo"
ls -la asterisk/recordings/
ENDSSH
echo -e "${GREEN}✓ Recordings directory created${NC}"
echo ""

echo -e "${YELLOW}Step 7: Restarting Services${NC}"
echo "----------------------------"
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /opt/dsai/dsai-app
echo "Stopping services..."
docker-compose -f docker-compose-production.yml down
echo "Starting services with new images..."
docker-compose -f docker-compose-production.yml up -d
echo "Waiting for services to start..."
sleep 10
ENDSSH
echo -e "${GREEN}✓ Services restarted${NC}"
echo ""

echo -e "${YELLOW}Step 8: Verifying Services${NC}"
echo "---------------------------"
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /opt/dsai/dsai-app
echo "Running containers:"
docker-compose -f docker-compose-production.yml ps
echo ""
echo "Backend logs (last 20 lines):"
docker logs --tail 20 dsai-app-backend
echo ""
echo "Checking backend environment variable:"
docker exec dsai-app-backend env | grep ASTERISK_MONITOR_PATH
echo ""
echo "Checking recordings directory from backend container:"
docker exec dsai-app-backend ls -la /app/recordings/demo/ 2>/dev/null || echo "Directory exists but is empty (no recordings yet)"
ENDSSH
echo -e "${GREEN}✓ Services verified${NC}"
echo ""

echo -e "${YELLOW}Step 9: Cleaning Up Local Files${NC}"
echo "--------------------------------"
rm -f dsai-app-backend.tar.gz dsai-app-frontend.tar.gz
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

echo "=================================="
echo -e "${GREEN}Deployment Completed Successfully!${NC}"
echo "=================================="
echo ""
echo "Next Steps:"
echo "1. Log in to https://agent.callbust.com"
echo "2. Go to Numbers page"
echo "3. Create or edit a number"
echo "4. Toggle 'Recording' to ON"
echo "5. Make a test call"
echo "6. Check Recordings page"
echo ""
echo "Useful Commands:"
echo "  - View backend logs:  ssh root@192.241.179.25 'docker logs -f dsai-app-backend'"
echo "  - View frontend logs: ssh root@192.241.179.25 'docker logs -f dsai-app-frontend'"
echo "  - List recordings:    ssh root@192.241.179.25 'ls -lh /opt/dsai/dsai-app/asterisk/recordings/demo/'"
echo ""
