# AVR (Agent Voice Response) Architecture Analysis

## Overview

AVR is an open-source platform that transforms traditional Interactive Voice Response (IVR) systems into AI-powered voice agents. It uses Asterisk's AudioSocket to handle real-time voice input and supports modular AI subsystems.

## Repository Structure

The AVR ecosystem consists of multiple repositories:

### Core Repositories:
1. **avr-infra** - Infrastructure orchestration and deployment
2. **avr-app** - Web-based administration panel (backend + frontend)
3. **avr-sts-deepgram** - Deepgram Speech-to-Speech integration service

### Supporting Repositories:
4. **avr-ami** - Asterisk Manager Interface wrapper for call control
5. **avr-webhook** - Webhook event processing service
6. **avr-phone** - WebRTC SIP phone client (browser-based)
7. **avr-asterisk** - Docker image for Asterisk PBX
8. **avr-vad** - Voice Activity Detection library (Silero VAD)
9. **avr-docs** - Comprehensive documentation repository

---

## 1. AVR Infrastructure (avr-infra)

### Purpose
The infrastructure layer orchestrates all AVR components using Docker Compose. It provides templates for different provider combinations and manages the deployment of services.

### Key Components

#### Services Orchestrated:
- **AVR Core**: Manages interaction between customer and VoIP PBX (Asterisk), processes audio streams, and integrates with ASR, LLM, and TTS services
- **ASR Services**: Convert voice to text (e.g., Deepgram, Google Cloud Speech-to-Text)
- **LLM Services**: Handle conversation logic and responses (e.g., OpenAI, Anthropic, OpenRouter)
- **TTS Services**: Convert text to speech (e.g., Deepgram, Google Cloud TTS, ElevenLabs)
- **STS Services**: Speech-to-Speech (end-to-end voice processing)
- **Asterisk PBX**: VoIP telephony server
- **AVR AMI**: Asterisk Manager Interface wrapper

### Architecture Flow

```
Asterisk PBX → AVR Core → [ASR → LLM → TTS] OR [STS]
```

### Deployment Modes

#### 1. Headless Deployments (No GUI)
Multiple docker-compose files for different provider combinations:
- `docker-compose-deepgram.yml` - Deepgram STS
- `docker-compose-openai.yml` - OpenAI LLM + Deepgram ASR/TTS
- `docker-compose-anthropic.yml` - Anthropic LLM + Deepgram ASR/TTS
- `docker-compose-elevenlabs.yml` - ElevenLabs STS
- `docker-compose-openai-realtime.yml` - OpenAI Realtime STS
- `docker-compose-ultravox.yml` - Ultravox STS
- `docker-compose-gemini.yml` - Google Gemini STS
- `docker-compose-humeai.yml` - HumeAI STS
- `docker-compose-vosk.yml` - Vosk (open-source ASR)
- `docker-compose-google.yml` - Google ASR/TTS
- `docker-compose-n8n.yml` - N8N workflow automation

#### 2. Full Deployment (with Web Interface)
- `docker-compose-app.yml` - Includes web application and database

### Key Environment Variables

**For Pipeline Mode (ASR + LLM + TTS):**
- `ASR_URL`: URL for ASR service (e.g., `http://avr-asr-deepgram:6000/speech-to-text-stream`)
- `LLM_URL`: URL for LLM service (e.g., `http://avr-llm-openai:6001/prompt-stream`)
- `TTS_URL`: URL for TTS service (e.g., `http://avr-tts-deepgram:6002/text-to-speech-stream`)

**For STS Mode (Speech-to-Speech):**
- `STS_URL`: WebSocket URL for STS service (e.g., `ws://avr-sts-deepgram:6033`)

### Network Configuration
- Default network: `avr` (bridge network)
- Subnet: `172.20.0.0/24`
- Services communicate via Docker network DNS names

### Asterisk Configuration
- SIP Port: 5060 (TCP)
- Manager Port: 5038
- ARI Port: 8088
- RTP Ports: 10000-10050 (UDP)
- Default test user: `1000/1000` (username/password)

---

## 2. AVR Application (avr-app)

### Purpose
Web-based administration panel for managing voice agents, providers, phone numbers, trunks, and monitoring calls.

### Architecture

