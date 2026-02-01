# DSAI - Digital Storming AI Voice Platform

## Project Overview
DSAI is an AI-powered Voice Response/IVR system with BPO predictive dialer capabilities. It integrates with Asterisk PBX to handle inbound/outbound calls using AI-driven responses.

**Current Status (Jan 2026)**: Phases 1-4 COMPLETE - Full BPO Predictive Dialer with AI & Analytics

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
- **Charts**: Custom SVG with framer-motion (NOT Recharts)
- **Forms**: react-hook-form + zod validation
- **Location**: `dsai-app/frontend/`

### Voice/Telephony
- **PBX**: Asterisk 21 with PJSIP
- **Protocol**: AudioSocket for AI integration
- **Call Control**: AMI via dsai-ami service
- **WebRTC**: dsai-phone service
- **Location**: `dsai-core/`, `dsai-ami/`, `dsai-phone/`

### Infrastructure
- **Reverse Proxy**: Traefik v3.6
- **Container**: Docker with docker-compose
- **Server**: ai.digitalstorming.com

---

## Directory Structure

```
dsai-app/
  backend/src/
    agents/          # AI agent management
    calls/           # VAPI-style call API
    webhooks/        # Call events, SSE gateway, outgoing webhooks
    providers/       # AI service configs
    trunks/          # SIP trunk management
    numbers/         # Phone number routing
    recordings/      # Call recordings
    users/           # User management
    auth/            # JWT authentication
    campaigns/       # Campaign management
    leads/           # Lead management
    dispositions/    # Disposition codes
    dialer/          # Predictive dialer engine
    dnc/             # Do Not Call list management
    qa/              # QA scorecards and evaluations
    caller-id/       # Caller ID management
    crm/             # CRM integrations
    reports/         # Report builder
    ai-common/       # [Phase 4] LLM gateway, cost tracking
    analytics/       # [Phase 4] Speech analytics
    scoring/         # [Phase 4] Lead scoring
    coaching/        # [Phase 4] AI agent coaching
    sentiment/       # [Phase 4] Sentiment analysis
  frontend/app/(protected)/
    overview/        # Dashboard
    agents/          # Agent management
    calls/           # Call history
    campaigns/       # Campaign pages
    dispositions/    # Disposition management
    dnc/             # DNC management
    callbacks/       # Callback scheduling
    qa/              # QA scoring
    caller-id/       # Caller ID pools
    crm/             # CRM connections
    reports/         # Report builder
    webhooks/        # Outgoing webhooks
    analytics/       # [Phase 4] Speech analytics dashboard
    scoring/         # [Phase 4] Lead scoring dashboard
    coaching/        # [Phase 4] AI coaching dashboard
    sentiment/       # [Phase 4] Sentiment analysis dashboard

dsai-core/           # Voice processing engine
dsai-ami/            # Asterisk Manager Interface
dsai-phone/          # WebRTC softphone
dsai-infra/          # Docker compose configs (NOT used for deployment)
```

---

## Key Entities

### Core System
- **Agent**: AI voice agent config (mode, providers, trunk)
- **Call**: Call record (uuid, from/to, duration, cost, campaignId, leadId)
- **CallEvent**: Call lifecycle events (transcription, dtmf, etc.)
- **User**: Admin users with UserRole enum (SUPERADMIN, ADMIN, MANAGER, VIEWER)
- **Provider**: AI service configs (ASR, LLM, TTS, STS)
- **Trunk**: SIP trunks (inbound/outbound)
- **PhoneNumber**: DID routing
- **Recording**: Call recording metadata

### BPO Dialer (Phase 1)
- **Campaign**: Dialing campaign config
- **CampaignList**: Lead list within campaign
- **Lead**: Contact record with dial status
- **Disposition**: Call outcome codes

### Compliance (Phase 2)
- **DncEntry**: Do Not Call list entries
- **QaScorecard**: QA evaluation templates
- **QaEvaluation**: Call evaluations

