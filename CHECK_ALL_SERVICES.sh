#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║              DSAI Complete Services Health Check                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Backend Service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 BACKEND SERVICE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
backend_pid=$(lsof -ti :3001 2>/dev/null)
if [ -n "$backend_pid" ]; then
    echo "   ✅ Backend: RUNNING (PID: $backend_pid)"
    http_code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001 2>/dev/null)
    echo "   ✅ HTTP Response: $http_code"
    config_test=$(curl -s http://localhost:3001/internal/providers/c0266e1d-8943-4aac-a90a-f67aca8d00b0/config 2>/dev/null | grep -o "DEEPGRAM_GREETING" | head -1)
    if [ "$config_test" = "DEEPGRAM_GREETING" ]; then
        echo "   ✅ Internal API: Working"
    else
        echo "   ⚠️  Internal API: Not responding"
    fi
else
    echo "   ❌ Backend: NOT RUNNING"
fi
echo ""

# 2. Frontend Service
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 FRONTEND SERVICE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if lsof -i :3000 >/dev/null 2>&1; then
    frontend_pid=$(lsof -ti :3000 2>/dev/null)
    echo "   ✅ Frontend: RUNNING (PID: $frontend_pid)"
else
    echo "   ❌ Frontend: NOT RUNNING"
fi
echo ""

# 3. Docker Containers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 DOCKER CONTAINERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Core Infrastructure
echo "Core Infrastructure:"
for container in dsai-asterisk dsai-ami dsai-phone; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        uptime=$(docker ps --format "{{.Names}} {{.Status}}" | grep "^${container}" | awk '{print $2, $3}')
        echo "   ✅ $container: Running ($uptime)"
    else
        echo "   ❌ $container: NOT RUNNING"
    fi
done
echo ""

# Agent Containers
echo "Agent Containers:"
core_containers=$(docker ps --format "{{.Names}}" | grep "dsai-core-" | wc -l)
sts_containers=$(docker ps --format "{{.Names}}" | grep "dsai-sts-" | wc -l)
echo "   Core containers: $core_containers"
echo "   STS containers: $sts_containers"

if [ "$sts_containers" -gt 0 ]; then
    for container in $(docker ps --format "{{.Names}}" | grep "dsai-sts-"); do
        echo "   ✅ $container"
    done
fi
if [ "$core_containers" -gt 0 ]; then
    for container in $(docker ps --format "{{.Names}}" | grep "dsai-core-"); do
        echo "   ✅ $container"
    done
fi
echo ""

# Provider Services
echo "Provider Services:"
for container in dsai-asr-whisper dsai-asr-vosk dsai-llm-openai dsai-kokoro dsai-ollama dsai-ollama-web; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        echo "   ✅ $container: Running"
    else
        echo "   ⚠️  $container: Not running"
    fi
done
echo ""

# 4. Network Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 NETWORK & PORTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_port() {
    port=$1
    service=$2
    if lsof -i :$port >/dev/null 2>&1; then
        echo "   ✅ Port $port ($service): Open"
    else
        echo "   ❌ Port $port ($service): Closed"
    fi
}

check_port 3000 "Frontend"
check_port 3001 "Backend"
check_port 5038 "Asterisk AMI"
check_port 5060 "Asterisk SIP"
check_port 9088 "Asterisk ARI"
check_port 9080 "WebPhone"
check_port 6006 "AMI Service"
echo ""

# 5. Docker Network
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 DOCKER NETWORK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if docker network ls | grep -q " dsai "; then
    echo "   ✅ Docker network 'dsai': Exists"
    connected=$(docker network inspect dsai --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | wc -w)
    echo "   ✅ Connected containers: $connected"
else
    echo "   ❌ Docker network 'dsai': NOT FOUND"
fi
echo ""

# 6. Volume Mounts
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 VOLUME MOUNTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if docker ps | grep -q dsai-asterisk; then
    mount_check=$(docker inspect dsai-asterisk --format '{{range .Mounts}}{{if eq .Destination "/var/spool/asterisk/monitor"}}MOUNTED{{end}}{{end}}')
    if [ "$mount_check" = "MOUNTED" ]; then
        echo "   ✅ Asterisk recordings: Mounted"
    else
        echo "   ❌ Asterisk recordings: NOT MOUNTED"
    fi
    
    config_mount=$(docker inspect dsai-asterisk --format '{{range .Mounts}}{{if eq .Destination "/etc/asterisk/my_extensions.conf"}}MOUNTED{{end}}{{end}}')
    if [ "$config_mount" = "MOUNTED" ]; then
        echo "   ✅ Asterisk config: Mounted"
    else
        echo "   ❌ Asterisk config: NOT MOUNTED"
    fi
else
    echo "   ⚠️  Asterisk container not running"
fi
echo ""

# 7. Database
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💽 DATABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
db_path="/home/shahrukhfiaz/DSAI Multiple Campaigns/DSAI Multiple Campaigns/data/data.db"
if [ -f "$db_path" ]; then
    db_size=$(du -h "$db_path" | awk '{print $1}')
    echo "   ✅ SQLite Database: Exists ($db_size)"
else
    echo "   ❌ SQLite Database: NOT FOUND"
fi
echo ""

# 8. Recordings
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎙️  RECORDINGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
recording_dir="/home/shahrukhfiaz/DSAI Multiple Campaigns/DSAI Multiple Campaigns/asterisk/recordings/demo"
if [ -d "$recording_dir" ]; then
    recording_count=$(ls "$recording_dir" 2>/dev/null | wc -l)
    total_size=$(du -sh "$recording_dir" 2>/dev/null | awk '{print $1}')
    echo "   ✅ Recording directory: Exists"
    echo "   ✅ Total recordings: $recording_count ($total_size)"
else
    echo "   ❌ Recording directory: NOT FOUND"
fi

if grep -q "ASTERISK_MONITOR_PATH" "/home/shahrukhfiaz/DSAI Multiple Campaigns/DSAI Multiple Campaigns/dsai-app/backend/.env" 2>/dev/null; then
    echo "   ✅ Backend recording path: Configured"
else
    echo "   ❌ Backend recording path: NOT CONFIGURED"
fi
echo ""

# 9. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
total_containers=$(docker ps | wc -l)
((total_containers--))  # Subtract header line
echo "   Total running containers: $total_containers"

if [ -n "$backend_pid" ] && docker ps | grep -q dsai-asterisk; then
    echo "   ✅ CORE SERVICES: OPERATIONAL"
else
    echo "   ⚠️  CORE SERVICES: CHECK REQUIRED"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  Health Check Complete - $(date +"%Y-%m-%d %H:%M:%S")                ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
