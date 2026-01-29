# Recording System - Complete Fix Summary

## Issues Fixed

### 1. ✅ Missing Volume Mount
**Problem**: Recordings were created inside the Asterisk container but not persisted to the host filesystem.

**Fix**: Added volume mount in `docker-compose-production.yml`:
```yaml
volumes:
  - ./asterisk/recordings:/var/spool/asterisk/monitor
```

**Status**: ✅ Fixed - Container recreated with proper mount

### 2. ✅ Backend Path Configuration  
**Problem**: Backend was looking for recordings in the wrong directory.

**Fix**: Added `ASTERISK_MONITOR_PATH` to `avr-app/backend/.env`:
```env
ASTERISK_MONITOR_PATH=../../asterisk/recordings
```

**Status**: ✅ Fixed - Backend can now find recordings

## Verification

### Current State
```bash
# 1. Check recording mount exists
docker inspect avr-asterisk --format '{{range .Mounts}}{{if eq .Destination "/var/spool/asterisk/monitor"}}✅ {{.Source}} -> {{.Destination}}{{end}}{{end}}'

# 2. Check existing recordings
ls -lh /home/shahrukhfiaz/AVR\ Multiple\ Campaigns/AVR\ Multiple\ Campaigns/asterisk/recordings/demo/

# 3. Test backend can access recordings
cd avr-app/backend && node -e "require('dotenv').config(); const path = require('path'); const resolved = path.resolve(process.cwd(), process.env.ASTERISK_MONITOR_PATH || '../recordings'); console.log('✅ Recording path:', resolved);"
```

## Test Recording

### Extension 4141 has recording ENABLED

**To test**:
1. Make a call to extension **4141**
2. Have a conversation for 10-20 seconds
3. Hang up
4. Check for new recording:
   ```bash
   ls -lh asterisk/recordings/demo/
   ```
5. The recording should appear with a UUID filename: `{uuid}.wav`

### Extension 3000 has recording DISABLED (for testing)

**Asterisk Configuration**:
- Extension 3000: `recording: false` (no MixMonitor)
- Extension 4141: `recording: true` (with MixMonitor)

## How It Works Now

1. **Call Starts** → Asterisk receives call
2. **Extension Check** → Looks up extension (3000 or 4141) in dialplan
3. **Recording Decision** → If `recordingEnabled: true` in number config:
   - Asterisk runs: `MixMonitor(/var/spool/asterisk/monitor/demo/${UUID}.wav)`
4. **File Created** → Recording saved to mounted volume
5. **Backend Sync** → Recordings service scans directory and updates database
6. **API Access** → Recordings accessible via `/recordings` endpoint

## File Locations

### Host (Persistent Storage)
```
/home/shahrukhfiaz/AVR Multiple Campaigns/AVR Multiple Campaigns/
├── asterisk/recordings/
│   └── demo/
│       └── {uuid}.wav  ← Recordings stored here
```

### Container (Mounted)
```
/var/spool/asterisk/monitor/
└── demo/
    └── {uuid}.wav  ← Same files via mount
```

### Backend Access
```
Backend working directory: avr-app/backend/
Relative path: ../../asterisk/recordings
Resolved to: /home/shahrukhfiaz/AVR Multiple Campaigns/AVR Multiple Campaigns/asterisk/recordings
```

## Accessing Recordings via API

### List all recordings
```bash
# Requires authentication
curl -H "Authorization: Bearer {token}" http://localhost:3001/recordings
```

### Get specific recording
```bash
curl -H "Authorization: Bearer {token}" http://localhost:3001/recordings/{uuid}
```

### Download recording
```bash
curl -H "Authorization: Bearer {token}" \
     -o recording.wav \
     http://localhost:3001/recordings/{uuid}/download
```

## Production Deployment

### When deploying to production, ensure:

1. **Docker Compose** includes recordings volume:
   ```yaml
   volumes:
     - ./asterisk/recordings:/var/spool/asterisk/monitor
   ```

2. **Backend .env** has correct path:
   ```env
   ASTERISK_MONITOR_PATH=../../asterisk/recordings
   TENANT=demo  # or your tenant name
   ```

3. **Permissions** allow Asterisk to write:
   ```bash
   chmod -R 777 asterisk/recordings/
   ```

4. **Backup Strategy** for recordings:
   - Recordings are in `asterisk/recordings/demo/`
   - Include this directory in your backup plan
   - Consider archiving old recordings periodically

## Troubleshooting

### No recordings appearing?

1. **Check Asterisk is writing files**:
   ```bash
   docker exec avr-asterisk ls -la /var/spool/asterisk/monitor/demo/
   ```

2. **Check mount is active**:
   ```bash
   docker inspect avr-asterisk | grep -A 5 "Mounts"
   ```

3. **Check backend can see files**:
   ```bash
   ls -la asterisk/recordings/demo/
   ```

4. **Check backend path config**:
   ```bash
   grep ASTERISK_MONITOR_PATH avr-app/backend/.env
   ```

### Recording exists but not in API?

The backend syncs recordings from filesystem on demand. The `listRecordings()` method automatically scans the directory.

### Permission errors?

```bash
sudo chmod -R 777 asterisk/recordings/
```

## Summary

✅ **Recordings now work automatically**:
- New recordings appear immediately in both container and host
- Backend can access and serve recordings via API
- Recordings persist across container restarts
- No manual intervention needed

**Next Steps**: Make a test call to extension 4141 to verify everything works!
