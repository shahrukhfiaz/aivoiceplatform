# Quick Start Guide - AVR Localhost Setup

## Prerequisites Check

✅ **Node.js**: v20.19.6 (installed)
✅ **npm**: 10.8.2 (installed)  
✅ **Docker**: 28.2.2 (installed)
✅ **Docker Compose**: v5.0.1 (installed)
✅ **Git**: (installed)

## Step 1: Fix Docker Permissions (REQUIRED)

You need to add your user to the docker group to run Docker without sudo:

```bash
sudo usermod -aG docker $USER
```

**Then you MUST do one of the following:**

**Option A (Recommended):** Log out and log back in
```bash
# Log out of your session completely, then log back in
```

**Option B:** Use newgrp to activate the group immediately
```bash
newgrp docker
# Then run the setup script in this new shell
```

**Option C:** Restart your terminal session

After this, verify Docker works:
```bash
docker ps
# Should work without sudo
```

## Step 2: Run the Setup Script

Once Docker permissions are fixed, run:

```bash
cd "/home/shahrukhfiaz/AVR Multiple Campaigns/AVR Multiple Campaigns"
./setup_and_start_localhost.sh
```

This script will:
1. ✅ Install backend dependencies (already done)
2. ✅ Install frontend dependencies (already done)
3. ✅ Verify/create environment files
4. ✅ Create Docker network
5. ✅ Start Docker services (avr-asterisk, avr-ami, avr-phone)
6. ✅ Start backend service (port 3001)
7. ✅ Start frontend service (port 3000)

## Step 3: Access the Application

After the script completes, access:

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Web Phone Client**: http://localhost:9080
- **Asterisk ARI**: http://localhost:9088/ari
- **AMI Service**: http://localhost:6006

## Step 4: Initial Setup

1. **Login to Frontend**:
   - Open http://localhost:3000
   - Default credentials (check backend logs or .env file):
     - Username: `admin@agentvoiceresponse.com` or `admin`
     - Password: Check `avr-app/backend/.env` for `ADMIN_PASSWORD`

2. **Create a Provider**:
   - Go to Providers → New Provider
   - Add your API keys (Deepgram, OpenAI, etc.)

3. **Create an Agent**:
   - Go to Agents → New Agent
   - Select mode (Pipeline or STS)
   - Assign providers

4. **Create a Phone Number**:
   - Go to Numbers → New Number
   - Enter extension (e.g., `1001`)
   - Assign your agent

5. **Test a Call**:
   - Open Web Phone at http://localhost:9080
   - Register with SIP credentials
   - Dial your agent's number

## Viewing Logs

**Backend logs:**
```bash
tail -f avr-app/backend.log
```

**Frontend logs:**
```bash
tail -f avr-app/frontend.log
```

**Docker services logs:**
```bash
docker-compose -f docker-compose-local-dev.yml logs -f
```

**Specific service:**
```bash
docker-compose -f docker-compose-local-dev.yml logs -f avr-asterisk
docker-compose -f docker-compose-local-dev.yml logs -f avr-ami
docker-compose -f docker-compose-local-dev.yml logs -f avr-phone
```

## Stopping All Services

```bash
./stop_all_services.sh
```

Or manually:
```bash
# Stop backend
kill $(cat avr-app/backend.pid) 2>/dev/null || true

# Stop frontend  
kill $(cat avr-app/frontend.pid) 2>/dev/null || true

# Stop Docker services
docker-compose -f docker-compose-local-dev.yml down
```

## Troubleshooting

### Docker Permission Denied

If you see "permission denied" for Docker:
```bash
sudo usermod -aG docker $USER
# Then log out and log back in
```

### Port Already in Use

If a port is already in use:
```bash
# Find what's using the port
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :9080

# Kill the process or change the port in .env files
```

### Services Not Starting

Check service status:
```bash
docker-compose -f docker-compose-local-dev.yml ps
docker-compose -f docker-compose-local-dev.yml logs
```

### Backend/Frontend Not Starting

Check the log files:
```bash
cat avr-app/backend.log
cat avr-app/frontend.log
```

## Manual Service Start (Alternative)

If the script doesn't work, start services manually:

**Terminal 1 - Docker Services:**
```bash
cd "/home/shahrukhfiaz/AVR Multiple Campaigns/AVR Multiple Campaigns"
docker network create avr 2>/dev/null || true
docker-compose -f docker-compose-local-dev.yml up -d
```

**Terminal 2 - Backend:**
```bash
cd "/home/shahrukhfiaz/AVR Multiple Campaigns/AVR Multiple Campaigns/avr-app/backend"
npm run start:dev
```

**Terminal 3 - Frontend:**
```bash
cd "/home/shahrukhfiaz/AVR Multiple Campaigns/AVR Multiple Campaigns/avr-app/frontend"
npm run dev
```

## Next Steps

1. Configure providers with your API keys
2. Create agents and test calls
3. Review the architecture documentation
4. Start developing!

For more information:
- [Local Development Setup](./LOCAL_DEVELOPMENT_SETUP.md)
- [Local Services Setup](./LOCAL_SERVICES_SETUP.md)
- [AVR Architecture](./AVR_ARCHITECTURE_ANALYSIS.md)

