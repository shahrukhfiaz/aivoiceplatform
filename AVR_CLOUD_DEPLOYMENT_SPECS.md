# AVR Cloud Server Deployment Specifications

## Overview

This document provides detailed server specifications for deploying AVR (Agent Voice Response) on cloud infrastructure. Requirements vary based on deployment mode, concurrent calls, and whether you're using cloud-based or local AI providers.

---

## Deployment Scenarios

### Scenario 1: Minimal Setup (Development/Testing)
**Use Case**: Single agent, 1-2 concurrent calls, cloud-based AI providers

### Scenario 2: Small Production
**Use Case**: 1-5 agents, 5-10 concurrent calls, cloud-based AI providers

### Scenario 3: Medium Production
**Use Case**: 5-20 agents, 10-50 concurrent calls, mixed providers

### Scenario 4: Large Production
**Use Case**: 20+ agents, 50+ concurrent calls, high availability

---

## Server Specifications by Scenario

### Scenario 1: Minimal Setup (Development/Testing)

#### Minimum Requirements
- **CPU**: 2 vCPUs (2 cores)
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **Network**: 100 Mbps (1 Gbps recommended)
- **OS**: Ubuntu 22.04 LTS or later

#### Recommended
- **CPU**: 4 vCPUs (4 cores)
- **RAM**: 8 GB
- **Storage**: 40 GB SSD
- **Network**: 1 Gbps

#### Components Running
- AVR Core (1 instance)
- Asterisk PBX
- AVR AMI
- STS Service (or ASR/LLM/TTS)
- Optional: AVR App (backend + frontend)

#### Estimated Resource Usage
- **CPU**: 30-50% under load
- **RAM**: 3-4 GB
- **Storage**: 10-15 GB (Docker images + data)

---

### Scenario 2: Small Production

#### Minimum Requirements
- **CPU**: 4 vCPUs (4 cores)
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 1 Gbps
- **OS**: Ubuntu 22.04 LTS or later

#### Recommended
- **CPU**: 8 vCPUs (8 cores)
- **RAM**: 16 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps (10 Gbps for high traffic)

#### Components Running
- AVR Core (1-2 instances)
- Asterisk PBX
- AVR AMI
- STS Service (or ASR/LLM/TTS)
- AVR App (backend + frontend)
- Optional: Traefik (reverse proxy)

#### Estimated Resource Usage
- **CPU**: 40-70% under load
- **RAM**: 6-12 GB
- **Storage**: 20-30 GB

#### Concurrent Calls Support
- **5-10 concurrent calls** comfortably
- **15-20 calls** at peak (may experience latency)

---

### Scenario 3: Medium Production

#### Minimum Requirements
- **CPU**: 8 vCPUs (8 cores)
- **RAM**: 16 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps (10 Gbps recommended)
- **OS**: Ubuntu 22.04 LTS or later

#### Recommended
- **CPU**: 16 vCPUs (16 cores)
- **RAM**: 32 GB
- **Storage**: 200 GB SSD (or NVMe)
- **Network**: 10 Gbps
- **OS**: Ubuntu 22.04 LTS or later

#### Components Running
- AVR Core (2-5 instances, load balanced)
- Asterisk PBX (or cluster)
- AVR AMI
- Multiple STS/ASR/LLM/TTS services
- AVR App (backend + frontend)
- Traefik (reverse proxy)
- Optional: Monitoring (Prometheus, Grafana)

#### Estimated Resource Usage
- **CPU**: 50-80% under load
- **RAM**: 20-28 GB
- **Storage**: 50-100 GB

#### Concurrent Calls Support
- **10-50 concurrent calls** comfortably
- **50-75 calls** at peak

---

### Scenario 4: Large Production

#### Minimum Requirements
- **CPU**: 16 vCPUs (16 cores)
- **RAM**: 32 GB
- **Storage**: 200 GB SSD (NVMe recommended)
- **Network**: 10 Gbps
- **OS**: Ubuntu 22.04 LTS or later

#### Recommended
- **CPU**: 32+ vCPUs (32+ cores)
- **RAM**: 64+ GB
- **Storage**: 500 GB+ NVMe SSD
- **Network**: 10 Gbps+
- **OS**: Ubuntu 22.04 LTS or later

#### Architecture
- **Multiple servers** (horizontal scaling)
- **Load balancer** for AVR Core instances
- **Asterisk cluster** or dedicated PBX server
- **Separate services** on different servers
- **Database server** (if using PostgreSQL/MySQL instead of SQLite)
- **Monitoring and logging** infrastructure

