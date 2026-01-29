# Provider Configuration Update Issue - Technical Documentation

## Problem Statement

**Issue**: When provider settings (prompt, greeting, API keys, etc.) are updated in the AVR dashboard, the changes are NOT reflected in running agent containers. Users must stop and restart the entire agent (which restarts Docker containers) for changes to take effect.

**Expected Behavior**: Provider configuration changes should apply immediately to new calls without requiring container restarts.

**Current Behavior**: Changes only apply after manually stopping and restarting the agent via dashboard.

---

## Root Cause Analysis

### Current Architecture Flow

```
1. User updates provider in dashboard
   ↓
2. Backend saves to database (PostgreSQL)
   ↓
3. Provider container (STS) is already running
   ↓
4. Container uses OLD environment variables set at startup
   ↓
5. New calls use old config ❌
```

### Why It Fails

1. **Environment Variables Set at Container Creation**: When an agent starts, the backend reads provider config from database and sets them as environment variables (`AGENT_PROMPT`, `DEEPGRAM_GREETING`, etc.) when creating the container. These are static and don't change.

2. **No Dynamic Config Fetching**: The STS container code was designed to use environment variables only, not fetch from database.

3. **Container Restart Required**: The only way to get new config is to recreate containers with new env vars.

---

## Solution Architecture

### Proposed Flow (Database-Driven)

```
1. User updates provider in dashboard
   ↓
2. Backend saves to database ✅
   ↓
3. New call comes in
   ↓
4. STS container fetches FRESH config from database API
   ↓
5. Uses latest config for the call ✅
```

### Key Changes Required

#### 1. Backend API Endpoint (✅ COMPLETED)
- **File**: `avr-app/backend/src/providers/providers.controller.ts`
- **Endpoint**: `GET /internal/providers/{providerId}/config`
- **Purpose**: Allows containers to fetch their config from database
- **Status**: ✅ Implemented and working

#### 2. STS Container Code (✅ COMPLETED)
- **File**: `avr-sts-deepgram/index.js`
- **Changes Made**:
  - Added `fetchConfig()` function that calls backend API
  - Set `CONFIG_CACHE_TTL = 0` (no caching, always fresh)
  - Fetch config on each new WebSocket connection
  - Fallback to env vars if API unavailable
- **Status**: ✅ Code updated in source files

#### 3. Backend Container Environment Setup (✅ COMPLETED)
- **File**: `avr-app/backend/src/agents/agents.service.ts`
- **Changes Made**:
  - Added `PROVIDER_ID` and `BACKEND_URL` to container env
  - Set `BACKEND_URL=http://172.20.0.1:3001` (Docker gateway IP for Linux)
- **Status**: ✅ Code updated

#### 4. Docker Image Management (⚠️ ISSUE HERE)
- **File**: `avr-app/backend/src/docker/docker.service.ts`
- **Problem**: Backend pulls images from Docker Hub, overwriting local builds
- **Solution**: Check for `:local` tagged images first
- **Status**: ✅ Code updated but containers still using old images

---

## Current Issue Details

### Problem 1: Container Using Old Docker Image

**Evidence**:
```bash
# Container is using old image (2 months old)
docker inspect avr-sts-e1241427-4700-4a28-b010-575f50e1afa5 --format '{{.Image}}'
# Returns: sha256:4b9a98d0fb2880509c153fbb12bc2d6edffb9dc6a751ad7269559afe729af977

# New image exists locally
docker images | grep avr-sts-deepgram
# agentvoiceresponse/avr-sts-deepgram:local   43ab8543b523   24 minutes ago
# agentvoiceresponse/avr-sts-deepgram:latest  4b9a98d0fb28   2 months ago
```

**Root Cause**: Backend's `runContainer()` method pulls from Docker Hub before checking for local `:local` images.

**Location**: `avr-app/backend/src/docker/docker.service.ts:35-101`

**Fix Applied**: Updated code to check for `:local` images first, but containers were already created with old image.

### Problem 2: Container Doesn't Have Updated Code

