# DSAI - Digital Storming AI Voice Platform

## Project Overview
DSAI is an AI-powered Voice Response/IVR system with BPO predictive dialer capabilities. It integrates with Asterisk PBX to handle inbound/outbound calls using AI-driven responses.

**Recent Update (Jan 2026)**: Adding BPO Predictive Dialer features (Phase 1 MVP)

---

## Tech Stack

### Backend
- **Framework**: NestJS 11.1.12
- **ORM**: TypeORM 0.3.28 with SQLite
- **Auth**: JWT + Passport
- **Location**: `dsai-app/backend/src/`

### Frontend
- **Framework**: Next.js 16.1.3 with React 19.2.3
- **UI**: shadcn/ui + TailwindCSS 4
- **State**: React Context + SSE for real-time
- **Location**: `dsai-app/frontend/`

### Voice/Telephony
- **PBX**: Asterisk 21 with PJSIP
- **Protocol**: AudioSocket for AI integration
- **Call Control**: AMI via dsai-ami service
- **Location**: `dsai-core/`, `dsai-ami/`

---

## Directory Structure

```
dsai-app/
  backend/src/
    agents/          # AI agent management
    calls/           # VAPI-style call API
    webhooks/        # Call events, SSE gateway
    providers/       # AI service configs
    trunks/          # SIP trunk management
    numbers/         # Phone number routing
    recordings/      # Call recordings
    users/           # User management
    auth/            # JWT authentication
    campaigns/       # [NEW] Campaign management
    leads/           # [NEW] Lead management
    dispositions/    # [NEW] Disposition codes
    dialer/          # [NEW] Predictive dialer engine
  frontend/app/(protected)/
    overview/        # Dashboard
    agents/          # Agent management
    calls/           # Call history
    campaigns/       # [NEW] Campaign pages
    dispositions/    # [NEW] Disposition management

dsai-core/           # Voice processing engine
dsai-ami/            # Asterisk Manager Interface
dsai-phone/          # WebRTC softphone
dsai-infra/          # Docker compose configs
```

---

## Key Entities

### Existing
- **Agent**: AI voice agent config (mode, providers, trunk)
- **Call**: Call record (uuid, from/to, duration, cost)
- **CallEvent**: Call lifecycle events (transcription, dtmf, etc.)
- **User**: Admin users (admin, manager, viewer roles)
- **Provider**: AI service configs (ASR, LLM, TTS, STS)
- **Trunk**: SIP trunks (inbound/outbound)
- **PhoneNumber**: DID routing
- **Recording**: Call recording metadata

### New (BPO Dialer)
- **Campaign**: Dialing campaign config
- **CampaignList**: Lead list within campaign
- **Lead**: Contact record with dial status
- **Disposition**: Call outcome codes

---

## API Patterns

### Authentication
```typescript
// JWT Bearer token in Authorization header
// Roles: admin, manager, viewer
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
```

### Pagination
```typescript
// Query params: page, limit
// Response: { data: T[], total, page, limit, totalPages }
```

### Real-time Updates
```typescript
// SSE endpoint: GET /webhooks/stream
// Events: call_created, call_updated, call_ended, agent_started, etc.
```

---

## Important Commands

### Development
```bash
cd dsai-app/backend && npm run start:dev
cd dsai-app/frontend && npm run dev
```

### Deployment
```bash
git push origin main
# Then via plink to ai.digitalstorming.com
```

---

## Current Implementation Status

### Phase 1 MVP (In Progress)
- [ ] Campaign CRUD
- [ ] Lead/List CSV upload
- [ ] Basic predictive dialing
- [ ] Disposition management
- [ ] Real-time dashboard

### Future Phases
- Phase 2: DNC, AMD, Callbacks, QA
- Phase 3: CRM integrations, Multi-tenant
- Phase 4: AI Analytics, Speech analysis

---

## Server Access
- **Host**: ai.digitalstorming.com
- **User**: root
- **Method**: plink SSH

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Main module | `dsai-app/backend/src/app.module.ts` |
| Agent service | `dsai-app/backend/src/agents/agents.service.ts` |
| Call entity | `dsai-app/backend/src/webhooks/call.entity.ts` |
| SSE gateway | `dsai-app/backend/src/webhooks/call-updates.gateway.ts` |
| Sidebar nav | `dsai-app/frontend/components/layout/app-shell.tsx` |
| i18n strings | `dsai-app/frontend/lib/i18n/en.ts` |

---

## Rules
See `.claude/rules/` for detailed conventions:
- `backend.md` - NestJS patterns
- `frontend.md` - Next.js/React patterns
- `database.md` - TypeORM conventions
- `dialer.md` - Dialer business logic