#### Estimated Resource Usage (Per Server)
- **CPU**: 60-90% under load
- **RAM**: 40-60 GB
- **Storage**: 100-200 GB per server

#### Concurrent Calls Support
- **50+ concurrent calls** per server
- **100+ calls** with proper load balancing

---

## Detailed Component Requirements

### AVR Core
**Resource Usage per Instance:**
- **CPU**: 0.5-1.5 cores per concurrent call
- **RAM**: 200-500 MB base + 50-100 MB per call
- **Network**: ~64 kbps per call (bidirectional)

**Notes:**
- Audio transcoding is CPU-intensive
- VAD processing adds CPU overhead
- Real-time streaming requires low latency

### Asterisk PBX
**Resource Usage:**
- **CPU**: 0.2-0.5 cores per concurrent call
- **RAM**: 200-300 MB base + 20-50 MB per call
- **Network**: ~64 kbps per call (RTP media)
- **UDP Ports**: 10000-20000 (or more) for RTP

**Notes:**
- RTP media handling is CPU-intensive
- Codec transcoding adds overhead
- Requires stable network for RTP

### AVR AMI
**Resource Usage:**
- **CPU**: Minimal (< 0.1 cores)
- **RAM**: 50-100 MB
- **Network**: Minimal (AMI protocol)

### STS Services (Deepgram, OpenAI, etc.)
**Resource Usage:**
- **CPU**: 0.1-0.3 cores per concurrent call
- **RAM**: 100-200 MB base + 30-50 MB per call
- **Network**: ~64 kbps per call + API overhead

**Notes:**
- Most processing happens in cloud (API calls)
- Local service is lightweight WebSocket proxy

### AVR App (Backend)
**Resource Usage:**
- **CPU**: 0.5-1 core
- **RAM**: 300-500 MB
- **Storage**: 1-5 GB (SQLite database + recordings)

**Notes:**
- SQLite suitable for small-medium deployments
- Consider PostgreSQL/MySQL for large deployments

### AVR App (Frontend)
**Resource Usage:**
- **CPU**: Minimal (< 0.1 cores)
- **RAM**: 50-100 MB
- **Storage**: Minimal (static files)

---

## Storage Requirements

### Base Storage (Docker Images)
- **Total Docker Images**: ~2-3 GB
  - avr-core: ~500 MB
  - avr-asterisk: ~400 MB
  - avr-sts-*: ~200-300 MB each
  - avr-app-backend: ~300 MB
  - avr-app-frontend: ~200 MB
  - avr-ami: ~100 MB
  - Base images: ~500 MB

### Runtime Storage
- **Docker volumes**: 5-10 GB
- **Logs**: 1-5 GB (depending on retention)
- **Recordings**: Variable
  - ~1 MB per minute of recording
  - 100 hours = ~6 GB
  - 1000 hours = ~60 GB

### Database Storage
- **SQLite**: 10-100 MB (small deployments)
- **PostgreSQL/MySQL**: 1-10 GB (large deployments)

### Total Storage Recommendations
- **Minimal**: 20 GB
- **Small Production**: 50-100 GB
- **Medium Production**: 100-200 GB
- **Large Production**: 200-500 GB+

---

## Network Requirements

### Bandwidth Calculation

**Per Concurrent Call:**
- **Audio Stream**: ~64 kbps (bidirectional) = 128 kbps total
- **SIP Signaling**: ~1-5 kbps
- **WebSocket (STS)**: ~64 kbps
- **HTTP API**: ~1-10 kbps
- **Total per call**: ~150-200 kbps

**Example Calculations:**
- 10 concurrent calls: ~2 Mbps
- 50 concurrent calls: ~10 Mbps
- 100 concurrent calls: ~20 Mbps

### Network Quality Requirements
- **Latency**: < 50ms to AI providers (for cloud-based)
- **Jitter**: < 20ms
- **Packet Loss**: < 0.1%
- **UDP Support**: Required for RTP media

### Port Requirements

**Required Ports:**
- **TCP 5001**: AVR Core (AudioSocket)
- **TCP 5038**: Asterisk AMI
- **TCP 5060**: SIP (if exposed)
- **TCP 8088**: Asterisk ARI
- **TCP 3001**: AVR App Backend
- **TCP 3000**: AVR App Frontend
- **TCP 6006**: AVR AMI
- **TCP 6033+**: STS Services (various ports)
- **UDP 10000-20000**: RTP Media (or more)

**Firewall Rules:**
- Allow inbound TCP on web ports (80, 443, 3000, 3001)
- Allow inbound UDP on RTP range (10000-20000)
- Allow outbound HTTPS (443) for AI provider APIs
- Restrict AMI/ARI ports to internal network