#### Backend (`backend/`)
- **Framework**: NestJS (TypeScript)
- **Database**: SQLite (TypeORM) - stored in `./data/data.db`
- **Authentication**: JWT-based with role-based access control
- **Docker Integration**: Manages agent containers via Docker API
- **Asterisk Integration**: Provisions extensions, phones, and trunks via ARI

#### Frontend (`frontend/`)
- **Framework**: Next.js 14
- **UI**: Tailwind CSS + shadcn/ui components
- **Features**: Light/dark mode, internationalization (i18n)

### Key Modules

#### 1. Agents Module
- **Entity**: `Agent` with modes (PIPELINE, STS) and status (RUNNING, STOPPED)
- **Service**: Manages agent lifecycle, container orchestration, provider assignment
- **Features**:
  - Create/update/delete agents
  - Assign providers (ASR, LLM, TTS, or STS)
  - Start/stop agent containers
  - Dynamic port assignment (5000+ for core, 6000+ for providers, 7000+ for HTTP)

#### 2. Providers Module
- **Entity**: `Provider` with types (ASR, LLM, TTS, STS)
- **Configuration**: JSON-based config with Docker image and environment variables
- **Features**: Manage provider credentials and settings

#### 3. Docker Module
- **Service**: `DockerService` - Wraps Dockerode for container management
- **Features**:
  - Pull images
  - Create/start/stop containers
  - Manage container networks
  - Fetch container logs
  - Volume mounting (for tools)

#### 4. Asterisk Module
- **Service**: `AsteriskService` - Manages Asterisk configuration via ARI
- **Features**:
  - Provision phone extensions
  - Configure PJSIP endpoints
  - Manage trunks
  - Dynamic configuration file updates

#### 5. Other Modules
- **Users**: User management with roles (ADMIN, MANAGER, VIEWER)
- **Phones**: WebRTC phone configuration
- **Numbers**: Phone number management (agent, internal, transfer)
- **Trunks**: SIP trunk configuration
- **Webhooks**: Call event tracking
- **Recordings**: Call recording management

### Agent Container Orchestration

When an agent is started (`runAgent`):

1. **Provider Containers**: For each provider (ASR, LLM, TTS, or STS):
   - Container name: `avr-{type}-{agentId}`
   - Random port: 6000-6999
   - Environment variables from provider config
   - Tools volume mounted from `TOOLS_DIR`

2. **Core Container**: 
   - Container name: `avr-core-{agentId}`
   - Port: Agent's assigned port (5000+)
   - HTTP Port: Agent's assigned httpPort (7000+)
   - Environment: Provider URLs, webhook config, agent info

3. **Network**: All containers join `avr` network

### Database Schema

**Agent Entity:**
- `id`: UUID (primary key)
- `name`: string
- `status`: AgentStatus (running/stopped)
- `port`: integer (AudioSocket port)
- `httpPort`: integer (HTTP API port)
- `mode`: AgentMode (pipeline/sts)
- `providerAsr`: Provider (nullable)
- `providerLlm`: Provider (nullable)
- `providerTts`: Provider (nullable)
- `providerSts`: Provider (nullable)

**Provider Entity:**
- `id`: UUID (primary key)
- `type`: ProviderType (ASR/LLM/TTS/STS)
- `name`: string (unique)
- `config`: JSON (Docker image, env vars, etc.)

---

## 3. Deepgram STS (avr-sts-deepgram)

### Purpose
Provides Speech-to-Speech (STS) integration using Deepgram's Agent API. Handles real-time audio streaming between clients and Deepgram's API.

### Architecture

#### Core Components

1. **WebSocket Server**: Listens on port 6033 (configurable)
2. **Deepgram Agent Client**: Uses `@deepgram/sdk` for Agent API
3. **Tool System**: Loads custom tools from `avr_tools/` and `tools/` directories

### Communication Protocol

#### Client → Server Messages:
```json
// Initialize session
{"type": "init", "uuid": "session-uuid"}

// Stream audio
{"type": "audio", "audio": "base64_encoded_audio"}
```

#### Server → Client Messages:
```json
// Audio response
{"type": "audio", "audio": "base64_encoded_audio"}

// Transcript
{"type": "transcript", "role": "user|agent", "text": "transcribed text"}

// Interruption
{"type": "interruption"}

// Error
{"type": "error", "message": "error message"}
```

