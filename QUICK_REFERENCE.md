# Quick Reference: Provider Update Issue

## TL;DR

**Problem**: Provider config changes require container restart to take effect.

**Solution**: Code updated to fetch config from database on each call, but containers are using old Docker images.

**Fix**: Restart agent via dashboard to use new `:local` image.

---

## Key Code Locations

### 1. STS Container Config Fetching
**File**: `avr-sts-deepgram/index.js`
- **Function**: `fetchConfig()` (lines ~48-119)
- **Called**: On each new WebSocket connection (line ~402)
- **Cache TTL**: 0ms (always fresh)
- **API**: `GET ${BACKEND_URL}/internal/providers/${PROVIDER_ID}/config`

### 2. Backend API Endpoint
**File**: `avr-app/backend/src/providers/providers.controller.ts`
- **Endpoint**: `GET /internal/providers/:id/config`
- **Returns**: `{ env: { ... } }` from database

### 3. Docker Image Selection
**File**: `avr-app/backend/src/docker/docker.service.ts`
- **Function**: `runContainer()` (lines 35-101)
- **Logic**: Checks for `:local` image before pulling from Docker Hub

### 4. Container Environment Setup
**File**: `avr-app/backend/src/agents/agents.service.ts`
- **Function**: `extendEnv()` (lines 287-332)
- **Sets**: `PROVIDER_ID`, `BACKEND_URL`, `PORT`

---

## Verification Checklist

- [ ] Backend logs show: `✅ Using local image agentvoiceresponse/avr-sts-deepgram:local`
- [ ] Container has new code: `docker exec avr-sts-{id} sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js'` returns > 0
- [ ] Container logs show: `✅ [CONFIG] Fetched configuration from database via backend API`
- [ ] Config updates apply immediately without restart

---

## Current Container Status

Run these commands to check:

```bash
# Check running containers
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep avr

# Check if local image exists
docker images | grep avr-sts-deepgram

# Check container environment
docker inspect avr-sts-{id} --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E "PROVIDER_ID|BACKEND_URL"

# Test API endpoint
curl http://localhost:3001/internal/providers/{providerId}/config
```

---

## Next Steps

1. **Restart Agent**: Stop and start agent via dashboard
2. **Verify**: Check logs for local image usage and config fetching
3. **Test**: Update provider config and make a call - should use new config immediately