---

## Operating System Requirements

### Recommended OS
- **Ubuntu 22.04 LTS** (recommended)
- **Ubuntu 20.04 LTS** (supported)
- **Debian 11/12** (supported)
- **CentOS Stream 9** (supported)

### Required Software
- **Docker**: 20.10 or later
- **Docker Compose**: 2.0 or later
- **Git**: Latest
- **curl/wget**: For downloads

### System Configuration

#### Kernel Parameters
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Network optimizations
echo "net.core.rmem_max = 16777216" >> /etc/sysctl.conf
echo "net.core.wmem_max = 16777216" >> /etc/sysctl.conf
echo "net.ipv4.udp_mem = 8388608 12582912 16777216" >> /etc/sysctl.conf
```

#### Docker Configuration
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    }
  }
}
```

---

## Cloud Provider Recommendations

### AWS (Amazon Web Services)

#### Scenario 1: Minimal
- **Instance Type**: t3.medium (2 vCPU, 4 GB RAM)
- **Storage**: gp3 20 GB
- **Estimated Cost**: $30-40/month

#### Scenario 2: Small Production
- **Instance Type**: t3.large (2 vCPU, 8 GB RAM) or t3.xlarge (4 vCPU, 16 GB RAM)
- **Storage**: gp3 50-100 GB
- **Estimated Cost**: $60-120/month

#### Scenario 3: Medium Production
- **Instance Type**: m5.xlarge (4 vCPU, 16 GB RAM) or m5.2xlarge (8 vCPU, 32 GB RAM)
- **Storage**: gp3 100-200 GB
- **Estimated Cost**: $150-300/month

#### Scenario 4: Large Production
- **Instance Type**: m5.4xlarge (16 vCPU, 64 GB RAM) or larger
- **Storage**: gp3 200-500 GB
- **Load Balancer**: Application Load Balancer
- **Estimated Cost**: $500-1000+/month

### Google Cloud Platform (GCP)

#### Scenario 1: Minimal
- **Instance Type**: e2-medium (2 vCPU, 4 GB RAM)
- **Storage**: pd-standard 20 GB
- **Estimated Cost**: $25-35/month

#### Scenario 2: Small Production
- **Instance Type**: e2-standard-2 (2 vCPU, 8 GB RAM) or e2-standard-4 (4 vCPU, 16 GB RAM)
- **Storage**: pd-standard 50-100 GB
- **Estimated Cost**: $50-100/month

#### Scenario 3: Medium Production
- **Instance Type**: e2-standard-8 (8 vCPU, 32 GB RAM)
- **Storage**: pd-ssd 100-200 GB
- **Estimated Cost**: $200-400/month

### DigitalOcean

#### Scenario 1: Minimal
- **Droplet**: 4 GB RAM, 2 vCPU
- **Storage**: 80 GB SSD
- **Estimated Cost**: $24/month

#### Scenario 2: Small Production
- **Droplet**: 8 GB RAM, 4 vCPU
- **Storage**: 160 GB SSD
- **Estimated Cost**: $48/month

#### Scenario 3: Medium Production
- **Droplet**: 16 GB RAM, 8 vCPU
- **Storage**: 320 GB SSD
- **Estimated Cost**: $96/month

### Hetzner Cloud

#### Scenario 1: Minimal
- **Instance**: CPX11 (2 vCPU, 4 GB RAM)
- **Storage**: 40 GB NVMe
- **Estimated Cost**: €4-5/month

#### Scenario 2: Small Production
- **Instance**: CPX21 (3 vCPU, 8 GB RAM)
- **Storage**: 80 GB NVMe
- **Estimated Cost**: €8-10/month

#### Scenario 3: Medium Production
- **Instance**: CPX31 (4 vCPU, 16 GB RAM)
- **Storage**: 160 GB NVMe
- **Estimated Cost**: €16-20/month

---

## Performance Optimization Tips

### 1. CPU Optimization
- Use **STS mode** instead of ASR+LLM+TTS for lower latency
- Enable **VAD** for better turn-taking (reduces unnecessary processing)
- Use **cloud-based AI providers** to offload processing
- Consider **dedicated CPU** instances for production

### 2. Memory Optimization
- Limit Docker container memory limits
- Use **SQLite** for small deployments (lower memory footprint)
- Monitor and clean up old recordings
- Enable Docker log rotation

### 3. Network Optimization
- Use **same region** as AI providers for lower latency
- Enable **TCP BBR** congestion control
- Use **dedicated network** for RTP traffic
- Consider **CDN** for static assets (phone client)

