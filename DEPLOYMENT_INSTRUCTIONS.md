# AVR Cloud Server Deployment Instructions

## Server Information
- **IP Address**: 192.241.179.25
- **Username**: root
- **Password**: Seahub123@

## Prerequisites

### Option 1: Using plink (Recommended for Windows)
1. Download **plink.exe** from PuTTY website:
   - https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
   - Download the Windows installer or standalone executables
   - Extract `plink.exe` to a folder in your PATH, or specify full path in scripts

2. Download **pscp.exe** (for file uploads, optional):
   - Same download as above, includes pscp.exe

### Option 2: Using SSH directly
If you have SSH access, you can run the bash script directly on the server.

---

## Deployment Methods

### Method 1: Automated Batch Script (Windows - Easiest)

1. **Run the batch file**:
   ```cmd
   deploy.bat
   ```

   This will:
   - Install Docker and Docker Compose
   - Clone all AVR repositories
   - Configure system optimizations
   - Set up Docker network

2. **Wait for completion** (takes 5-10 minutes)

3. **Follow the next steps** shown at the end

---

### Method 2: PowerShell Script

1. **Open PowerShell** in the AVR Multiple Campaigns directory

2. **Run the script**:
   ```powershell
   .\deploy_avr_cloud.ps1
   ```

   Or if you prefer to upload and execute:
   ```powershell
   .\deploy_single_command.ps1
   ```

---

### Method 3: Manual plink Commands

1. **Copy commands from** `deploy_commands.txt`

2. **Execute each command** in Command Prompt or PowerShell:
   ```cmd
   plink.exe -ssh -pw Seahub123@ root@192.241.179.25 "command here"
   ```

---

### Method 4: Upload and Execute Script (Linux/Mac)

1. **Upload the script**:
   ```bash
   scp deploy_avr_cloud.sh root@192.241.179.25:/root/
   ```

2. **SSH into server**:
   ```bash
   ssh root@192.241.179.25
   ```

3. **Make executable and run**:
   ```bash
   chmod +x /root/deploy_avr_cloud.sh
   /root/deploy_avr_cloud.sh
   ```

---

## What Gets Installed

### System Packages
- Docker CE (latest)
- Docker Compose (standalone)
- Git, curl, wget, and other prerequisites

### AVR Repositories (cloned to `/opt/avr/`)
- `avr-infra` - Infrastructure orchestration
- `avr-app` - Web administration panel
- `avr-sts-deepgram` - Deepgram STS service
- `avr-ami` - Asterisk Manager Interface
- `avr-webhook` - Webhook service
- `avr-phone` - WebRTC phone client
- `avr-asterisk` - Asterisk Docker image
- `avr-vad` - Voice Activity Detection library
- `avr-docs` - Documentation

### System Optimizations
- Increased file descriptor limits (65536)
- Network buffer optimizations for RTP
- UDP memory settings for media streaming

---

## Post-Deployment Steps

### 1. SSH into the Server
```bash
ssh root@192.241.179.25
```

### 2. Navigate to AVR Infrastructure
```bash
cd /opt/avr/avr-infra
```

### 3. Configure Environment Variables

**For Deepgram STS (Recommended for quick start):**
```bash
# Copy example file
cp .env.example .env

# Edit the .env file
nano .env
```

**Required variables for Deepgram STS:**
```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
AGENT_PROMPT="You are a helpful assistant. Be friendly and professional."
PORT=6033
```

**Optional variables:**
```env
DEEPGRAM_SAMPLE_RATE=8000
DEEPGRAM_ASR_MODEL=nova-3
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_GREETING="Hi there, I'm your virtual assistant—how can I help today?"
OPENAI_MODEL=gpt-4o-mini
```

### 4. Start Services

**For Deepgram STS:**
```bash
docker-compose -f docker-compose-deepgram.yml up -d
```

**For other providers, choose appropriate compose file:**
```bash
# OpenAI + Deepgram
docker-compose -f docker-compose-openai.yml up -d

# Anthropic + Deepgram
docker-compose -f docker-compose-anthropic.yml up -d

# With Web App
docker-compose -f docker-compose-app.yml up -d
```

### 5. Verify Services are Running
```bash
docker ps
```

You should see containers for:
- `avr-core`
- `avr-sts-deepgram` (or your chosen service)
- `avr-asterisk`
- `avr-ami`

### 6. Check Logs
```bash
# View all logs
docker-compose -f docker-compose-deepgram.yml logs

# Follow logs
docker-compose -f docker-compose-deepgram.yml logs -f

# View specific service logs
docker logs avr-core
docker logs avr-sts-deepgram
```

