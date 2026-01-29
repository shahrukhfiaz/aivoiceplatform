# AVR Production Deployment Guide

## Server Information
- **IP Address**: 192.241.179.25
- **Domain**: agent.callbust.com
- **Username**: root
- **Password**: Seahub123@
- **Deepgram API Key**: ad748182032466add820eed184e6b81aefa06fcd

## Quick Start

### Windows (Recommended)
1. **Run the deployment script**:
   ```cmd
   deploy_production.bat
   ```

2. **Wait for completion** (10-15 minutes)

3. **Access the dashboard**: https://agent.callbust.com

### Manual Deployment
1. **SSH into server**:
   ```bash
   ssh root@192.241.179.25
   ```

2. **Run configuration script**:
   ```bash
   cd /opt/avr/avr-infra
   chmod +x configure_production.sh
   ./configure_production.sh
   ```

3. **Start services**:
   ```bash
   docker-compose -f docker-compose-production.yml up -d
   ```

---

## What Gets Configured

### 1. Environment Variables (.env)
- Deepgram API key configured
- Agent prompt set
- JWT and webhook secrets generated
- Admin credentials set (default: admin/admin)

### 2. Firewall Rules (UFW)
- **TCP 22**: SSH
- **TCP 80**: HTTP
- **TCP 443**: HTTPS
- **TCP 5001**: AVR Core
- **TCP 5060**: SIP
- **UDP 5060**: SIP UDP
- **UDP 10000-20000**: RTP Media
- **TCP 8080**: Traefik Dashboard

### 3. Docker Services
- **Traefik**: Reverse proxy (ports 80, 443)
- **avr-core**: Core audio processing
- **avr-sts-deepgram**: Deepgram STS service
- **avr-asterisk**: Asterisk PBX
- **avr-ami**: Asterisk Manager Interface
- **avr-app-backend**: Admin API
- **avr-app-frontend**: Admin Dashboard

### 4. Domain Configuration
- Frontend accessible at: `https://agent.callbust.com`
- Backend API at: `https://agent.callbust.com/api`
- Traefik routes traffic based on domain

---

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Dashboard** | https://agent.callbust.com | admin / admin |
| **API** | https://agent.callbust.com/api | JWT token |
| **Traefik Dashboard** | http://192.241.179.25:8080 | - |
| **SIP** | 192.241.179.25:5060 | Configure in Asterisk |

---

## Post-Deployment Checklist

### 1. Change Default Passwords
- [ ] Change admin password in dashboard
- [ ] Update JWT_SECRET in .env file
- [ ] Update WEBHOOK_SECRET in .env file
- [ ] Change AMI password

### 2. Verify Services
```bash
# Check all containers are running
docker ps

# Check logs
docker-compose -f docker-compose-production.yml logs -f

# Check specific service
docker logs avr-core
docker logs avr-sts-deepgram
docker logs avr-app-frontend
```

### 3. Test Dashboard
- [ ] Access https://agent.callbust.com
- [ ] Login with admin/admin
- [ ] Create a provider (Deepgram STS)
- [ ] Create an agent
- [ ] Test call functionality

### 4. Configure SSL/HTTPS (Optional but Recommended)
Currently using HTTP. For production, set up SSL:

**Option A: Let's Encrypt with Traefik**
```yaml
# Add to traefik service in docker-compose-production.yml
- "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
- "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
- "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
```

**Option B: Cloudflare Proxy**
- Enable Cloudflare proxy for agent.callbust.com
- SSL/TLS mode: Full (strict)
- Automatic HTTPS redirect

### 5. Configure Asterisk
- [ ] Set up SIP endpoints
- [ ] Configure dialplan
- [ ] Test with SIP client

---

## Firewall Management

### View Firewall Status
```bash
ufw status verbose
```

### Add Additional Rules
```bash
ufw allow <port>/<protocol> comment 'Description'
```

### Remove Rules
```bash
ufw delete allow <port>/<protocol>
```

### Disable Firewall (if needed)
```bash
ufw disable
```