### Deepgram Agent Configuration

```javascript
{
  audio: {
    input: {
      encoding: "linear16",
      sample_rate: 8000  // Default, configurable
    },
    output: {
      encoding: "linear16",
      sample_rate: 8000,
      container: "none"
    }
  },
  agent: {
    language: "en",
    listen: {
      provider: {
        type: "deepgram",
        model: "nova-3"  // ASR model
      }
    },
    think: {
      provider: {
        type: "open_ai",
        model: "gpt-4o-mini"  // LLM model
      },
      prompt: AGENT_PROMPT,
      functions: [...]  // Loaded tools
    },
    speak: {
      provider: {
        type: "deepgram",
        model: "aura-2-thalia-en"  // TTS model
      }
    },
    greeting: "Hi there, I'm your virtual assistant..."
  }
}
```

### Tool System

#### Tool Loading
- **Built-in tools**: `avr_tools/` directory
  - `avr_hangup.js`: Ends the call via AMI
  - `avr_transfer.js`: Transfers call to another extension
- **Custom tools**: `tools/` directory (user-defined)

#### Tool Structure
```javascript
module.exports = {
  name: "tool_name",
  description: "Tool description",
  input_schema: {
    type: "object",
    properties: {...},
    required: [...]
  },
  handler: async (uuid, args) => {
    // Tool implementation
    return result;
  }
};
```

#### Tool Execution Flow
1. Deepgram Agent requests function call
2. Server finds tool handler via `getToolHandler()`
3. Handler executes with session UUID and arguments
4. Response sent back to Deepgram Agent

### Environment Variables

**Required:**
- `DEEPGRAM_API_KEY`: Deepgram API key
- `AGENT_PROMPT`: System prompt for AI agent

**Optional:**
- `PORT`: Server port (default: 6033)
- `DEEPGRAM_SAMPLE_RATE`: Audio sample rate (default: 8000)
- `DEEPGRAM_ASR_MODEL`: ASR model (default: nova-3)
- `DEEPGRAM_TTS_MODEL`: TTS model (default: aura-2-thalia-en)
- `DEEPGRAM_GREETING`: Initial greeting message
- `OPENAI_MODEL`: OpenAI model for LLM (default: gpt-4o-mini)
- `AMI_URL`: Asterisk Manager Interface URL (for tools)

### Audio Format
- **Input/Output**: 16-bit PCM, 8kHz
- **Encoding**: Linear16
- **Transport**: Base64-encoded in JSON messages

### Integration with AVR Core

1. AVR Core connects to STS via WebSocket (`ws://avr-sts-deepgram:6033`)
2. Core sends audio chunks as base64-encoded messages
3. STS forwards to Deepgram Agent API
4. STS receives audio responses and forwards to Core
5. Core streams audio back to Asterisk via AudioSocket

---

## Integration Flow

### Complete Call Flow (STS Mode)

```
1. Call arrives at Asterisk
   ↓
2. Asterisk extension calls AVR Core HTTP endpoint
   ↓
3. AVR Core establishes WebSocket connection to STS
   ↓
4. Asterisk AudioSocket connects to AVR Core
   ↓
5. Audio flows: Asterisk → Core → STS → Deepgram
   ↓
6. Response flows: Deepgram → STS → Core → Asterisk
   ↓
7. User hears AI response
```

### Complete Call Flow (Pipeline Mode)

```
1. Call arrives at Asterisk
   ↓
2. Asterisk AudioSocket connects to AVR Core
   ↓
3. Core sends audio → ASR service
   ↓
4. ASR returns transcript → Core
   ↓
5. Core sends transcript → LLM service
   ↓
6. LLM returns response text → Core
   ↓
7. Core sends text → TTS service
   ↓
8. TTS returns audio → Core
   ↓
9. Core streams audio → Asterisk
   ↓
10. User hears AI response
```

---

## Key Features

### 1. Multi-Provider Support
- Mix and match different providers for ASR, LLM, TTS
- Support for cloud and self-hosted providers
- Easy provider switching via configuration

### 2. Two Operation Modes
- **Pipeline Mode**: Separate ASR → LLM → TTS services
- **STS Mode**: Single Speech-to-Speech service (lower latency)