### Integrations (Phase 3)
- **CallerIdPool**: Caller ID management
- **CrmConnection**: CRM integration configs
- **CrmFieldMapping**: Field mapping for CRM sync
- **ReportConfig**: Saved report definitions
- **OutgoingWebhook**: Webhook configurations
- **WebhookDeliveryLog**: Webhook delivery history

### AI & Analytics (Phase 4)
- **AiUsageLog**: LLM API usage tracking
- **CallAnalytics**: Speech metrics (talk ratio, silence, script adherence)
- **KeywordMatch**: Detected keywords in calls
- **LeadScore**: ML-based lead scores
- **ScoringModel**: Lead scoring model configs
- **AiEvaluation**: AI-powered call evaluations
- **CoachingInsight**: Agent performance insights
- **TrainingRecommendation**: Training suggestions
- **CallSentiment**: Overall call sentiment
- **UtteranceSentiment**: Per-utterance sentiment

---

## API Patterns

### Authentication
```typescript
// JWT Bearer token in Authorization header
// IMPORTANT: Use UserRole enum, NOT string literals
import { UserRole } from '../users/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)  // ✅ Correct
// @Roles('admin', 'manager')             // ❌ Wrong - causes TypeScript error
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

## Deployment Workflow

### Local Development
```bash
cd dsai-app/backend && npm run start:dev
cd dsai-app/frontend && npm run dev
```

### Production Deployment
```bash
# 1. Push to GitHub
git add -A
git commit -m "feat: description"
git push origin main

# 2. Deploy to cloud via plink
plink -ssh root@ai.digitalstorming.com -pw "Seahub123@" "cd /root/aivoiceplatform && git pull origin main && docker compose down && docker compose up -d --build"
```

### Server Details
- **Host**: ai.digitalstorming.com
- **User**: root
- **Password**: Seahub123@
- **Docker Compose**: `/root/aivoiceplatform/docker-compose.yml` (MAIN - has Traefik labels)
- **DO NOT USE**: `dsai-infra/docker-compose.yml` (lacks Traefik routing)

### Docker Services
```bash
# View running services
docker compose ps

# Restart specific service
docker compose restart dsai-backend

# View logs
docker compose logs -f dsai-backend

