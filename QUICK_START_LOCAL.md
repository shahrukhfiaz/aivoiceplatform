# Quick Start - Local Testing (Without Docker Rebuild)

## Overview
Since Docker builds are getting stuck, here's how to test the recording fixes locally without rebuilding Docker images.

---

## ✅ What's Already Done

1. **Backend Code Fixed** ✓
   - Recording service updated to use tenant subdirectory
   - Environment variable name fixed (ASTERISK_MONITOR_PATH)

2. **Frontend Code Fixed** ✓
   - New Switch component created
   - Numbers page updated with toggle UI
   - i18n translations added
   - Dependencies installed (@radix-ui/react-switch)
   - Built successfully

3. **Docker Compose Updated** ✓
   - Environment variable corrected in production config

4. **Recordings Directory Created** ✓
   - Directory structure: `asterisk/recordings/demo/`

---

## 🚀 Option 1: Run Backend & Frontend Locally (Recommended for Testing)

This approach runs the backend and frontend directly with Node.js, no Docker rebuild needed.

### Step 1: Start Backend Locally

```powershell
cd "c:\AVR Multiple Campaigns\avr-app\backend"

# Set environment variables
$env:PORT=3001
$env:ASTERISK_MONITOR_PATH="c:\AVR Multiple Campaigns\asterisk\recordings"
$env:TENANT="demo"
$env:DB_DATABASE="c:\AVR Multiple Campaigns\data\data.db"
$env:ASTERISK_CONFIG_PATH="c:\AVR Multiple Campaigns\asterisk"
$env:FRONTEND_URL="http://localhost:3000"

# Start backend in dev mode
npm run start:dev
```

### Step 2: Start Frontend Locally (New Terminal)

```powershell
cd "c:\AVR Multiple Campaigns\avr-app\frontend"

# Set environment variable
$env:NEXT_PUBLIC_API_URL="http://localhost:3001"

# Start frontend in dev mode
npm run start:dev
```

### Step 3: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### Step 4: Test Recording Toggle

1. Open http://localhost:3000
2. Log in (admin credentials from your setup)
3. Go to **Numbers** page
4. Click **Edit** on a number or **Create New**
5. **You'll see the new toggle switch UI!**
6. Toggle "Recording" to ON
7. Save

---

## 🚀 Option 2: Update Only Backend Container (Faster)

If you want to keep using Docker but avoid the stuck builds:

### Step 1: Copy Updated Backend Files to Container

```powershell
# Stop backend container
docker stop avr-app-backend

# Copy the updated recordings.service.ts into the container
docker cp "c:\AVR Multiple Campaigns\avr-app\backend\dist\recordings\recordings.service.js" avr-app-backend:/app/dist/recordings/

# Update environment variable and restart
docker start avr-app-backend
```

### Step 2: Run Frontend Locally

```powershell
cd "c:\AVR Multiple Campaigns\avr-app\frontend"
$env:NEXT_PUBLIC_API_URL="https://agent.callbust.com/api"
npm run start:dev
```

Access at: http://localhost:3000

---

## 🚀 Option 3: Manual Commands (Step by Step)

### Terminal 1 - Backend
```powershell
cd "c:\AVR Multiple Campaigns\avr-app\backend"
$env:PORT=3001
$env:ASTERISK_MONITOR_PATH="c:\AVR Multiple Campaigns\asterisk\recordings"
$env:TENANT="demo"
npm run start:dev
```

### Terminal 2 - Frontend
```powershell
cd "c:\AVR Multiple Campaigns\avr-app\frontend"
$env:NEXT_PUBLIC_API_URL="http://localhost:3001"
npm run start:dev
```

---

## 🎯 Testing the Recording Feature

### 1. Enable Recording for a Number

1. Open http://localhost:3000
2. Navigate to **Numbers**
3. Edit an existing number or create new
4. You'll see the **new toggle switch**:
   ```
   ┌────────────────────────────────────────┐
   │ Recording                    [ ON  ]  │
   │ Record all calls to this number       │
   └────────────────────────────────────────┘
   ```
5. Toggle it **ON**
6. Click **Save**

### 2. Verify in Database

```powershell
cd "c:\AVR Multiple Campaigns\data"
sqlite3 data.db "SELECT id, value, recordingEnabled FROM phone_number;"
```

Should show `recordingEnabled = 1` for the number.

### 3. Check Asterisk Dialplan

```powershell
Get-Content "c:\AVR Multiple Campaigns\asterisk\conf\extensions.conf" | Select-String "MixMonitor"
```

Should show:
```
same => n,MixMonitor(/var/spool/asterisk/monitor/demo/${UUID}.wav)
```

### 4. Make a Test Call

1. Register a SIP phone (if you have one configured)
2. Call the number
3. Talk for 10+ seconds
4. Hang up

### 5. Check Recordings

```powershell
# List recording files
Get-ChildItem "c:\AVR Multiple Campaigns\asterisk\recordings\demo"

# Check in UI
# Go to Recordings page in dashboard
# Your call should appear!
```

---

## 🔧 Troubleshooting

### Backend Won't Start
```powershell
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill process if needed
taskkill /F /PID <process_id>
```

### Frontend Build Errors
```powershell
# Clean and reinstall
cd "c:\AVR Multiple Campaigns\avr-app\frontend"
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .next
npm install
npm run start:dev
```

### Can't Connect to Backend
- Make sure backend is running on port 3001
- Check `$env:NEXT_PUBLIC_API_URL` is set correctly
- Try http://localhost:3001/api/health

### Recordings Not Showing
1. Check backend logs for errors
2. Verify `ASTERISK_MONITOR_PATH` environment variable
3. Check directory exists: `asterisk\recordings\demo\`
4. Make sure recording is enabled for the number

---

## 📊 Summary

**Fastest Way to Test:**

1. Open 2 PowerShell terminals
2. Terminal 1: Run backend locally
3. Terminal 2: Run frontend locally
4. Access http://localhost:3000
5. Test the new recording toggle!

**Benefits of Local Testing:**
- ✅ No Docker rebuild needed
- ✅ Hot reload on code changes
- ✅ Easier debugging
- ✅ Faster iteration
- ✅ See console logs directly

**When you're ready for production:**
- Build Docker images when Docker is stable
- Use the deployment scripts provided
- Or deploy just the updated backend container

---

## 🎉 What You'll See

The new recording toggle UI will look like this:

```
┌──────────────────────────────────────────────┐
│ Denoise                           [ ON  ]   │
│ Enable noise reduction for better audio     │
│ quality                                      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Recording                         [ OFF ]   │
│ Record all calls to this number              │
└──────────────────────────────────────────────┘
```

When you toggle it ON, the switch will animate and turn blue!

---

## 📝 Files Changed

All changes have been made to:
- ✅ [avr-app/backend/src/recordings/recordings.service.ts](avr-app/backend/src/recordings/recordings.service.ts)
- ✅ [avr-app/frontend/components/ui/switch.tsx](avr-app/frontend/components/ui/switch.tsx) (new)
- ✅ [avr-app/frontend/app/(protected)/numbers/page.tsx](avr-app/frontend/app/(protected)/numbers/page.tsx)
- ✅ [avr-app/frontend/lib/i18n/en.ts](avr-app/frontend/lib/i18n/en.ts)
- ✅ [avr-app/frontend/lib/i18n/it.ts](avr-app/frontend/lib/i18n/it.ts)
- ✅ [avr-app/frontend/package.json](avr-app/frontend/package.json)
- ✅ [docker-compose-production.yml](docker-compose-production.yml)

Everything is ready to test! 🚀