---

## Firewall Configuration

### Required Ports

**Open these ports in your cloud provider's firewall:**

- **TCP 5001**: AVR Core (AudioSocket)
- **TCP 5038**: Asterisk AMI (restrict to internal network)
- **TCP 5060**: SIP (if exposing externally)
- **TCP 8088**: Asterisk ARI (restrict to internal network)
- **TCP 3001**: AVR App Backend (if using app)
- **TCP 3000**: AVR App Frontend (if using app)
- **TCP 6006**: AVR AMI (restrict to internal network)
- **TCP 6033**: STS Service (if exposing externally)
- **UDP 10000-20000**: RTP Media (required for calls)

### Example UFW Commands (if using Ubuntu firewall)
```bash
# Allow SSH
ufw allow 22/tcp

# Allow AVR Core
ufw allow 5001/tcp

# Allow SIP (if needed)
ufw allow 5060/tcp

# Allow RTP
ufw allow 10000:20000/udp

# Allow Web App (if using)
ufw allow 3000/tcp
ufw allow 3001/tcp

# Enable firewall
ufw enable
```

---

## Testing the Installation

### 1. Test Docker
```bash
docker --version
docker-compose --version
docker ps
```

### 2. Test Asterisk
```bash
# Check Asterisk status
docker exec avr-asterisk asterisk -rx "core show version"

# Check SIP endpoints
docker exec avr-asterisk asterisk -rx "pjsip show endpoints"
```

### 3. Test AVR Core
```bash
# Check if AVR Core is listening
netstat -tlnp | grep 5001
```

### 4. Make a Test Call

1. **Register a SIP client** with:
   - Server: `192.241.179.25:5060`
   - Username: `1000`
   - Password: `1000`
   - Transport: TCP

2. **Call extension 5001** (or the extension configured in your dialplan)

3. **You should hear** the AI assistant respond

---

## Troubleshooting

### Issue: plink not found
**Solution**: Download plink.exe and either:
- Add to PATH, or
- Specify full path in scripts: `C:\path\to\plink.exe`

### Issue: Connection refused
**Solution**: 
- Verify server IP is correct
- Check if SSH is enabled on port 22
- Verify firewall allows SSH

### Issue: Docker installation fails
**Solution**:
- Check if server is Ubuntu/Debian
- Verify internet connectivity
- Try manual installation steps

### Issue: Git clone fails
**Solution**:
- Check internet connectivity
- Verify GitHub is accessible
- Try cloning manually: `git clone https://github.com/agentvoiceresponse/avr-infra.git`

### Issue: Services won't start
**Solution**:
- Check logs: `docker-compose logs`
- Verify .env file has correct API keys
- Check port conflicts: `netstat -tlnp`
- Verify Docker network exists: `docker network ls`

### Issue: No audio in calls
**Solution**:
- Check RTP ports are open (UDP 10000-20000)
- Verify codec settings in Asterisk
- Check AVR Core logs for errors
- Verify API keys are correct

---

## Security Recommendations

### 1. Change Default Passwords
- Change SSH password
- Change Asterisk AMI password
- Use strong API keys

### 2. Restrict Access
- Use firewall to restrict AMI/ARI ports
- Use VPN for administrative access
- Enable fail2ban for SSH protection

### 3. Keep Updated
```bash
apt-get update && apt-get upgrade -y
docker system prune -a
```

### 4. Use Secrets Management
- Store API keys in environment variables
- Use Docker secrets for production
- Never commit .env files to git

---

## Next Steps

1. **Configure your AI providers** (Deepgram, OpenAI, etc.)
2. **Set up phone numbers** and SIP trunks
3. **Configure Asterisk dialplan** for your use case
4. **Set up monitoring** (optional)
5. **Configure backups** for recordings and database
6. **Set up webhooks** for call analytics (optional)

---

## Support

- **Documentation**: https://github.com/agentvoiceresponse/avr-docs
- **Discord**: https://discord.gg/DFTU69Hg74
- **GitHub**: https://github.com/agentvoiceresponse

---

## Files Created

- `deploy.bat` - Windows batch script (easiest)
- `deploy_avr_cloud.ps1` - PowerShell script
- `deploy_avr_cloud.sh` - Bash script (for Linux/Mac)
- `deploy_commands.txt` - Manual plink commands
- `deploy_single_command.ps1` - Upload and execute script
- `DEPLOYMENT_INSTRUCTIONS.md` - This file

Choose the method that works best for your environment!

