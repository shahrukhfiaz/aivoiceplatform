# Call Recordings Fix - Complete Guide

## Issues Found and Fixed

### 1. Environment Variable Name Mismatch ✅ FIXED
**Problem**:
- Backend code expected `ASTERISK_MONITOR_PATH`
- Docker Compose files set `ASTERISK_RECORDINGS_PATH`
- This caused the backend to fall back to the default path `../recordings`

**Fix Applied**:
- Updated [docker-compose-production.yml](docker-compose-production.yml) line 118
- Updated [avr-infra/docker-compose-app.yml](avr-infra/docker-compose-app.yml) line 38
- Changed `ASTERISK_RECORDINGS_PATH` → `ASTERISK_MONITOR_PATH`

### 2. Tenant Subdirectory Path Mismatch ✅ FIXED
**Problem**:
- Asterisk saves recordings to: `/var/spool/asterisk/monitor/${tenant}/${UUID}.wav`
- Backend looked for recordings in: `/app/recordings/${UUID}.wav` (missing tenant subdirectory)
- This caused recordings to never be found even when they existed

**Fix Applied**:
- Updated [avr-app/backend/src/recordings/recordings.service.ts](avr-app/backend/src/recordings/recordings.service.ts)
- Modified `getRecordingPath()` to include tenant subdirectory: `path.join(this.resolveMonitorPath(), tenant, ${callUuid}.wav)`
- Modified `syncFromFilesystem()` to scan the tenant subdirectory

### 3. Recording Disabled by Default ⚠️ USER ACTION REQUIRED
**Problem**:
- The `recordingEnabled` field in `PhoneNumber` entity defaults to `false`
- MixMonitor is only added to the Asterisk dialplan when `recordingEnabled` is `true`
- No recordings are made unless explicitly enabled

**User Action Required**: See "How to Enable Recordings" section below

---

## How the Recording System Works

### Architecture Flow

```
┌─────────────┐
│   Call In   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Asterisk PBX    │ → MixMonitor writes to:
│ (extensions.conf)│   /var/spool/asterisk/monitor/${tenant}/${UUID}.wav
└──────┬──────────┘
       │
       │ Volume Mount: ./asterisk/recordings → /var/spool/asterisk/monitor
       │
       ▼
┌────────────────────┐
│ Host File System   │ → Recording saved to:
│ ./asterisk/        │   ./asterisk/recordings/${tenant}/${UUID}.wav
│   recordings/      │
└──────┬─────────────┘
       │
       │ Volume Mount: ./asterisk/recordings → /app/recordings
       │
       ▼
┌─────────────────────┐
│ Backend Container   │ → Scans directory:
│ (RecordingsService) │   /app/recordings/${tenant}/*.wav
└──────┬──────────────┘
       │
       ▼
┌──────────────┐
│ SQLite DB    │ → Stores metadata: callUuid, filename, size, date
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Frontend     │ → Displays recordings, allows download/playback
└──────────────┘
```

### File Paths Explained

| Location | Path | Description |
|----------|------|-------------|
| **Asterisk Container** | `/var/spool/asterisk/monitor/${tenant}/` | Where Asterisk writes recordings |
| **Host Machine** | `./asterisk/recordings/${tenant}/` | Shared volume location |
| **Backend Container** | `/app/recordings/${tenant}/` | Where backend scans for recordings |
| **Default Tenant** | `demo` | Value from `TENANT` env var |

---

## How to Enable Recordings

### Option 1: Enable Recording for a Specific Phone Number (Recommended)

1. **Log in to the AVR Admin Dashboard**
   - URL: https://agent.callbust.com (production)
   - Username: `admin`
   - Password: (your configured password)

2. **Navigate to Numbers Page**
   - Click "Numbers" in the sidebar

3. **Edit an Existing Number** or **Create a New Number**
   - Click the pencil icon to edit
   - OR click "New Number" to create

4. **Enable Recording**
   - In the form, find the **"Recording"** field
   - Change from **"Off"** to **"On"**
   - Click "Save"