### 4. Storage Optimization
- Use **SSD/NVMe** for database and recordings
- Implement **recording retention** policies
- Use **Docker image cleanup** regularly
- Monitor disk usage and set up alerts

---

## Monitoring and Scaling

### Key Metrics to Monitor
- **CPU Usage**: Should stay below 80%
- **Memory Usage**: Should stay below 85%
- **Network Bandwidth**: Monitor for bottlenecks
- **Active Calls**: Track concurrent call count
- **Response Times**: AVR Core → AI providers
- **Error Rates**: Failed calls, API errors

### Scaling Strategies

#### Vertical Scaling (Scale Up)
- Increase CPU/RAM on existing server
- Suitable for: Small-medium deployments
- Limit: Single server capacity

#### Horizontal Scaling (Scale Out)
- Add more servers with load balancer
- Multiple AVR Core instances
- Separate Asterisk server
- Suitable for: Large deployments

### Auto-Scaling Considerations
- **CPU-based**: Scale when CPU > 70%
- **Call-based**: Scale when concurrent calls > threshold
- **Time-based**: Scale during peak hours

---

## Security Considerations

### Firewall Rules
- **Restrict AMI/ARI ports** to internal network only
- **Use VPN** for administrative access
- **Enable fail2ban** for SSH protection
- **Use HTTPS** for web interfaces

### Docker Security
- **Run containers as non-root** users
- **Use Docker secrets** for API keys
- **Keep images updated** regularly
- **Scan images** for vulnerabilities

### Network Security
- **Use private networks** for inter-container communication
- **Enable TLS** for all external connections
- **Use VPN** for remote access
- **Implement rate limiting** on APIs

---

## Backup and Disaster Recovery

### Backup Requirements
- **Configuration files**: Daily
- **Database**: Hourly (if using SQLite, copy file)
- **Recordings**: Based on retention policy
- **Docker volumes**: Weekly

### Disaster Recovery
- **RTO (Recovery Time Objective)**: 1-4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Backup Storage**: Separate from production
- **Test Restores**: Monthly

---

## Cost Optimization

### Tips to Reduce Costs
1. **Use reserved instances** (AWS/GCP) for 1-year commitments
2. **Right-size instances** based on actual usage
3. **Use spot instances** for non-critical workloads
4. **Implement auto-scaling** to scale down during off-hours
5. **Use object storage** (S3, GCS) for recordings
6. **Monitor and optimize** AI provider API usage

### Estimated Monthly Costs (Including AI APIs)

#### Scenario 1: Minimal
- **Server**: $25-40/month
- **AI APIs**: $50-200/month (depending on usage)
- **Total**: $75-240/month

#### Scenario 2: Small Production
- **Server**: $50-120/month
- **AI APIs**: $200-1000/month
- **Total**: $250-1120/month

#### Scenario 3: Medium Production
- **Server**: $150-400/month
- **AI APIs**: $1000-5000/month
- **Total**: $1150-5400/month

---

## Quick Start Checklist

### Pre-Deployment
- [ ] Choose cloud provider and region
- [ ] Select instance type based on scenario
- [ ] Set up firewall rules
- [ ] Configure DNS (if needed)
- [ ] Prepare API keys for AI providers

### Deployment
- [ ] Install Docker and Docker Compose
- [ ] Clone avr-infra repository
- [ ] Configure .env file with API keys
- [ ] Start services with docker-compose
- [ ] Verify all containers are running
- [ ] Test with SIP client

### Post-Deployment
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Set up log rotation
- [ ] Test failover (if applicable)
- [ ] Document configuration

---

## Support and Resources

- **Documentation**: https://github.com/agentvoiceresponse/avr-docs
- **Discord Community**: https://discord.gg/DFTU69Hg74
- **GitHub Issues**: https://github.com/agentvoiceresponse
- **Wiki**: https://wiki.agentvoiceresponse.com/en/home

---

## Summary Table

| Scenario | vCPU | RAM | Storage | Network | Concurrent Calls | Est. Cost/Month |
|----------|------|-----|---------|---------|------------------|-----------------|
| Minimal | 2-4 | 4-8 GB | 20-40 GB | 100 Mbps | 1-5 | $25-40 |
| Small | 4-8 | 8-16 GB | 50-100 GB | 1 Gbps | 5-20 | $50-120 |
| Medium | 8-16 | 16-32 GB | 100-200 GB | 1-10 Gbps | 20-75 | $150-400 |
| Large | 16+ | 32+ GB | 200+ GB | 10 Gbps+ | 75+ | $500+ |

**Note**: Costs exclude AI provider API usage, which can be significant depending on call volume.