**Evidence**:
```bash
# Check if container has new code
docker exec avr-sts-e1241427-4700-4a28-b010-575f50e1afa5 sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js'
# Returns: 0 (no new code)

# Database has updated config
curl http://localhost:3001/internal/providers/c0266e1d-8943-4aac-a90a-f67aca8d00b0/config
# Returns: {"env":{"DEEPGRAM_GREETING":"Hello! thankyou for calling this is laura walter..."}}

# Container is using old config
docker logs avr-sts-e1241427-4700-4a28-b010-575f50e1afa5 | grep greeting
# Shows: "jessica walter" (old value from env vars)
```

**Root Cause**: Container was created with old Docker image that doesn't have the `fetchConfig()` logic.

### Problem 3: Port Mismatch Between Containers

**Evidence**:
```bash
# STS container listening on port 6431
docker inspect avr-sts-e1241427-4700-4a28-b010-575f50e1afa5 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep PORT
# PORT=6431

# Core container trying to connect to port 6155
docker inspect avr-core-e1241427-4700-4a28-b010-575f50e1afa5 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep STS_URL
# STS_URL=ws://avr-sts-e1241427-4700-4a28-b010-575f50e1afa5:6155
```

**Root Cause**: Ports are randomly generated when containers are created. If containers are created at different times, ports don't match.

**Location**: `avr-app/backend/src/agents/agents.service.ts:172`

---

## Code Locations & Logic

### 1. Provider Config Fetching (STS Container)

**File**: `avr-sts-deepgram/index.js`

**Key Function**: `fetchConfig(forceRefresh = false)`
- **Lines**: ~48-119
- **Logic**:
  1. Check if cache is valid (0ms TTL = always fetch fresh)
  2. If `PROVIDER_ID` and `BACKEND_URL` are set:
     - Call `GET ${BACKEND_URL}/internal/providers/${PROVIDER_ID}/config`
     - Parse response and return config
  3. If API call fails, fallback to `process.env.*` variables

**Called From**: `handleClientConnection()` function
- **Line**: ~402
- **When**: Every time a new WebSocket connection is established (each new call)

**Current Issue**: Container doesn't have this code because it's using old Docker image.

### 2. Backend API Endpoint

**File**: `avr-app/backend/src/providers/providers.controller.ts`

**Endpoint**: `GET /internal/providers/:id/config`
- **Lines**: 36-42
- **Returns**: `{ env: Record<string, string> }`
- **Status**: ✅ Working correctly

**Test**:
```bash
curl http://localhost:3001/internal/providers/c0266e1d-8943-4aac-a90a-f67aca8d00b0/config
# Returns latest config from database
```

### 3. Container Environment Setup

**File**: `avr-app/backend/src/agents/agents.service.ts`

**Function**: `extendEnv()` and `runAgent()`
- **Lines**: 287-332 (extendEnv), 144-221 (runAgent)
- **Logic**:
  1. When creating provider container, sets:
     - `PROVIDER_ID=${provider.id}`
     - `BACKEND_URL=http://172.20.0.1:3001`
     - `PORT=${randomPort}`
  2. When creating core container, sets:
     - `AGENT_ID=${agent.id}`
     - `BACKEND_URL=http://172.20.0.1:3001`
     - `STS_URL=ws://avr-sts-${id}:${port}` (hardcoded at creation time)

**Issue**: `STS_URL` is set once at container creation. If STS container restarts with different port, core container can't connect.

### 4. Docker Image Selection

**File**: `avr-app/backend/src/docker/docker.service.ts`

**Function**: `runContainer()`
- **Lines**: 35-101
- **Current Logic**:
  1. Check for `:local` image
  2. If found, use it
  3. If not found, use original image
  4. Call `pullImage()` which pulls from Docker Hub

**Issue**: Even if `:local` image exists, if the original image name doesn't have a tag, the check might fail.

**Fix Applied**: Updated to handle images with/without tags:
```typescript
const localImage = image.includes(':') 
  ? image.replace(/:[^:]+$/, ':local')
  : `${image}:local`;
```

---

## Required Fixes

### Fix 1: Ensure Containers Use Updated Code

**Problem**: Containers are using old Docker images without the database fetching logic.