5. **The system will automatically**:
   - Update the Asterisk dialplan
   - Add `MixMonitor` to the call flow
   - Reload Asterisk configuration

6. **Make a test call** to verify recordings work

### Option 2: Enable Recording via API

```bash
# Get the number ID first
curl -X GET https://agent.callbust.com/api/numbers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update the number to enable recording
curl -X PATCH https://agent.callbust.com/api/numbers/{number-id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recordingEnabled": true
  }'
```

### Option 3: Enable Recording for All Numbers (Database Update)

⚠️ **Advanced users only** - requires direct database access

```bash
# SSH into server
ssh root@192.241.179.25

# Navigate to data directory
cd /opt/avr/avr-app/data

# Backup database first
cp data.db data.db.backup

# Update all agent numbers to enable recording
sqlite3 data.db "UPDATE phone_number SET recordingEnabled = 1 WHERE application = 'agent';"

# Restart backend to regenerate dialplans
docker restart avr-app-backend
```

---

## Verifying Recordings Work

### 1. Check if Recording is Enabled for a Number

**Via Dashboard**:
- Go to Numbers page
- Look at the number details
- Recording column should show "Enabled"

**Via File System**:
```bash
# SSH into server
ssh root@192.241.179.25

# Check generated dialplan
cd /opt/avr/avr-app/asterisk
cat extensions.conf
```

Look for this line in the dialplan:
```
same => n,MixMonitor(/var/spool/asterisk/monitor/demo/${UUID}.wav)
```

If this line exists for your extension, recording is enabled.

### 2. Make a Test Call

1. Register a SIP phone to Asterisk
   - Server: `192.241.179.25:5060`
   - Username: `1000`
   - Password: `1000`

2. Call the extension configured for your agent (e.g., `3000`)

3. Talk for at least 10 seconds

4. Hang up

### 3. Check if Recording File Was Created

```bash
# SSH into server
ssh root@192.241.179.25

# List recordings
cd /opt/avr/avr-app/asterisk/recordings/demo
ls -lh

# You should see files like: abc12345-xyz-uuid.wav
```

### 4. Verify Backend Syncs the Recording

```bash
# Check backend logs
docker logs avr-app-backend | grep -i recording

# You should see logs about syncing recordings
```

### 5. Check Dashboard

1. Log in to AVR Admin Dashboard
2. Navigate to **Recordings** page
3. You should see your call recording listed
4. Click "Listen" to play it in browser
5. Click "Download" to save the file

---

## Troubleshooting

### Recordings Page Shows "No recordings found"

**Possible Causes**:

1. **Recording not enabled for the number**
   - Solution: Follow "How to Enable Recordings" above

2. **No calls have been made yet**
   - Solution: Make a test call

3. **Directory doesn't exist**
   ```bash
   # Create the tenant directory
   mkdir -p ./asterisk/recordings/demo
   ```

4. **Wrong tenant name**
   ```bash
   # Check TENANT env var in docker-compose
   docker exec avr-app-backend env | grep TENANT

   # Should output: TENANT=demo
   ```

5. **Backend container not seeing the files**
   ```bash
   # Check if volume mount is correct
   docker inspect avr-app-backend | grep -A 5 Mounts

   # Check inside container
   docker exec avr-app-backend ls -la /app/recordings/demo/
   ```

### Recording File Exists But Doesn't Show in Dashboard

**Solution 1**: Force backend to re-sync
```bash
# Restart backend
docker restart avr-app-backend

# Check logs
docker logs -f avr-app-backend
```

**Solution 2**: Check file permissions
```bash
# Recordings directory should be readable
ls -la ./asterisk/recordings/demo/

# Fix permissions if needed
chmod 755 ./asterisk/recordings/demo
chmod 644 ./asterisk/recordings/demo/*.wav
```

### MixMonitor Not in Dialplan

**Check if recording is enabled**:
```bash
cat ./asterisk/extensions.conf
```

If you don't see `MixMonitor` line:
1. Verify `recordingEnabled` is set to `true` in database
2. Trigger dialplan regeneration by editing the number in dashboard
3. Check backend logs for errors

