# AVR Webphone Local Development Setup Guide

This guide explains how to configure the AVR webphone for local development, especially on Windows systems where Hyper-V reserves certain ports.

## Prerequisites

- Docker Desktop installed and running
- Node.js installed (v18+)
- The AVR Multiple Campaigns repository cloned

## Quick Start

If you just want to get everything running quickly:

```powershell
# 1. Create the Docker network
docker network create avr

# 2. Start Docker containers
cd "C:\AVR Multiple Campaigns"
docker-compose -f docker-compose-local-dev.yml up -d

# 3. Start the backend
cd avr-app/backend
npm install  # First time only
$env:PORT="3001"; npm run start:dev

# 4. Start the frontend (new terminal)
cd avr-app/frontend
npm install  # First time only
npm run start:dev
```

Then access:
- **Dashboard**: http://localhost:3000
- **Webphone (standalone)**: http://localhost:9080

---

## Understanding the Port Configuration

### Windows Hyper-V Port Reservations

Windows with Hyper-V enabled reserves dynamic port ranges that often include common ports like 8080-8912. You can check reserved ports with:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

### Port Mappings

Due to these reservations, we use the following port mappings:

| Service | Internal Port | External Port | Description |
|---------|--------------|---------------|-------------|
| Asterisk AMI | 5038 | 5038 | Asterisk Manager Interface |
| Asterisk SIP | 5060 | 5060 | SIP signaling |
| Asterisk ARI HTTP | 8088 | **9088** | ARI REST API & WebSocket |
| Asterisk ARI HTTPS | 8089 | **9089** | ARI HTTPS/WSS |
| avr-phone | 80 | **9080** | Webphone client |
| avr-ami | 6006 | 6006 | AMI microservice |
| Backend | 3001 | 3001 | NestJS API |
| Frontend | 3000 | 3000 | Next.js Dashboard |

---

## Configuration Files

### 1. Docker Compose (`docker-compose-local-dev.yml`)

Ensure ports are mapped correctly:

```yaml
services:
  avr-asterisk:
    image: agentvoiceresponse/avr-asterisk
    ports:
      - "5038:5038"    # AMI
      - "5060:5060"    # SIP
      - "9088:8088"    # ARI HTTP (external:internal)
      - "9089:8089"    # ARI HTTPS/WebSocket
      - "10000-10050:10000-10050/udp"  # RTP
    networks:
      - avr

  avr-ami:
    image: agentvoiceresponse/avr-ami
    ports:
      - "6006:6006"
    environment:
      - AMI_HOST=avr-asterisk
      - AMI_PORT=5038
    networks:
      - avr

  avr-phone:
    build:
      context: ./avr-phone
      dockerfile: Dockerfile
    ports:
      - "9080:80"  # External port 9080
    networks:
      - avr

networks:
  avr:
    name: avr
    external: true
```

### 2. Webphone Configuration (`avr-phone/src/index.html`)

The phone needs to know where to connect. Add these settings in the `phoneOptions`:

```html
<!-- Provisioning -->
<script type="text/javascript">
    var phoneOptions = {
        loadAlternateLang: true,
        wssServer: "localhost",
        WebSocketPort: "9089",      // Mapped Asterisk ARI HTTPS/WSS port (use 9089 for WSS, 9088 for WS)
        ServerPath: "/ws",
        SipDomain: "localhost"
    }
</script>
```

**Important Note**: 
- If accessing the webphone from an **HTTPS page** (e.g., `https://phone.agentvoiceresponse.com`), browsers require secure WebSocket (`wss://`). Use port **9089** (HTTPS/WSS).
- If accessing from an **HTTP page** (e.g., `http://localhost:9080`), you can use port **9088** (HTTP/WS).
- Port 9089 uses HTTPS which may have certificate warnings for localhost - this is normal and can be accepted.

### 3. Frontend Environment (`avr-app/frontend/.env.local`)