# All services: dsai-backend, dsai-frontend, dsai-core, dsai-ami, dsai-phone, traefik, asterisk
```

---

## Implementation Status

### Phase 1: MVP ✅ COMPLETE
- [x] Campaign CRUD
- [x] Lead/List CSV upload
- [x] Basic predictive dialing
- [x] Disposition management
- [x] Real-time dashboard

### Phase 2: Compliance & Quality ✅ COMPLETE
- [x] DNC list management
- [x] Time-of-day calling rules
- [x] AMD (Answering Machine Detection)
- [x] QA scoring
- [x] Callback scheduling

### Phase 3: Advanced Features ✅ COMPLETE
- [x] Local presence/caller ID management
- [x] CRM integrations
- [x] Advanced reporting (report builder)
- [x] Multi-tenant support
- [x] Outgoing webhooks

### Phase 4: AI & Analytics ✅ COMPLETE
- [x] Speech analytics (talk ratio, silence, keywords, script adherence)
- [x] Predictive lead scoring
- [x] AI agent coaching
- [x] Sentiment analysis

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Main module | `dsai-app/backend/src/app.module.ts` |
| User entity (UserRole enum) | `dsai-app/backend/src/users/user.entity.ts` |
| Agent service | `dsai-app/backend/src/agents/agents.service.ts` |
| Call entity | `dsai-app/backend/src/webhooks/call.entity.ts` |
| SSE gateway | `dsai-app/backend/src/webhooks/call-updates.gateway.ts` |
| Outgoing webhooks | `dsai-app/backend/src/webhooks/outgoing-webhook.service.ts` |
| LLM gateway | `dsai-app/backend/src/ai-common/services/llm-gateway.service.ts` |
| Cost tracker | `dsai-app/backend/src/ai-common/services/ai-cost-tracker.service.ts` |
| Analytics service | `dsai-app/backend/src/analytics/analytics.service.ts` |
| Coaching service | `dsai-app/backend/src/coaching/coaching.service.ts` |
| Sidebar nav | `dsai-app/frontend/components/layout/app-shell.tsx` |
| i18n English | `dsai-app/frontend/lib/i18n/en.ts` |
| i18n Italian | `dsai-app/frontend/lib/i18n/it.ts` |
| API client | `dsai-app/frontend/lib/api.ts` |

---

## Common Errors & Solutions

### @Roles TypeScript Error
```
Argument of type '"admin"' is not assignable to parameter of type 'UserRole'
```
**Solution**: Import UserRole enum and use `@Roles(UserRole.ADMIN)` instead of `@Roles('admin')`

### 'eval' Reserved Word
```
'eval' cannot be used as a variable name in strict mode
```
**Solution**: Rename variable to 'evaluation' or another name

### Zod .default() in Forms
```
Type error with react-hook-form defaultValues
```
**Solution**: Remove `.default()` from Zod schema, set defaults in useForm's defaultValues instead

### 408 Network Error / Services Not Accessible
**Cause**: Using wrong docker-compose file (dsai-infra/) that lacks Traefik labels
**Solution**: Always use `/root/aivoiceplatform/docker-compose.yml` for deployment

### 404 on API Endpoints
**Cause**: Frontend calling endpoint that doesn't exist in controller
**Solution**: Check controller has matching route, verify path matches exactly

### I.map is not a function
**Cause**: API returning error/404 instead of array
**Solution**: Fix backend endpoint, ensure array is returned

### parseFloat expects string
```typescript
// Error: Record values might not be strings
parseFloat(customWeights[key])

// Fix: Convert to string first
parseFloat(String(customWeights[key] ?? 1))
```

---

## Frontend Patterns

### Client Components
All pages use `'use client'` directive at top

### Charts
Custom SVG implementations with framer-motion animations (not Recharts library)

### API Calls
```typescript
import { apiFetch } from '@/lib/api';

const data = await apiFetch<ResponseType>('/endpoint');
const paged = await apiFetch<PagedResponse>('/endpoint?page=1&limit=10');
```

### Real-time SSE
```typescript
import { useCallUpdates } from '@/hooks/useCallUpdates';
// Provides live call events
```

### Navigation Groups in app-shell.tsx
```typescript
// Structure: navItems, navPhoneItems, navCampaignItems, navObserveItems, navAiItems
const navAiItems: NavItem[] = [
  { href: '/analytics', label: t.navigation.analytics, icon: BarChart3 },
  { href: '/scoring', label: t.navigation.scoring, icon: TrendingUp },
  { href: '/coaching', label: t.navigation.coaching, icon: GraduationCap },
  { href: '/sentiment', label: t.navigation.sentiment, icon: Heart },
];
```

---

## Rules
See `.claude/rules/` for detailed conventions:
- `backend.md` - NestJS patterns
- `frontend.md` - Next.js/React patterns
- `database.md` - TypeORM conventions
- `dialer.md` - Dialer business logic

---

## Recent Changes (Jan 2026)

1. **Phase 4 Backend**: Added ai-common, analytics, scoring, coaching, sentiment modules
2. **Phase 4 Frontend**: Added /analytics, /scoring, /coaching, /sentiment dashboard pages
3. **Navigation**: Added "AI & Analytics" section with 4 new pages
4. **i18n**: Added translations for all Phase 3 & 4 navigation items
5. **Fixed**: Multiple TypeScript errors (UserRole enum, reserved words, type casting)
6. **Fixed**: Coaching insights endpoint (404 → working)
7. **Deployed**: All services running on ai.digitalstorming.com