### 3. Dynamic Container Management
- Agents run as isolated Docker containers
- Automatic port assignment
- Container lifecycle management via API

### 4. Asterisk Integration
- Dynamic extension provisioning
- WebRTC phone support
- SIP trunk management
- Call recording
- AudioSocket for real-time audio streaming

### 5. Tool System (STS)
- Extensible tool framework
- Built-in tools (hangup, transfer)
- Custom tool support
- Function calling via Deepgram Agent API

### 6. Web Interface
- Agent management dashboard
- Provider configuration
- Call monitoring
- User management with roles

---

## Configuration Examples

### Deepgram STS Deployment

**docker-compose-deepgram.yml:**
```yaml
services:
  avr-core:
    environment:
      - STS_URL=ws://avr-sts-deepgram:6033
  
  avr-sts-deepgram:
    environment:
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - AGENT_PROMPT=${AGENT_PROMPT}
      - PORT=6033
```

**Required .env:**
```env
DEEPGRAM_API_KEY=your_key
AGENT_PROMPT="You are a helpful assistant."
```

### Pipeline Mode Deployment

**docker-compose-openai.yml:**
```yaml
services:
  avr-core:
    environment:
      - ASR_URL=http://avr-asr-deepgram:6000/speech-to-text-stream
      - LLM_URL=http://avr-llm-openai:6001/prompt-stream
      - TTS_URL=http://avr-tts-deepgram:6002/text-to-speech-stream
```

---

## Development & Testing

### Local Development

**Backend:**
```bash
cd avr-app/backend
npm install
npm run start:dev
```

**Frontend:**
```bash
cd avr-app/frontend
npm install
npm run dev
```

**STS Service:**
```bash
cd avr-sts-deepgram
npm install
node index.js
```

### Testing Setup

1. Start infrastructure: `docker-compose -f docker-compose-deepgram.yml up -d`
2. Register SIP client: username `1000`, password `1000`, TCP
3. Test echo: Call extension `600`
4. Test AVR: Call extension `5001`

---

## Security Considerations

1. **JWT Authentication**: Backend uses JWT for API authentication
2. **Role-Based Access**: ADMIN, MANAGER, VIEWER roles
3. **Docker Socket**: Backend requires Docker socket access (security risk if exposed)
4. **API Keys**: Stored in environment variables
5. **Network Isolation**: Services communicate via Docker network

---

## Scalability

1. **Container-Based**: Each agent runs in isolated containers
2. **Dynamic Ports**: Automatic port assignment prevents conflicts
3. **Network Isolation**: Docker network provides service discovery
4. **Stateless Services**: Most services are stateless (except database)

---

## Limitations & Notes

1. **SQLite Database**: Single-file database (not ideal for high concurrency)
2. **Docker Dependency**: Requires Docker for agent execution
3. **Asterisk Required**: Telephony features require Asterisk PBX
4. **Web Interface**: Still in development (work in progress)

---

---

## 4. AVR AMI (avr-ami)

### Purpose
Node.js service that provides a REST API wrapper around Asterisk Manager Interface (AMI) for call control operations. Enables LLMs and other services to control calls programmatically.

### Key Features

- **Call Control Operations**:
  - Transfer active calls to different extensions
  - Hang up ongoing calls
  - Originate new outbound calls
  - Retrieve call variables

- **UUID-based Call Tracking**: Tracks calls using UUIDs generated before AudioSocket invocation
- **AMI Event Monitoring**: Listens to Asterisk events to track call state
- **Simple REST API**: Easy-to-use HTTP endpoints

### API Endpoints

#### POST `/hangup`
Hang up an active call by UUID.

**Request:**
```json
{
  "uuid": "call-uuid"
}
```

#### POST `/transfer`
Transfer a call to another extension.

**Request:**
```json
{
  "uuid": "call-uuid",
  "exten": "1234",
  "context": "from-internal",
  "priority": 1
}
```

#### POST `/originate`
Initiate a new outbound call.

**Request:**
```json
{
  "channel": "SIP/trunk/1234567890",
  "exten": "1234",
  "context": "from-internal",
  "priority": 1,
  "callerid": "Agent Voice Response <avr>"
}
```

#### POST `/variables`
Get call variables by UUID (or last call if no UUID provided).