Point the dashboard to the correct webphone URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBRTC_CLIENT_URL=http://localhost:9080
```

### 4. Backend Environment (`avr-app/backend/.env`)

Configure the backend to use the mapped ARI port:

```env
# General
PORT=3001

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password-here

# Asterisk ARI (use mapped port 9088)
ARI_URL=http://localhost:9088/ari
ARI_USERNAME=avr
ARI_PASSWORD=avr
ASTERISK_CONFIG_PATH=../../avr-infra/asterisk/conf

# Database (SQLite for local dev)
DB_TYPE=sqlite

# Docker (Windows)
DOCKER_SOCKET_PATH=//./pipe/docker_engine

# Network
AVR_NETWORK=avr

# AVR Core Image (IMPORTANT: latest is broken, use 1.10.1)
CORE_DEFAULT_IMAGE=agentvoiceresponse/avr-core:1.10.1
```

---

## Step-by-Step Setup

### Step 1: Create Docker Network

```powershell
docker network create avr
```

### Step 2: Configure Files

1. **Edit `docker-compose-local-dev.yml`** - Set the correct port mappings as shown above

2. **Edit `avr-phone/src/index.html`** - Add phoneOptions with correct ports

3. **Create/Edit `avr-app/frontend/.env.local`**:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_WEBRTC_CLIENT_URL=http://localhost:9080
   ```

4. **Create/Edit `avr-app/backend/.env`** - Set `ARI_URL=http://localhost:9088/ari`

### Step 3: Build and Start Docker Containers

```powershell
cd "C:\AVR Multiple Campaigns"

# Build (rebuilds avr-phone with your changes)
docker-compose -f docker-compose-local-dev.yml build --no-cache avr-phone

# Start all containers
docker-compose -f docker-compose-local-dev.yml up -d
```

### Step 4: Verify Containers

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:
```
NAMES          STATUS          PORTS
avr-asterisk   Up X minutes    ...9088->8088/tcp, ...9089->8089/tcp...
avr-phone      Up X minutes    ...9080->80/tcp...
avr-ami        Up X minutes    ...6006->6006/tcp...
```

### Step 5: Start Backend

```powershell
cd "C:\AVR Multiple Campaigns\avr-app\backend"
npm install  # First time only
$env:PORT="3001"; npm run start:dev
```

Wait for: `Nest application successfully started`

### Step 6: Start Frontend

Open a new terminal:

```powershell
cd "C:\AVR Multiple Campaigns\avr-app\frontend"
npm install  # First time only
npm run start:dev
```

Wait for: `Ready in X.Xs`

---

## Testing the Webphone

1. **Access the Dashboard**: http://localhost:3000

2. **Login** with:
   - Username: `admin`
   - Password: (check your backend `.env` file)

3. **Click the phone icon** in the header to open the webphone panel

4. **Check browser console** for WebSocket connection:
   - ✅ Good: `Connecting ws://localhost:9088/ws`
   - ❌ Bad: `Connecting wss://localhost:8088/ws` (old cached settings)

5. **If you see old settings**, clear browser cache:
   - Press `Ctrl+Shift+Delete`
   - Clear cached images and files
   - Hard refresh with `Ctrl+Shift+R`

---

## Troubleshooting

### Issue: WebSocket connection failed

**Symptoms**: 
```
WebSocket connection to 'wss://localhost:8088/ws' failed
```

**Solutions**:
1. Check port reservations: `netsh interface ipv4 show excludedportrange protocol=tcp`
2. Ensure Asterisk is running: `docker logs avr-asterisk`
3. Test ARI endpoint: Open http://localhost:9088/ari/api-docs in browser
4. Clear browser cache and refresh

### Issue: Port already in use

**Symptoms**:
```
Error: bind: An attempt was made to access a socket in a way forbidden
```

**Solutions**:
1. Check Windows reserved ports (see above)
2. Change to a port outside the reserved range (e.g., 9080, 9088)
3. Stop conflicting services