---

## Service Management

### Start Services
```bash
cd /opt/avr/avr-infra
docker-compose -f docker-compose-production.yml up -d
```

### Stop Services
```bash
docker-compose -f docker-compose-production.yml down
```

### Restart Services
```bash
docker-compose -f docker-compose-production.yml restart
```

### View Logs
```bash
# All services
docker-compose -f docker-compose-production.yml logs -f

# Specific service
docker-compose -f docker-compose-production.yml logs -f avr-core
```

### Update Services
```bash
# Pull latest images
docker-compose -f docker-compose-production.yml pull

# Restart with new images
docker-compose -f docker-compose-production.yml up -d
```

---

## Troubleshooting

### Issue: Cannot access dashboard
**Solutions**:
1. Check DNS: `nslookup agent.callbust.com` should return 192.241.179.25
2. Check firewall: `ufw status`
3. Check Traefik logs: `docker logs traefik`
4. Check frontend logs: `docker logs avr-app-frontend`

### Issue: Services not starting
**Solutions**:
1. Check logs: `docker-compose logs`
2. Check .env file: `cat /opt/avr/avr-infra/.env`
3. Check Docker: `docker ps -a`
4. Check network: `docker network ls`

### Issue: No audio in calls
**Solutions**:
1. Check RTP ports: `ufw status | grep 10000`
2. Check Asterisk logs: `docker logs avr-asterisk`
3. Check AVR Core logs: `docker logs avr-core`
4. Verify Deepgram API key in .env

### Issue: API errors
**Solutions**:
1. Check backend logs: `docker logs avr-app-backend`
2. Verify FRONTEND_URL in .env matches domain
3. Check CORS settings
4. Verify JWT_SECRET is set

---

## Security Recommendations

### 1. Change Default Credentials
```bash
# Edit .env file
nano /opt/avr/avr-infra/.env

# Change:
# ADMIN_USERNAME=your-username
# ADMIN_PASSWORD=strong-password
# JWT_SECRET=strong-random-secret
# WEBHOOK_SECRET=strong-random-secret
```

### 2. Restrict Traefik Dashboard
```bash
# Add IP restriction to traefik service
# Only allow access from your IP
ufw delete allow 8080/tcp
ufw allow from YOUR_IP to any port 8080
```

### 3. Enable HTTPS
- Set up Let's Encrypt or use Cloudflare
- Configure Traefik for SSL termination
- Force HTTPS redirect

### 4. Regular Updates
```bash
# Update system
apt-get update && apt-get upgrade -y

# Update Docker images
docker-compose -f docker-compose-production.yml pull
docker-compose -f docker-compose-production.yml up -d
```

---

## Monitoring

### Check Service Health
```bash
# All containers
docker ps

# Resource usage
docker stats

# Disk usage
df -h
docker system df
```

### Check Logs
```bash
# Real-time logs
docker-compose -f docker-compose-production.yml logs -f

# Last 100 lines
docker-compose -f docker-compose-production.yml logs --tail=100
```

---

## Backup

### Backup Configuration
```bash
# Backup .env
cp /opt/avr/avr-infra/.env /opt/avr/avr-infra/.env.backup

# Backup data
tar -czf avr-backup-$(date +%Y%m%d).tar.gz /opt/avr/avr-infra/data
```

### Restore
```bash
# Restore .env
cp /opt/avr/avr-infra/.env.backup /opt/avr/avr-infra/.env

# Restore data
tar -xzf avr-backup-YYYYMMDD.tar.gz -C /
```

---

## Support

- **Documentation**: https://github.com/agentvoiceresponse/avr-docs
- **Discord**: https://discord.gg/DFTU69Hg74
- **GitHub**: https://github.com/agentvoiceresponse

---

## Files Created

- `docker-compose-production.yml` - Production compose file with domain config
- `configure_production.sh` - Configuration script
- `deploy_production.bat` - Windows deployment script
- `PRODUCTION_DEPLOYMENT.md` - This guide