**Request:**
```json
{
  "uuid": "call-uuid"  // Optional
}
```

### How It Works

1. **AMI Connection**: Maintains persistent connection to Asterisk Manager Interface
2. **Event Monitoring**: Listens to `newexten` events to track AudioSocket calls and extract UUIDs
3. **Call Tracking**: Stores call information (UUID, channel, custom variables) in memory
4. **Call Management**: Executes AMI actions (Hangup, Redirect, Originate) based on API requests

### Environment Variables

- `PORT`: Server port (default: 6006)
- `AMI_HOST`: Asterisk host (default: host.docker.internal)
- `AMI_PORT`: AMI port (default: 5038)
- `AMI_USERNAME`: AMI username (default: avr)
- `AMI_PASSWORD`: AMI password (required)

### Integration with STS Tools

The AMI service is used by STS tools (like `avr_hangup.js` and `avr_transfer.js`) to control calls:
- Tools call AMI endpoints via HTTP
- AMI translates requests to AMI actions
- Asterisk executes the actions

---

## 5. AVR Webhook (avr-webhook)

### Purpose
Express.js web service for receiving and processing webhook events from AVR Core. Provides event handling, logging, and integration points for external systems.

### Key Features

- **Express.js** based web service
- **Security** middleware (Helmet, CORS, Rate Limiting)
- **Comprehensive logging** for all events
- **Request validation** and error handling
- **Event-specific handlers** for different webhook types
- **Health check** endpoint
- **Graceful shutdown** handling

### API Endpoints

#### GET `/health`
Health check endpoint returning service status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "avr-webhook",
  "version": "1.0.0"
}
```

#### POST `/events`
Main webhook endpoint for receiving events from AVR Core.

**Request:**
```json
{
  "uuid": "unique-event-identifier",
  "type": "event-type",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    // Event-specific data
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event processed successfully",
  "eventId": "unique-event-identifier",
  "processedAt": "2024-01-15T10:30:00.000Z"
}
```

### Supported Event Types

| Event Type | Description | Payload Example |
|------------|-------------|-----------------|
| `call_started` | Call initiation | `{}` |
| `call_ended` | Call termination | `{}` |
| `transcription` | Speech-to-text result | `{ role, text }` |
| `interruption` | User interruption | `{}` |
| `dtmf_digit` | User digit | `{ digit }` |
| `error` | Error occurred | `{ message }` |

### Security Features

- **Helmet**: Security headers
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: 100 requests per 15 minutes per IP (configurable)
- **Webhook Secret Verification**: Optional secret header verification (`X-AVR-WEBHOOK-SECRET`)

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (default: development)
- `ALLOWED_ORIGINS`: CORS allowed origins (default: *)
- `RATE_LIMIT_MAX`: Max requests per IP per 15min (default: 100)
- `WEBHOOK_SECRET`: Webhook signature secret (optional)

### Event Processing

The service includes dedicated handlers for each event type:
- **Call Events**: Track call lifecycle
- **Transcription Events**: Process speech-to-text results
- **Interruption Events**: Handle user barge-in
- **DTMF Events**: Process user digit input
- **Error Events**: Log and alert on errors

### Integration with AVR Core

Configure AVR Core to send webhooks:
```env
WEBHOOK_URL=http://avr-webhook:3000/events
WEBHOOK_SECRET=your-webhook-secret-here
WEBHOOK_TIMEOUT=3000
WEBHOOK_RETRY=3
```

---

## 6. AVR Phone (avr-phone)

### Purpose
Browser-based WebRTC SIP phone client for making and receiving calls through Asterisk. Provides a fully-featured softphone interface that runs entirely in the browser.

### Key Features

- **WebRTC-based**: Uses SIP.js for WebRTC communication
- **Multi-language Support**: 12 language packs (en, fr, ja, zh-hans, zh, ru, tr, nl, es, de, pl, pt-br)
- **Light/Dark Themes**: Customizable themes with wallpapers
- **PWA Support**: Progressive Web App with service worker
- **Call Features**:
  - Make/receive calls
  - Hold/resume
  - Transfer
  - Conference
  - Voicemail integration
  - Call history
  - Presence (BLF - Busy Lamp Field)

### Configuration

The phone client stores configuration in browser localStorage:

- `wssServer`: WebSocket server hostname
- `WebSocketPort`: WebSocket port (typically 444 or 4443)
- `ServerPath`: WebSocket path (typically `/ws`)
- `SipDomain`: SIP domain
- `SipUsername`: SIP username
- `SipPassword`: SIP password
- `profileName`: Display name
- `profileUserID`: Internal user ID

### WebSocket Connection

The phone uses WebSocket (WSS) for SIP signaling:
- Connects to Asterisk via WebSocket Secure
- Handles SIP registration and call signaling
- Supports reconnection with configurable attempts

### Audio Codecs

Supports standard telephony codecs:
- G.711 (μ-law, A-law)
- Opus (if supported by Asterisk)
- G.722 (if supported)

### Integration

The phone can be:
- Embedded in web applications
- Deployed as standalone PWA
- Configured via URL parameters
- Provisioned via webhooks

### Docker Deployment

```dockerfile
FROM nginx:alpine
COPY src/ /usr/share/nginx/html/
```

Accessible at: `https://phone.agentvoiceresponse.com/index.html`