### Issue: Network 'avr' not found

**Symptoms**:
```
network avr not found
```

**Solutions**:
```powershell
docker network create avr
```

### Issue: Phone shows old settings after rebuild

**Cause**: Browser caching

**Solutions**:
1. Hard refresh: `Ctrl+Shift+R`
2. Clear browser cache
3. Use incognito/private window
4. Clear localStorage:
   ```javascript
   // In browser console
   localStorage.clear()
   ```

### Issue: Registration Failed - Service Unavailable

**Possible causes**:
1. Asterisk not running
2. Wrong port configuration
3. WebSocket path incorrect

**Debug steps**:
1. Check Asterisk logs: `docker logs avr-asterisk`
2. Verify phone is connecting to correct URL (check browser console)
3. Ensure phoneOptions in index.html has correct values

### Issue: Agent Start Error - "unable to find user node"

**Symptoms**:
```
(HTTP code 500) server error - unable to find user node: no matching entries in passwd file
```

**Cause**: The `avr-core:latest` Docker image is broken and missing the `node` user in `/etc/passwd`.

**Solution**:
1. Add to `avr-app/backend/.env`:
   ```env
   CORE_DEFAULT_IMAGE=agentvoiceresponse/avr-core:1.10.1
   ```

2. Remove any existing broken containers:
   ```powershell
   docker ps -a --filter "name=avr-core" --format "{{.Names}}" | ForEach-Object { docker rm -f $_ }
   ```

3. Restart the backend to pick up the new environment variable

**Verification**:
```powershell
# Test that the image works
docker run --rm agentvoiceresponse/avr-core:1.10.1 echo "test"
```

---

## Phone Extension Configuration

The webphone uses SIP credentials to register with Asterisk. Default test extensions are configured in `avr-infra/asterisk/conf/pjsip.conf`:

| Extension | Password | Description |
|-----------|----------|-------------|
| 1000 | 1000 | Test extension 1 |
| 2000 | 2000 | Test extension 2 |

To configure a phone in the dashboard:
1. Go to **Telephony → Phones**
2. Click **Add Phone**
3. Enter extension number and password
4. The phone will appear in the webphone dropdown

---

## Summary of URLs

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| Webphone (standalone) | http://localhost:9080 |
| Backend API | http://localhost:3001 |
| Asterisk ARI | http://localhost:9088/ari |

---

## Dynamic Provider Configuration

The STS containers (e.g., `avr-sts-deepgram`) support **dynamic configuration loading**. This means you can change provider settings in the dashboard and new calls will automatically use the updated settings without restarting the agent container.

### How It Works

1. When the backend starts an agent, it passes `PROVIDER_ID` and `BACKEND_URL` environment variables to the STS container
2. The STS container fetches configuration from the backend API at each new call:
   ```
   GET /internal/providers/{providerId}/config
   ```
3. Configuration is cached for 5 seconds to avoid excessive API calls
4. Falls back to environment variables if API is unavailable

### Backend Configuration

Add to your `avr-app/backend/.env`:
```env
# Backend URL for container-to-backend communication
BACKEND_INTERNAL_URL=http://host.docker.internal:3001
```

### Benefits

| Behavior | Before (Env only) | After (Dynamic Config) |
|----------|-------------------|------------------------|
| Change prompt | Restart agent required | New calls use new prompt |
| Change API key | Restart agent required | New calls use new key |
| Change model | Restart agent required | New calls use new model |

### Note
- Changes apply to **new calls only** - existing calls continue with their original settings
- If the backend is unavailable, the container uses its initial environment variables as fallback

---

## Notes for Production

In production (with Traefik reverse proxy), the setup is different:
- All services use standard HTTPS (port 443)
- WebSocket uses `wss://` through Traefik
- SSL certificates are managed by Traefik

This guide is specifically for **local development** on Windows.

