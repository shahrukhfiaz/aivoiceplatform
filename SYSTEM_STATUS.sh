#!/bin/bash
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          DSAI System Health Check                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Backend
echo "📡 Backend Service:"
backend_pid=$(lsof -ti :3001 2>/dev/null)
if [ -n "$backend_pid" ]; then
    echo "   ✅ Running (PID: $backend_pid)"
    http_code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001 2>/dev/null)
    echo "   ✅ HTTP Status: $http_code"
else
    echo "   ❌ Not running"
fi
echo ""

# 2. Asterisk
echo "☎️  Asterisk:"
if docker ps | grep -q dsai-asterisk; then
    echo "   ✅ Container running"
    mount_check=$(docker inspect dsai-asterisk --format '{{range .Mounts}}{{if eq .Destination "/var/spool/asterisk/monitor"}}MOUNTED{{end}}{{end}}')
    if [ "$mount_check" = "MOUNTED" ]; then
        echo "   ✅ Recordings volume mounted"
    else
        echo "   ❌ Recordings NOT mounted"
    fi
else
    echo "   ❌ Container not running"
fi
echo ""

# 3. Agent Containers
echo "🤖 Agent Containers:"
agent_count=$(docker ps | grep -c "dsai-core-" 2>/dev/null || echo "0")
sts_count=$(docker ps | grep -c "dsai-sts-" 2>/dev/null || echo "0")
echo "   Core containers: $agent_count"
echo "   STS containers: $sts_count"
if [ "$sts_count" -gt 0 ]; then
    sts_container=$(docker ps --format "{{.Names}}" | grep "dsai-sts-" | head -1)
    code_check=$(docker exec "$sts_container" sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js 2>/dev/null || echo 0')
    if [ "$code_check" -gt 10 ]; then
        echo "   ✅ Using updated code (real-time config)"
    else
        echo "   ⚠️  Using old code (restart agent to update)"
    fi
fi
echo ""

# 4. Recordings
echo "🎙️  Recordings:"
recording_count=$(ls /home/shahrukhfiaz/DSAI\ Multiple\ Campaigns/DSAI\ Multiple\ Campaigns/asterisk/recordings/demo/ 2>/dev/null | wc -l)
echo "   Total recordings: $recording_count"
if grep -q "ASTERISK_MONITOR_PATH" /home/shahrukhfiaz/DSAI\ Multiple\ Campaigns/DSAI\ Multiple\ Campaigns/dsai-app/backend/.env 2>/dev/null; then
    echo "   ✅ Backend path configured"
else
    echo "   ❌ Backend path NOT configured"
fi
echo ""

# 5. Docker Images
echo "🐳 Docker Images:"
if docker images | grep -q "dsai-sts-deepgram.*local"; then
    echo "   ✅ STS :local image available"
else
    echo "   ⚠️  STS :local image not found"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  System Check Complete - $(date +"%Y-%m-%d %H:%M:%S")      ║"
echo "╚════════════════════════════════════════════════════════════╝"