---

## 7. AVR Asterisk (avr-asterisk)

### Purpose
Docker image containing a pre-configured Asterisk 23.1.0 PBX optimized for VoIP applications and AVR integration.

### Key Features

- **Asterisk 23.1.0**: Latest stable version
- **PJSIP Support**: Modern SIP stack
- **Manager API**: Enabled for AMI access
- **HTTP API**: Enabled for ARI (Asterisk REST Interface)
- **Prometheus Metrics**: Enabled for monitoring
- **Minimal Footprint**: Only essential modules included
- **Timezone Configurable**: Default Europe/Rome

### Default Ports

- `5038`: Asterisk Manager Interface (AMI)
- `8088`: HTTP API / ARI
- `10000-20000`: RTP ports for media streaming
- `5060`: SIP (if exposed)

### Configuration Files

The image expects configuration files mounted at `/etc/asterisk/`:
- `extensions.conf`: Dialplan configuration
- `pjsip.conf`: PJSIP endpoint configuration
- `manager.conf`: AMI configuration
- `queues.conf`: Queue configuration
- `ari.conf`: ARI configuration

### Usage

```bash
docker run -d \
  --name asterisk \
  -p 5038:5038 \
  -p 8088:8088 \
  -p 10000-20000:10000-20000/udp \
  -v /path/to/config:/etc/asterisk \
  agentvoiceresponse/avr-asterisk:latest
```

### Environment Variables

- `TZ`: Timezone (default: Europe/Rome)

---

## 8. AVR VAD (avr-vad)

### Purpose
Node.js library for Voice Activity Detection using the Silero VAD model. Provides real-time and batch processing capabilities for detecting speech in audio streams.

### Key Features

- **Silero VAD Models**: Pre-trained ONNX models (v5 and legacy)
- **Real-time Processing**: Frame-by-frame processing for live audio
- **Non-real-time Processing**: Batch processing for audio files
- **Configurable Thresholds**: Customizable sensitivity
- **Audio Utilities**: Resampling and audio manipulation tools
- **TypeScript Support**: Fully typed
- **Bundled Models**: Models included in package (no external downloads)

### Usage

#### Real-time VAD
```typescript
import { RealTimeVAD } from 'avr-vad';

const vad = await RealTimeVAD.new({
  model: 'v5',
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
  frameSamples: 1536
});

const result = await vad.processFrame(audioFrame);
console.log(`Speech: ${result.msg}, Probability: ${result.probability}`);
```

#### Non-real-time VAD
```typescript
import { NonRealTimeVAD } from 'avr-vad';

const vad = await NonRealTimeVAD.new({
  model: 'v5',
  positiveSpeechThreshold: 0.5
});

const results = await vad.processAudio(audioData);
const segments = vad.getSpeechSegments(results);
```

### Audio Requirements

- **Sample Rate**: 16kHz
- **Channels**: Mono
- **Format**: Float32Array (-1.0 to 1.0)
- **Frame Size**: 1536 samples (96ms at 16kHz)

### VAD Messages

- `SPEECH_START`: Speech detected
- `SPEECH_CONTINUE`: Speech continuing
- `SPEECH_END`: Speech ended
- `SILENCE`: Silence detected
- `ERROR`: Processing error

