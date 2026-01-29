# Issue Summary for Senior Developer

## Problem
Provider configuration changes (prompt, greeting, etc.) don't apply to running agents without restarting Docker containers.

## Root Cause
1. **Containers use environment variables set at creation time** - These are static and don't change
2. **Containers are using old Docker images** - Current container uses `agentvoiceresponse/avr-sts-deepgram:latest` (2 months old) which doesn't have database fetching code
3. **New code exists but isn't being used** - Local image `agentvoiceresponse/avr-sts-deepgram:local` has the fix, but container wasn't recreated

## Solution Implemented

### 1. Backend API Endpoint ✅
- **File**: `avr-app/backend/src/providers/providers.controller.ts`
- **Endpoint**: `GET /internal/providers/{providerId}/config`
- **Purpose**: Allows containers to fetch latest config from database
- **Status**: Working

### 2. STS Container Code ✅
- **File**: `avr-sts-deepgram/index.js`
- **Changes**:
  - Added `fetchConfig()` function (lines 50-119)
  - Fetches from `GET ${BACKEND_URL}/internal/providers/${PROVIDER_ID}/config`
  - Cache TTL = 0ms (always fresh)
  - Called on each new WebSocket connection (line 418)
- **Status**: Code updated in source, but container using old image

### 3. Backend Docker Service ✅
- **File**: `avr-app/backend/src/docker/docker.service.ts`
- **Changes**: Check for `:local` images before pulling from Docker Hub (lines 41-60)
- **Status**: Code updated, but existing containers weren't recreated

### 4. Container Environment ✅
- **File**: `avr-app/backend/src/agents/agents.service.ts`
- **Changes**: Set `PROVIDER_ID` and `BACKEND_URL` env vars (lines 287-332)
- **Status**: Working

## What's Needed

### Immediate Fix
**Restart the agent via dashboard** - This will:
1. Stop old containers
2. Backend will detect `:local` image exists
3. Create new containers with updated code
4. New code will fetch config from database on each call

### Verification Steps
```bash
# 1. Check backend uses local image
tail -f backend.log | grep "Using local image"
# Should see: ✅ Using local image agentvoiceresponse/avr-sts-deepgram:local

# 2. Verify container has new code
docker exec avr-sts-{id} sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js'
# Should return: > 0

# 3. Check config fetching works
docker logs avr-sts-{id} --tail 50 | grep "\[CONFIG\]"
# Should see: ✅ [CONFIG] Fetched configuration from database via backend API

# 4. Test real-time update
# - Update provider greeting in dashboard
# - Make a call immediately
# - Check logs - should show new greeting
```

## Code Flow

### Current (Broken)
```
User updates provider → Database updated → Container still uses old env vars ❌
```

### After Fix (Working)
```
User updates provider → Database updated → New call → Container fetches from API → Uses new config ✅
```

## Files Modified

1. `avr-sts-deepgram/index.js` - Added database fetching logic
2. `avr-app/backend/src/providers/providers.controller.ts` - Added internal API endpoint
3. `avr-app/backend/src/docker/docker.service.ts` - Prefer local images
4. `avr-app/backend/src/agents/agents.service.ts` - Set PROVIDER_ID and BACKEND_URL

## Testing

1. Restart agent via dashboard
2. Make a test call - check logs show config fetching
3. Update provider greeting in dashboard
4. Make another call - should use new greeting immediately

## Long-Term Improvements

1. **Core Container**: Should fetch provider URLs dynamically instead of using hardcoded `STS_URL` env var
2. **Port Management**: Store container ports in database or use service discovery
3. **Image Tagging**: Update provider config to use `:local` tag explicitly

