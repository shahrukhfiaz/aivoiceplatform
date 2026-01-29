#!/bin/bash
# AVR Local Development Setup and Start Script
# For Ubuntu/Linux systems

set -e  # Exit on error

echo "=========================================="
echo "AVR Local Development Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run this script as root${NC}"
   exit 1
fi

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."
MISSING_DEPS=()

if ! command_exists docker; then
    MISSING_DEPS+=("docker")
fi

if ! command_exists docker-compose; then
    MISSING_DEPS+=("docker-compose")
fi

if ! command_exists node; then
    MISSING_DEPS+=("nodejs")
fi

if ! command_exists npm; then
    MISSING_DEPS+=("npm")
fi

if ! command_exists git; then
    MISSING_DEPS+=("git")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${RED}Missing dependencies: ${MISSING_DEPS[*]}${NC}"
    echo "Please install them first:"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install -y docker.io docker-compose nodejs npm git"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites installed${NC}"
echo ""

# Check Docker permissions
echo "Checking Docker permissions..."
if docker ps >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker access OK${NC}"
else
    echo -e "${YELLOW}⚠ Docker permission issue detected${NC}"
    echo "Adding user to docker group..."
    
    if sudo usermod -aG docker $USER; then
        echo -e "${GREEN}✓ User added to docker group${NC}"
        echo -e "${YELLOW}⚠ IMPORTANT: You need to log out and log back in for this to take effect${NC}"
        echo "Or run: newgrp docker"
        echo ""
        echo "After logging back in, run this script again."
        exit 0
    else
        echo -e "${RED}✗ Failed to add user to docker group${NC}"
        echo "Please run manually: sudo usermod -aG docker $USER"
        echo "Then log out and log back in."
        exit 1
    fi
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "Step 1: Installing Backend Dependencies"
echo "=========================================="
cd avr-app/backend
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Backend dependencies already installed${NC}"
fi
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "Step 2: Installing Frontend Dependencies"
echo "=========================================="
cd avr-app/frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Frontend dependencies already installed${NC}"
fi
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "Step 3: Verifying Environment Files"
echo "=========================================="

# Check backend .env
if [ ! -f "avr-app/backend/.env" ]; then
    echo -e "${YELLOW}⚠ Backend .env file missing, creating from template...${NC}"
    cat > avr-app/backend/.env << 'EOF'
# General
PORT=3001
MY_DOMAIN=localhost

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Asterisk ARI
ARI_URL=http://localhost:9088/ari
ARI_USERNAME=asterisk
ARI_PASSWORD=asterisk

# Database
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3309
DATABASE_NAME=avr-app
DATABASE_USERNAME=avr
DATABASE_PASSWORD=
DATABASE_ROOT_PASSWORD=
DB_TYPE=sqlite
DB_PATH=./data/avr.db

# Container Ports
CORE_PORT_START=5000
ASR_PORT_START=6000
LLM_PORT_START=7000
TTS_PORT_START=8000
AMI_PORT=9000

# Network
AVR_NETWORK=avr

# JWT
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server
FRONTEND_URL=http://localhost:3000

# Docker
DOCKER_SOCKET_PATH=/var/run/docker.sock

# AMI
AMI_URL=http://localhost:6006

# Core Image
CORE_DEFAULT_IMAGE=agentvoiceresponse/avr-core:1.10.1
EOF
    echo -e "${GREEN}✓ Backend .env created${NC}"
else
    echo -e "${GREEN}✓ Backend .env exists${NC}"
fi

# Check frontend .env.local
if [ ! -f "avr-app/frontend/.env.local" ]; then
    echo -e "${YELLOW}⚠ Frontend .env.local missing, creating...${NC}"
    cat > avr-app/frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBRTC_CLIENT_URL=http://localhost:9080
EOF
    echo -e "${GREEN}✓ Frontend .env.local created${NC}"
else
    echo -e "${GREEN}✓ Frontend .env.local exists${NC}"
fi

echo ""
echo "=========================================="
echo "Step 4: Creating Docker Network"
echo "=========================================="
if docker network inspect avr >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker network 'avr' already exists${NC}"
else
    echo "Creating Docker network 'avr'..."
    docker network create avr
    echo -e "${GREEN}✓ Docker network 'avr' created${NC}"
fi

echo ""
echo "=========================================="
echo "Step 5: Starting Docker Services"
echo "=========================================="
echo "Starting avr-asterisk, avr-ami, and avr-phone..."

# Stop any existing containers
docker-compose -f docker-compose-local-dev.yml down 2>/dev/null || true

# Start services
docker-compose -f docker-compose-local-dev.yml up -d

echo ""
echo "Waiting for services to start..."
sleep 5

# Check service status
echo ""
echo "Service Status:"
docker-compose -f docker-compose-local-dev.yml ps

echo ""
echo "=========================================="
echo "Step 6: Starting Backend Service"
echo "=========================================="
echo "Starting backend in background..."
cd avr-app/backend
nohup npm run start:dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
echo "Logs: avr-app/backend.log"
cd "$SCRIPT_DIR"

# Wait a bit for backend to start
sleep 3

echo ""
echo "=========================================="
echo "Step 7: Starting Frontend Service"
echo "=========================================="
echo "Starting frontend in background..."
cd avr-app/frontend
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
echo "Logs: avr-app/frontend.log"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}All services are starting...${NC}"
echo ""
echo "Access Points:"
echo "  • Frontend:     http://localhost:3000"
echo "  • Backend API: http://localhost:3001"
echo "  • Web Phone:   http://localhost:9080"
echo "  • Asterisk ARI: http://localhost:9088/ari"
echo "  • AMI Service:  http://localhost:6006"
echo ""
echo "Service Logs:"
echo "  • Backend:  tail -f avr-app/backend.log"
echo "  • Frontend: tail -f avr-app/frontend.log"
echo "  • Docker:   docker-compose -f docker-compose-local-dev.yml logs -f"
echo ""
echo "To stop all services:"
echo "  ./stop_all_services.sh"
echo ""
echo "Service PIDs saved to:"
echo "  • Backend:  avr-app/backend.pid"
echo "  • Frontend: avr-app/frontend.pid"
echo ""