**Solution Options**:

**Option A: Force Use Local Image (Recommended)**
1. Update provider config in database to use `agentvoiceresponse/avr-sts-deepgram:local` instead of `agentvoiceresponse/avr-sts-deepgram`
2. Or modify backend to always prefer `:local` if it exists

**Option B: Rebuild and Push to Docker Hub**
1. Build new image: `docker build -t agentvoiceresponse/avr-sts-deepgram:latest .`
2. Push to Docker Hub: `docker push agentvoiceresponse/avr-sts-deepgram:latest`
3. Backend will pull latest automatically

**Option C: Mount Code as Volume (Development Only)**
1. Mount local `index.js` file into container
2. Not recommended for production

**Recommended**: Option A - Update provider image config to use `:local` tag.

### Fix 2: Make Core Container Fetch Provider URLs Dynamically

**Problem**: Core container has hardcoded `STS_URL` that becomes stale if STS container restarts.

**Current Code**: `avr-app/backend/src/agents/agents.service.ts:176`
```typescript
coreEnv.push(`STS_URL=ws://${containerName}:${port}`);
```

**Solution**: Core container should fetch provider URLs from database API on each call.

**API Endpoint**: Already created at `GET /internal/agents/{agentId}/providers`
- **File**: `avr-app/backend/src/agents/agents.controller.ts:36-44`
- **Returns**: `{ stsUrl?: string, asrUrl?: string, ... }`

**Required Change**: Update core container code (separate repository) to:
1. On each call, fetch provider URLs from: `GET ${BACKEND_URL}/internal/agents/${AGENT_ID}/providers`
2. Use returned URLs instead of `STS_URL` env var
3. Fallback to env vars if API unavailable

**Note**: Core container code is in separate repository (`avr-core`), so this requires updating that codebase.

### Fix 3: Ensure Backend Uses Local Images

**Current Code**: `avr-app/backend/src/docker/docker.service.ts:41-54`

**Issue**: Logic checks for `:local` but might not work if image name format is unexpected.

**Fix**: Already applied, but verify it works:
```typescript
const localImage = image.includes(':') 
  ? image.replace(/:[^:]+$/, ':local')
  : `${image}:local`;
```

**Verification**: Check backend logs when starting agent:
```bash
tail -f backend.log | grep "Using local image"
```

---

## Testing Steps

### Step 1: Verify Backend Uses Local Image

1. Restart agent via dashboard
2. Check backend logs:
   ```bash
   tail -f backend.log | grep -E "Using local|Checking for local"
   ```
3. Should see: `✅ Using local image agentvoiceresponse/avr-sts-deepgram:local`

### Step 2: Verify Container Has New Code

1. After agent restart, check container:
   ```bash
   docker exec avr-sts-{id} sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js'
   ```
2. Should return number > 0

### Step 3: Verify Config Fetching Works

1. Make a test call to extension 3000
2. Check STS container logs:
   ```bash
   docker logs avr-sts-{id} --tail 50 | grep "\[CONFIG\]"
   ```
3. Should see:
   - `[CONFIG] Starting config fetch for new connection...`
   - `[CONFIG] Attempting to fetch config from: http://172.20.0.1:3001/...`
   - `✅ [CONFIG] Fetched configuration from database via backend API`
   - `[CONFIG] Greeting: {latest_greeting_from_database}`

### Step 4: Test Real-Time Updates

1. Update provider greeting in dashboard (e.g., change to "Hello, this is test")
2. Make a new call immediately
3. Check logs - should show new greeting
4. Verify call uses new greeting

---

## Files Modified

### Backend Files
1. `avr-app/backend/src/providers/providers.service.ts`
   - Added logging when provider is updated
   
2. `avr-app/backend/src/providers/providers.controller.ts`
   - Added `InternalProvidersController` with `GET /internal/providers/:id/config`

3. `avr-app/backend/src/agents/agents.service.ts`
   - Added `BACKEND_URL` and `AGENT_ID` to core container env
   - Added `getProviderUrlsForAgent()` method
   - Updated `extractImage()` to ensure tags

