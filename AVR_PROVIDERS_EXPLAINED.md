# AVR Providers System - Complete Guide

## Overview

The **Providers** section in AVR is where you configure AI services (ASR, LLM, TTS, STS) that will be used by your voice agents. Providers are reusable configurations that can be shared across multiple agents.

## Provider Types

### 1. **ASR (Automatic Speech Recognition)**
- **Purpose**: Converts speech to text
- **Used in**: Pipeline mode only
- **Example**: Deepgram, Whisper, Google Speech-to-Text

### 2. **LLM (Large Language Model)**
- **Purpose**: Processes text, generates responses, handles conversation logic
- **Used in**: Pipeline mode only
- **Example**: OpenAI GPT, Anthropic Claude, Google Gemini

### 3. **TTS (Text-to-Speech)**
- **Purpose**: Converts text to speech audio
- **Used in**: Pipeline mode only
- **Example**: ElevenLabs, Azure TTS, Google TTS

### 4. **STS (Speech-to-Speech)**
- **Purpose**: End-to-end speech processing (bypasses ASR/LLM/TTS)
- **Used in**: STS mode only
- **Example**: Deepgram STS, OpenAI Realtime API, ElevenLabs STS, Google Gemini Native Audio

## Provider Structure

### Database Entity
```typescript
{
  id: string (UUID)
  type: 'ASR' | 'LLM' | 'TTS' | 'STS'
  name: string (unique)
  config: {
    image?: string          // Docker image name
    env?: {                 // Environment variables
      [key: string]: string
    }
  }
}
```

### Configuration Object (`config`)
The `config` field is a JSON object containing:

1. **`image`** (optional): Docker image to use for this provider
   - Example: `"agentvoiceresponse/avr-sts-deepgram"`
   - If not provided, must be specified when creating the provider

2. **`env`** (optional): Environment variables for the provider container
   - Example: `{ "DEEPGRAM_API_KEY": "your-key", "AGENT_PROMPT": "..." }`
   - These are passed to the Docker container when the agent runs

## How Providers Work

### 1. **Creating a Provider**

When you create a provider in the dashboard:

1. **Select Type**: Choose ASR, LLM, TTS, or STS
2. **Name**: Give it a unique name (e.g., "Deepgram STS Production")
3. **Template** (optional): Choose a pre-configured template
   - Templates include: STS OpenAI, STS ElevenLabs, STS Gemini, STS Deepgram
4. **Docker Image**: Specify the container image
   - Can be from template or custom
5. **Environment Variables**: Configure API keys, models, prompts, etc.

### 2. **Provider Templates**

The system includes pre-configured templates:

#### STS Templates:
- **STS OpenAI**: `agentvoiceresponse/avr-sts-openai`
  - Fields: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VOICE`, `OPENAI_LANGUAGE`, `OPENAI_INSTRUCTIONS`
  
- **STS ElevenLabs**: `agentvoiceresponse/avr-sts-elevenlabs`
  - Fields: `ELEVENLABS_AGENT_ID`, `ELEVENLABS_API_KEY`
  
- **STS Gemini**: `agentvoiceresponse/avr-sts-gemini`
  - Fields: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_INSTRUCTIONS`
  
- **STS Deepgram**: `agentvoiceresponse/avr-sts-deepgram`
  - Fields: `DEEPGRAM_API_KEY`, `AGENT_PROMPT`, `DEEPGRAM_MODEL`, etc.

### 3. **Using Providers in Agents**

When you create or run an agent:

#### Pipeline Mode:
- **Requires**: ASR provider + LLM provider + TTS provider
- **Optional**: None (STS cannot be used)
- **Flow**: Audio → ASR → Text → LLM → Text → TTS → Audio

#### STS Mode:
- **Requires**: STS provider only
- **Optional**: None (ASR/LLM/TTS cannot be used)
- **Flow**: Audio → STS → Audio (direct)

### 4. **How Agents Use Providers**

When you **run an agent**, the system:

1. **Starts Provider Containers**:
   - For each provider, creates a Docker container
   - Container name: `avr-{type}-{agentId}` (e.g., `avr-sts-abc123`)
   - Random port: 6000-6999 assigned to each container

2. **Configures Environment Variables**:
   - Extracts `env` from provider's `config`
   - Adds provider metadata: `PROVIDER_{TYPE}_ID`, `PROVIDER_{TYPE}_NAME`, `PROVIDER_{TYPE}_TYPE`
   - Adds port: `PORT={randomPort}`
   - Adds AMI URL (for STS and LLM providers that support tools)

