# AVR Repositories Quick Reference

## Overview

This document provides a quick reference guide to all AVR (Agent Voice Response) repositories.

---

## Core Repositories

### 1. avr-infra
**Purpose**: Infrastructure orchestration and deployment  
**Tech**: Docker Compose  
**Key Files**: Multiple `docker-compose-*.yml` files  
**URL**: https://github.com/agentvoiceresponse/avr-infra

**What it does**:
- Orchestrates AVR Core, ASR, LLM, TTS, STS services
- Provides deployment templates for different provider combinations
- Manages Asterisk PBX configuration
- Supports 11+ provider configurations

---

### 2. avr-app
**Purpose**: Web-based administration panel  
**Tech**: NestJS (backend), Next.js 14 (frontend)  
**Key Components**: Backend API, Frontend UI, Docker management  
**URL**: https://github.com/agentvoiceresponse/avr-app

**What it does**:
- Manages agents, providers, phone numbers, trunks
- Provides web interface for configuration
- Handles Docker container orchestration
- Integrates with Asterisk via ARI
- User management with role-based access

**Structure**:
- `backend/`: NestJS API with SQLite database
- `frontend/`: Next.js 14 with Tailwind CSS

---

### 3. avr-sts-deepgram
**Purpose**: Deepgram Speech-to-Speech integration  
**Tech**: Node.js, WebSocket, Deepgram SDK  
**Key Files**: `index.js`, `loadTools.js`  
**URL**: https://github.com/agentvoiceresponse/avr-sts-deepgram

**What it does**:
- Provides WebSocket server for real-time audio streaming
- Integrates with Deepgram Agent API
- Handles ASR, LLM, and TTS in single service
- Supports custom tools (hangup, transfer, etc.)

**Port**: 6033 (default)

---

## Supporting Repositories

### 4. avr-ami
**Purpose**: Asterisk Manager Interface wrapper  
**Tech**: Node.js, Express, asterisk-manager  
**Key Files**: `index.js`, `utils.js`  
**URL**: https://github.com/agentvoiceresponse/avr-ami

**What it does**:
- Provides REST API for call control
- Wraps Asterisk Manager Interface
- Enables programmatic call management (hangup, transfer, originate)
- Tracks calls by UUID

**Endpoints**:
- `POST /hangup` - Hang up call
- `POST /transfer` - Transfer call
- `POST /originate` - Make outbound call
- `POST /variables` - Get call variables

**Port**: 6006 (default)

---

### 5. avr-webhook
**Purpose**: Webhook event processing service  
**Tech**: Node.js, Express  
**Key Files**: `index.js`  
**URL**: https://github.com/agentvoiceresponse/avr-webhook

**What it does**:
- Receives webhook events from AVR Core
- Processes and logs events
- Provides security (rate limiting, secret verification)
- Handles call lifecycle events

**Endpoints**:
- `GET /health` - Health check
- `POST /events` - Webhook event receiver

**Port**: 3000 (default)

**Event Types**:
- `call_started`, `call_ended`
- `transcription`, `interruption`
- `dtmf_digit`, `error`

---

### 6. avr-phone
**Purpose**: Browser-based WebRTC SIP phone  
**Tech**: JavaScript, SIP.js, WebRTC  
**Key Files**: `phone.js`, `index.html`  
**URL**: https://github.com/agentvoiceresponse/avr-phone

**What it does**:
- Provides softphone interface in browser
- WebRTC-based SIP communication
- Multi-language support (12 languages)
- Light/dark themes
- PWA support

**Features**:
- Make/receive calls
- Hold/resume, transfer, conference
- Voicemail, call history
- Presence (BLF)

**Deployment**: Static files served via nginx

---

### 7. avr-asterisk
**Purpose**: Docker image for Asterisk PBX  
**Tech**: Docker, Asterisk 23.1.0  
**Key Files**: `Dockerfile`  
**URL**: https://github.com/agentvoiceresponse/avr-asterisk

**What it does**:
- Pre-configured Asterisk 23.1.0 image
- Optimized for VoIP applications
- Includes PJSIP, AMI, ARI, Prometheus
- Minimal footprint

**Ports**:
- 5038: AMI
- 8088: ARI
- 10000-20000: RTP

---

### 8. avr-vad
**Purpose**: Voice Activity Detection library  
**Tech**: TypeScript, ONNX Runtime, Silero VAD  
**Key Files**: `src/real-time-vad.ts`, `src/common/`  
**URL**: https://github.com/agentvoiceresponse/avr-vad  
**NPM**: https://www.npmjs.com/package/avr-vad

**What it does**:
- Real-time and batch VAD processing
- Uses Silero VAD models (v5 and legacy)
- Detects speech/silence in audio streams
- Used by AVR Core for barge-in detection

**Usage**:
```typescript
import { RealTimeVAD } from 'avr-vad';
const vad = await RealTimeVAD.new({ model: 'v5' });
const result = await vad.processFrame(audioFrame);
```

**Models**: Bundled ONNX models (no external downloads)

---

### 9. avr-docs
**Purpose**: Comprehensive documentation  
**Tech**: Markdown  
**Key Files**: Various `.md` files  
**URL**: https://github.com/agentvoiceresponse/avr-docs