4. `avr-app/backend/src/agents/agents.controller.ts`
   - Added `InternalAgentsController` with `GET /internal/agents/:id/providers`

5. `avr-app/backend/src/docker/docker.service.ts`
   - Updated `runContainer()` to check for `:local` images first
   - Updated `pullImage()` to skip pulling `:local` images

### STS Container Files
1. `avr-sts-deepgram/index.js`
   - Added `fetchConfig()` function with database API call
   - Set `CONFIG_CACHE_TTL = 0` for real-time updates
   - Enhanced logging with `[CONFIG]` tags
   - Fetch config on each new WebSocket connection

---

## Current Status

✅ **Completed**:
- Backend API endpoints created
- STS container code updated (in source files)
- Backend code updated to use local images
- Docker image rebuilt and tagged as `:local`

⚠️ **Pending**:
- Containers need to be recreated with new image
- Core container needs to fetch provider URLs dynamically (requires core container code update)

### Current Container State (Verified)

```bash
# Container is using OLD image (2 months old)
Container: avr-sts-e1241427-4700-4a28-b010-575f50e1afa5
Image: agentvoiceresponse/avr-sts-deepgram:latest
Image ID: sha256:4b9a98d0fb2880509c153fbb12bc2d6edffb9dc6a751ad7269559afe729af977

# Container does NOT have new code
docker exec avr-sts-{id} sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js'
# Returns: 0 (no new code)

# Local image exists with new code
docker images | grep avr-sts-deepgram
# agentvoiceresponse/avr-sts-deepgram:local   43ab8543b523   31 minutes ago
# agentvoiceresponse/avr-sts-deepgram:latest   4b9a98d0fb28   2 months ago
```

**Root Cause**: Container was created before backend code was updated to check for `:local` images. Backend now has the fix, but container needs to be recreated.

---

## Immediate Action Required

1. **Restart Agent via Dashboard**: This will recreate containers with the `:local` image
2. **Verify**: Check logs to confirm new code is running
3. **Test**: Update provider config and make a call - should use new config immediately

---

## Long-Term Solution

For complete real-time updates without any restarts:

1. **Core Container Update** (requires `avr-core` repository):
   - Fetch provider URLs from `GET /internal/agents/{id}/providers` on each call
   - Don't rely on `STS_URL` environment variable

2. **Provider Image Config**:
   - Update provider config in database to use `:local` tag
   - Or ensure backend always prefers local images

3. **Port Management**:
   - Store provider container ports in database when created
   - Or use service discovery instead of hardcoded ports

---

## Debugging Commands

```bash
# Check if local image exists
docker images | grep avr-sts-deepgram

# Check what image container is using
docker inspect avr-sts-{id} --format '{{.Image}}'

# Check if container has new code
docker exec avr-sts-{id} sh -c 'grep -c "\[CONFIG\]" /usr/src/app/index.js'

# Check container environment
docker inspect avr-sts-{id} --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E "PROVIDER_ID|BACKEND_URL"

# Test API endpoint
curl http://localhost:3001/internal/providers/{providerId}/config

# Check backend logs for local image usage
tail -f backend.log | grep "Using local"

# Check STS container logs for config fetching
docker logs avr-sts-{id} --tail 100 | grep "\[CONFIG\]"
```

---

## Summary for Senior Developer

**Problem**: Provider config changes don't apply without container restart.

**Root Cause**: 
1. Containers use environment variables set at creation time
2. Containers are using old Docker images without database fetching code
3. Core container has hardcoded provider URLs

**Solution Implemented**:
1. ✅ Backend API to serve provider config
2. ✅ STS container code to fetch from API (in source, needs new image)
3. ✅ Backend to prefer local `:local` images

**What's Needed**:
1. Restart agent to use new `:local` image
2. (Future) Update core container to fetch provider URLs dynamically

**Files to Review**:
- `avr-sts-deepgram/index.js` (lines 35-119, 400-412)
- `avr-app/backend/src/docker/docker.service.ts` (lines 35-101)
- `avr-app/backend/src/agents/agents.service.ts` (lines 144-221, 224-272)

