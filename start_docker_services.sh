#!/bin/bash
# Start Docker services for AVR (requires docker permissions)

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Starting AVR Docker services..."

# Check Docker access
if ! docker ps >/dev/null 2>&1; then
    echo "ERROR: Cannot access Docker. Please fix permissions first:"
    echo "  1. Run: sudo usermod -aG docker \$USER"
    echo "  2. Log out and log back in, OR run: newgrp docker"
    echo "  3. Verify: docker ps"
    exit 1
fi

# Create network if it doesn't exist
if ! docker network inspect avr >/dev/null 2>&1; then
    echo "Creating Docker network 'avr'..."
    docker network create avr
    echo "✓ Network created"
else
    echo "✓ Network 'avr' already exists"
fi

# Start services
echo "Starting Docker services..."
docker-compose -f docker-compose-local-dev.yml up -d

echo ""
echo "Waiting for services to start..."
sleep 5

# Show status
echo ""
echo "Service Status:"
docker-compose -f docker-compose-local-dev.yml ps

echo ""
echo "✓ Docker services started!"
echo ""
echo "Services:"
echo "  • Asterisk: http://localhost:9088/ari"
echo "  • AMI:      http://localhost:6006"
echo "  • Phone:    http://localhost:9080"
echo ""
echo "View logs: docker-compose -f docker-compose-local-dev.yml logs -f"