**What it contains**:
- Architecture documentation
- Provider integration guides
- Deployment tutorials
- Troubleshooting guides
- API references

**Key Documents**:
- `how-avr-works.md`
- `understanding-avr-core.md`
- `avr-sts-integration-implementation.md`
- `webhook-integration-guide.md`

---

## Repository Relationships

```
avr-infra (orchestration)
    ├── avr-core (not in this repo, but orchestrated)
    ├── avr-asterisk (Asterisk PBX)
    ├── avr-ami (call control)
    ├── avr-webhook (event processing)
    └── avr-sts-deepgram (STS service)

avr-app (management)
    ├── backend (NestJS API)
    └── frontend (Next.js UI)

avr-phone (client)
    └── Browser-based softphone

avr-vad (library)
    └── Used by avr-core internally

avr-docs (documentation)
    └── Guides and references
```

---

## Quick Start Commands

### Clone All Repositories
```bash
git clone https://github.com/agentvoiceresponse/avr-infra.git
git clone https://github.com/agentvoiceresponse/avr-app.git
git clone https://github.com/agentvoiceresponse/avr-sts-deepgram.git
git clone https://github.com/agentvoiceresponse/avr-ami.git
git clone https://github.com/agentvoiceresponse/avr-webhook.git
git clone https://github.com/agentvoiceresponse/avr-phone.git
git clone https://github.com/agentvoiceresponse/avr-asterisk.git
git clone https://github.com/agentvoiceresponse/avr-vad.git
git clone https://github.com/agentvoiceresponse/avr-docs.git
```

### Deploy Infrastructure
```bash
cd avr-infra
docker-compose -f docker-compose-deepgram.yml up -d
```

### Deploy Application
```bash
cd avr-app
docker-compose -f docker-compose-app.yml up -d
```

---

## Port Reference

| Service | Default Port | Purpose |
|---------|-------------|---------|
| avr-core | 5001 | AudioSocket |
| avr-ami | 6006 | AMI API |
| avr-webhook | 3000 | Webhook receiver |
| avr-sts-deepgram | 6033 | STS WebSocket |
| avr-app-backend | 3001 | Admin API |
| avr-app-frontend | 3000 | Admin UI |
| Asterisk AMI | 5038 | Manager Interface |
| Asterisk ARI | 8088 | REST Interface |
| Asterisk SIP | 5060 | SIP signaling |
| Asterisk RTP | 10000-20000 | Media streaming |

---

## Technology Stack Summary

| Repository | Primary Tech | Database | Key Dependencies |
|------------|--------------|----------|------------------|
| avr-infra | Docker Compose | - | - |
| avr-app (backend) | NestJS, TypeORM | SQLite | dockerode, ari-client |
| avr-app (frontend) | Next.js 14 | - | Tailwind CSS, shadcn/ui |
| avr-sts-deepgram | Node.js | - | @deepgram/sdk, ws |
| avr-ami | Node.js, Express | - | asterisk-manager |
| avr-webhook | Node.js, Express | - | helmet, cors, rate-limit |
| avr-phone | JavaScript | localStorage | SIP.js |
| avr-asterisk | Docker | - | Asterisk 23.1.0 |
| avr-vad | TypeScript | - | onnxruntime-node |

---

## Key Environment Variables

### AVR Core
- `ASR_URL`, `LLM_URL`, `TTS_URL` (pipeline mode)
- `STS_URL` (STS mode)
- `WEBHOOK_URL`, `WEBHOOK_SECRET`
- `INTERRUPT_LISTENING` (VAD control)
- `VAD_*` (VAD configuration)

### AVR AMI
- `AMI_HOST`, `AMI_PORT`, `AMI_USERNAME`, `AMI_PASSWORD`

### AVR Webhook
- `PORT`, `WEBHOOK_SECRET`, `RATE_LIMIT_MAX`

### AVR STS Deepgram
- `DEEPGRAM_API_KEY`, `AGENT_PROMPT`
- `PORT`, `DEEPGRAM_SAMPLE_RATE`
- `DEEPGRAM_ASR_MODEL`, `DEEPGRAM_TTS_MODEL`
- `OPENAI_MODEL`, `AMI_URL`

---

## Integration Points

1. **Asterisk → AVR Core**: AudioSocket protocol
2. **AVR Core → ASR/LLM/TTS**: HTTP streaming
3. **AVR Core → STS**: WebSocket
4. **AVR Core → Webhook**: HTTP POST
5. **Tools → AMI**: HTTP POST
6. **AMI → Asterisk**: AMI protocol
7. **Phone → Asterisk**: WebRTC/SIP

---

## Documentation Links

- **Main Wiki**: https://wiki.agentvoiceresponse.com/en/home
- **GitHub Org**: https://github.com/agentvoiceresponse
- **Docker Hub**: https://hub.docker.com/u/agentvoiceresponse
- **NPM**: https://www.npmjs.com/~agentvoiceresponse
- **Discord**: https://discord.gg/DFTU69Hg74

---

## Support

For issues, questions, or contributions:
- Open issues on respective GitHub repositories
- Join Discord community
- Check documentation in avr-docs repository
- Review wiki for detailed guides