3. **Starts AVR Core Container**:
   - Container name: `avr-core-{agentId}`
   - Configures URLs to provider containers:
     - Pipeline: `ASR_URL=http://avr-asr-{agentId}:{port}`, `LLM_URL=...`, `TTS_URL=...`
     - STS: `STS_URL=ws://avr-sts-{agentId}:{port}`

4. **Connects Everything**:
   - AVR Core connects to provider containers via internal Docker network
   - Asterisk connects to AVR Core via AudioSocket
   - Audio flows through the pipeline

## Provider Configuration Examples

### Example 1: Deepgram STS Provider
```json
{
  "type": "STS",
  "name": "Deepgram Production",
  "config": {
    "image": "agentvoiceresponse/avr-sts-deepgram",
    "env": {
      "DEEPGRAM_API_KEY": "ad748182032466add820eed184e6b81aefa06fcd",
      "AGENT_PROMPT": "You are a helpful assistant.",
      "PORT": "6033",
      "AMI_URL": "http://avr-ami:6006",
      "DEEPGRAM_MODEL": "nova-3",
      "DEEPGRAM_TTS_MODEL": "aura-2-thalia-en"
    }
  }
}
```

### Example 2: Custom Pipeline Provider
```json
{
  "type": "LLM",
  "name": "OpenAI GPT-4",
  "config": {
    "image": "agentvoiceresponse/avr-llm-openai",
    "env": {
      "OPENAI_API_KEY": "sk-...",
      "OPENAI_MODEL": "gpt-4o",
      "OPENAI_TEMPERATURE": "0.7"
    }
  }
}
```

## Key Concepts

### 1. **Provider Reusability**
- One provider can be used by multiple agents
- Changing a provider affects all agents using it
- Each agent gets its own container instance when running

### 2. **Container Isolation**
- Each agent gets isolated Docker containers for its providers
- Containers are named uniquely per agent
- Containers communicate via Docker network

### 3. **Dynamic Port Assignment**
- Ports 6000-6999 are randomly assigned
- Prevents port conflicts between multiple agents
- URLs are built dynamically: `http://container-name:random-port`

### 4. **Environment Variable Inheritance**
- Base environment: `AGENT_ID`, `AGENT_NAME`
- Provider environment: From provider's `config.env`
- Additional environment: Can be passed when running agent
- Provider metadata: Automatically added (`PROVIDER_*_ID`, etc.)

### 5. **Mode Restrictions**
- **Pipeline mode**: Must have ASR + LLM + TTS, cannot have STS
- **STS mode**: Must have STS only, cannot have ASR/LLM/TTS
- System validates this when creating/updating agents

## API Endpoints

### Create Provider
```
POST /api/providers
Body: {
  type: "STS",
  name: "My Provider",
  config: { image: "...", env: {...} }
}
```

### List Providers
```
GET /api/providers?page=1&limit=10
```

### Update Provider
```
PATCH /api/providers/{id}
Body: {
  name?: string,
  type?: "ASR" | "LLM" | "TTS" | "STS",
  config?: {...}
}
```

### Delete Provider
```
DELETE /api/providers/{id}
```

## Best Practices

1. **Naming Convention**: Use descriptive names like "Deepgram STS Production" or "OpenAI GPT-4 Dev"

2. **API Key Security**: Store API keys in provider config (they're stored in database)

3. **Template Usage**: Use templates when available for faster setup

4. **Testing**: Create separate providers for dev/staging/production

5. **Reusability**: Create generic providers that can be shared across agents

6. **Environment Variables**: Only include necessary variables in `config.env`

## How It All Connects

```
┌─────────────┐
│  Asterisk   │
│  (PBX)      │
└──────┬──────┘
       │ AudioSocket
       │
┌──────▼──────────┐
│   AVR Core      │
│  (Orchestrator) │
└──────┬──────────┘
       │
       ├─── Pipeline Mode ───┐
       │                      │
       │  ┌─────────┐         │
       ├─►│  ASR    │         │
       │  │ Provider│         │
       │  └────┬────┘         │
       │       │              │
       │  ┌────▼────┐         │
       ├─►│  LLM    │         │
       │  │ Provider│         │
       │  └────┬────┘         │
       │       │              │
       │  ┌────▼────┐         │
       └─►│  TTS    │         │
          │ Provider│         │
          └─────────┘         │
                              │
       └─── STS Mode ─────────┘
                              │
          ┌─────────┐         │
          │   STS   │◄────────┘
          │ Provider│
          └─────────┘
```

## Summary

- **Providers** = Reusable AI service configurations
- **Types**: ASR, LLM, TTS, STS
- **Config**: Docker image + environment variables
- **Usage**: Assigned to agents when creating/running them
- **Execution**: Each agent gets isolated containers for its providers
- **Mode**: Pipeline (ASR+LLM+TTS) or STS (single provider)