### Integration with AVR Core

AVR Core uses this library internally for:
- **Barge-in Detection**: Detecting when user interrupts AI
- **Turn-taking**: Managing conversation flow
- **VAD Configuration**: Configurable via `VAD_*` environment variables

### Configuration Options

```typescript
interface RealTimeVADOptions {
  model?: 'v5' | 'legacy';
  positiveSpeechThreshold?: number;  // Default: 0.5
  negativeSpeechThreshold?: number;  // Default: 0.35
  preSpeechPadFrames?: number;        // Default: 1
  redemptionFrames?: number;          // Default: 8
  frameSamples?: number;              // Default: 1536
  minSpeechFrames?: number;           // Default: 3
}
```

---

## 9. AVR Documentation (avr-docs)

### Purpose
Comprehensive documentation repository containing guides, tutorials, and reference materials for the AVR ecosystem.

### Key Documentation Topics

- **Getting Started**: How AVR works, architecture overview
- **Provider Integrations**: 
  - Deepgram, OpenAI, Anthropic, Google
  - ElevenLabs, Ultravox, Gemini, HumeAI
  - Vosk, Kokoro, CoquiTTS, Ollama
- **Deployment Guides**:
  - Using with FreePBX
  - Using with VitalPBX
  - External Asterisk setup
- **Advanced Features**:
  - Function calls / Tools
  - Webhook integration
  - Ambient background noise
  - Voice Activity Detection
  - Audio codec support
- **Administration Panel**: Setup and usage
- **Troubleshooting**: Common issues and solutions

### Documentation Structure

The repository contains:
- Markdown files for each topic
- Images and diagrams
- Code examples
- Configuration samples
- Architecture diagrams

### Key Documents

- `how-avr-works.md`: Core concepts and architecture
- `understanding-avr-core.md`: AVR Core deep dive
- `avr-sts-integration-implementation.md`: STS implementation details
- `webhook-integration-guide.md`: Webhook setup and usage
- `using-ambient-background-noise-in-avr.md`: Ambient noise feature
- `overview-noise-and-vad.md`: VAD and noise handling

---

## Complete System Architecture

### Component Interaction Diagram

```
┌─────────────┐
│   Browser   │
│  (avr-phone)│
└──────┬──────┘
       │ WebRTC/SIP
       ▼
┌─────────────┐
│  Asterisk   │
│ (avr-asterisk)│
└──────┬──────┘
       │ AudioSocket
       ▼
┌─────────────┐
│  AVR Core   │
└──────┬──────┘
       │
       ├───► ASR Service ──► LLM Service ──► TTS Service
       │
       └───► STS Service (Deepgram/OpenAI/etc.)
       │
       ├───► Webhook Service (avr-webhook)
       │
       └───► AMI Service (avr-ami) ◄─── Tools (hangup, transfer)
```

### Data Flow

1. **Call Initiation**: Browser phone → Asterisk → AVR Core
2. **Audio Processing**: AVR Core → ASR/STS → LLM → TTS → AVR Core → Asterisk
3. **Call Control**: Tools → AMI Service → Asterisk
4. **Event Tracking**: AVR Core → Webhook Service → External Systems

---

## Resources

- **GitHub**: https://github.com/agentvoiceresponse
- **Documentation**: https://github.com/agentvoiceresponse/avr-docs
- **Discord**: https://discord.gg/DFTU69Hg74
- **Wiki**: https://wiki.agentvoiceresponse.com/en/home
- **Docker Hub**: https://hub.docker.com/u/agentvoiceresponse
- **NPM**: https://www.npmjs.com/~agentvoiceresponse

---

## Summary

AVR is a comprehensive platform for building AI-powered voice agents with:
- **Flexible architecture** supporting multiple AI providers
- **Two operation modes** (Pipeline and STS) for different use cases
- **Web-based management** interface for agent configuration
- **Deep integration** with Asterisk PBX for telephony
- **Extensible tool system** for custom functionality
- **Docker-based deployment** for easy scaling and isolation

The Deepgram STS integration provides ultra-low latency voice interactions by combining ASR, LLM, and TTS in a single service, making it ideal for real-time conversational AI applications.

