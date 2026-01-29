#!/bin/bash
# Deployment Verification Script

echo "=== AVR Deployment Verification ==="
echo ""

# 1. Check if :local images exist
echo "1. Checking Docker images..."
if docker images | grep -q "avr-sts-deepgram.*local"; then
    echo "✅ STS :local image exists"
else
    echo "❌ STS :local image NOT found - rebuild needed"
fi
echo ""

# 2. Check backend compiled code
echo "2. Checking backend compilation..."
if grep -q "relations.*numbers" "avr-app/backend/dist/agents/agents.service.js" 2>/dev/null; then
    echo "✅ Backend has auto-provision fix compiled"
else
    echo "❌ Backend not compiled - run 'npm run build'"
fi
echo ""

# 3. Check STS container source code
echo "3. Checking STS container source..."
config_count=$(grep -c "\[CONFIG\]" "avr-sts-deepgram/index.js" 2>/dev/null)
if [ "$config_count" -gt 10 ]; then
    echo "✅ STS has real-time config fetching ($config_count instances)"
else
    echo "❌ STS source missing config code"
fi
echo ""

# 4. Check running containers
echo "4. Checking running containers..."
if docker ps --format "{{.Names}}" | grep -q "avr-sts"; then
    container_name=$(docker ps --format "{{.Names}}" | grep "avr-sts" | head -1)
    echo "   Container: $container_name"
    
    # Check if container has new code
    code_check=$(docker exec "$container_name" sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js 2>/dev/null || echo 0')
    if [ "$code_check" -gt 10 ]; then
        echo "✅ Running container has updated code"
    else
        echo "⚠️  Running container has OLD code - restart agent via dashboard"
    fi
else
    echo "⚠️  No STS containers running"
fi
echo ""

echo "=== Verification Complete ==="

echo "5. Checking recording system..."
if docker inspect avr-asterisk --format '{{range .Mounts}}{{if eq .Destination "/var/spool/asterisk/monitor"}}MOUNTED{{end}}{{end}}' | grep -q "MOUNTED"; then
    echo "✅ Asterisk recordings volume mounted"
else
    echo "❌ Asterisk recordings NOT mounted - check docker-compose.yml"
fi

if grep -q "ASTERISK_MONITOR_PATH" "avr-app/backend/.env" 2>/dev/null; then
    echo "✅ Backend recording path configured"
else
    echo "❌ Backend recording path NOT set - add to .env"
fi

recordings=$(ls "asterisk/recordings/demo/" 2>/dev/null | wc -l)
echo "   Recordings found: $recordings"
echo ""

echo "=== All Systems Check Complete ==="