### Recording Saves But Can't Download

**Check file path**:
```bash
# Inside backend container
docker exec avr-app-backend ls -la /app/recordings/demo/

# On host
ls -la ./asterisk/recordings/demo/
```

**Check recording service logs**:
```bash
docker logs avr-app-backend 2>&1 | grep -i recording
```

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASTERISK_MONITOR_PATH` | `../recordings` | Path where backend looks for recordings |
| `TENANT` | `demo` | Tenant subdirectory name |

### Docker Volume Mounts

#### Asterisk Container
```yaml
volumes:
  - ./asterisk/recordings:/var/spool/asterisk/monitor
```

#### Backend Container
```yaml
volumes:
  - ./asterisk/recordings:/app/recordings
environment:
  - ASTERISK_MONITOR_PATH=/app/recordings
  - TENANT=demo
```

### Database Schema

**Table**: `phone_number`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid | - | Primary key |
| `value` | string | - | Phone number |
| `application` | enum | `agent` | agent / internal / transfer |
| `recordingEnabled` | boolean | `false` | Enable recording for this number |
| `denoiseEnabled` | boolean | `true` | Enable noise reduction |

**Table**: `recording`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `callUuid` | string | Unique call identifier |
| `filename` | string | Recording filename (e.g., uuid.wav) |
| `sizeBytes` | integer | File size in bytes |
| `recordedAt` | datetime | Recording timestamp |

---

## Deployment Steps

### After Applying These Fixes

1. **Rebuild and restart containers**:
   ```bash
   # SSH into server
   ssh root@192.241.179.25

   cd /opt/avr/avr-app

   # Pull latest backend image (if using Docker Hub)
   docker-compose -f docker-compose-production.yml pull avr-app-backend

   # Restart services
   docker-compose -f docker-compose-production.yml down
   docker-compose -f docker-compose-production.yml up -d
   ```

2. **Verify environment variable**:
   ```bash
   docker exec avr-app-backend env | grep ASTERISK_MONITOR_PATH
   # Should output: ASTERISK_MONITOR_PATH=/app/recordings
   ```

3. **Enable recording for at least one number** (see above)

4. **Make a test call**

5. **Check recordings page**

---

## Summary of Changes Made

### Files Modified

1. **[docker-compose-production.yml](docker-compose-production.yml)**
   - Line 118: `ASTERISK_RECORDINGS_PATH` → `ASTERISK_MONITOR_PATH`

2. **[avr-infra/docker-compose-app.yml](avr-infra/docker-compose-app.yml)**
   - Line 38: `ASTERISK_RECORDINGS_PATH` → `ASTERISK_MONITOR_PATH`

3. **[avr-app/backend/src/recordings/recordings.service.ts](avr-app/backend/src/recordings/recordings.service.ts)**
   - `getRecordingPath()`: Added tenant subdirectory to path
   - `syncFromFilesystem()`: Updated to scan tenant subdirectory

### No Changes Required

- Frontend already has recording UI (toggle field in Numbers form)
- Asterisk service already generates correct MixMonitor command
- Database schema already has `recordingEnabled` field
- Volume mounts already correct in docker-compose

---

## Next Steps

1. ✅ Apply the code fixes (DONE)
2. ⏳ Rebuild backend Docker image
3. ⏳ Deploy updated containers
4. ⏳ Enable recording for your phone numbers
5. ⏳ Test with a real call
6. ✅ Enjoy working call recordings!

---

## Support

If you encounter issues after following this guide:

1. Check backend logs: `docker logs avr-app-backend`
2. Check Asterisk logs: `docker exec avr-asterisk asterisk -rx "core show channels verbose"`
3. Verify file exists: `ls -lh ./asterisk/recordings/demo/`
4. Check dialplan: `cat ./asterisk/extensions.conf | grep MixMonitor`

For additional help, refer to:
- [AVR Documentation](avr-docs/)
- [AVR Architecture Analysis](AVR_ARCHITECTURE_ANALYSIS.md)
- [Discord Community](https://discord.gg/DFTU69Hg74)
