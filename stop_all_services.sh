#!/bin/bash
# Stop all AVR local development services

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Stopping all AVR services..."

# Stop backend
if [ -f "avr-app/backend.pid" ]; then
    BACKEND_PID=$(cat avr-app/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        rm avr-app/backend.pid
    fi
fi

# Stop frontend
if [ -f "avr-app/frontend.pid" ]; then
    FRONTEND_PID=$(cat avr-app/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
        rm avr-app/frontend.pid
    fi
fi

# Stop Docker services
echo "Stopping Docker services..."
docker-compose -f docker-compose-local-dev.yml down

echo "All services stopped."

