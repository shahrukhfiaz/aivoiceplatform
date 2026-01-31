---
title: How DSAI Works
description: Understanding the core concepts and architecture of DSAI
published: true
date: 2025-09-29T12:48:05.806Z
tags: 
editor: markdown
dateCreated: 2025-08-06T17:06:33.271Z
---

# How DSAI Works

The DSAI Infrastructure project provides a complete, modular deployment environment for the Agent Voice Response system. It allows you to launch the DSAI Core, ASR (Automatic Speech Recognition), LLM (Large Language Model), and TTS (Text To Speech) services or STS (Speech To Speech) service, all integrated with an Asterisk PBX using the AudioSocket protocol.

This setup supports a wide range of providers—including cloud services like OpenAI, Deepgram, Google, ElevenLabs, Anthropic **and local/open-source providers like Vosk, Kokoro, CoquiTTS, Ollama**—and can be customized with Docker Compose.

## Prerequisites

Before starting, ensure the following tools and credentials are ready:

- Docker and Docker Compose installed  
- Valid API keys for services you plan to use (e.g., OpenAI, Google, Deepgram)  
- (Optional) SIP client installed (e.g., Telphone, MicroSIP, GNOME Calls) for voice testing  
- (Optional) Local ASR/TTS/LLM services configured if using Vosk, Kokoro, CoquiTTS, or Ollama  

## Architecture Summary

DSAI follows a modular design:

<br>
<div align="center">
  <img src="/images/architecture/asr-llm-tts.png" alt="Architecture" width="800"/>
</div>
<br>

### 1) Audio Ingestion (Asterisk → DSAI Core)
1. The call hits your dialplan (e.g., `exten => 5001,...`), which:
   - **Answers** the call.
   - **Generates a UUID** (e.g., with `uuidgen`).
   - **Opens an AudioSocket** to DSAI Core:  
     `AudioSocket(${UUID}, IP_DSAI_CORE:PORT_DSAI_CORE)`
2. Asterisk streams the caller’s **audio frames** to DSAI Core in real time (typically narrowband telephony audio; exact codec depends on your PBX config).

**What DSAI Core does:**
- Accepts the TCP AudioSocket connection.
- Normalizes audio if needed (codec/rate).
- **Segments audio into chunks** (streaming) and forwards them to the configured **ASR** over HTTP.

### 2) Transcription (DSAI Core → ASR)
1. DSAI Core **streams audio chunks** to the ASR at `ASR_URL`.
2. The ASR produces **partial results** (interim text) and **final results** (stabilized text).
3. DSAI Core:
   - Buffers partials for responsiveness.
   - Emits a **final transcript segment** when the ASR marks it as finalized (e.g., end of user utterance).

> The **final transcript** is the trigger to move to the LLM step.

### 3) Reasoning/Response (DSAI Core → LLM)
1. DSAI Core forwards the **final transcript** (plus any conversation context) to the **LLM** at `LLM_URL`.  
   - Provider-agnostic (OpenAI, Anthropic, OpenRouter, etc.).  
   - **Example note**: “The response from **Anthropic** is then sent to a TTS engine…”
2. The LLM streams back the **assistant response** (text). DSAI Core:
   - Streams partial tokens (if supported) or
   - Waits for the complete text, depending on the integration and configuration.

### 4) Voice Rendering (DSAI Core → TTS)
1. DSAI Core sends the LLM response text to **TTS** at `TTS_URL` (streaming).
2. TTS returns **audio frames** (the spoken reply).
3. DSAI Core **pipes the audio back** over the existing AudioSocket to Asterisk, so the **caller hears the response** with minimal latency.

## Alternative Low-Latency Path (STS)

If you configure `STS_URL`, DSAI Core will **bypass ASR/LLM/TTS** and use a **single Speech-to-Speech** service:

- **Speech In** → **STS** → **Speech Out**
- This can reduce latency and improve conversational “flow” by avoiding multiple hops.

<br>
<div align="center">
  <img src="/images/architecture/sts.png" alt="Architecture" width="800"/>
</div>
<br>

## What the Caller Experiences

1.	Speaks → ASR transcribes (or STS ingests speech directly).
2.	The LLM decides how to respond (policy, tools, memory).
3.	TTS/STS renders a natural voice response.
4.	DSAI Core streams audio back instantly; the conversation feels interactive and real-time.

## Your First Agent in Under 5 Minutes

Use one of the preconfigured `docker-compose-*.yml` files to deploy DSAI with your preferred providers.

### Step-by-step:

1. Clone the repository:

```console
git clone https://github.com/agentvoiceresponse/dsai-infra
cd dsai-infra
```


2. Copy .env.example to .env:

```console
cp .env.example .env
```

3. Select a compose file:

For example, to run Deepgram + OpenAI:

```console
docker-compose -f docker-compose-openai.yml up -d
```

Or, for local/open-source providers like Vosk:

```console
docker-compose -f docker-compose-vosk.yml up -d
```

4. Edit .env with your API keys or local service URLs. Example:

```env
# Cloud providers
DEEPGRAM_API_KEY=your_key
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-3.5-turbo

# Local providers

```

#### Advanced: STS-Only Providers

Some providers (like OpenAI Realtime or Ultravox) offer Speech-to-Speech (STS) processing that bundles ASR, LLM, and TTS.

In this case, only set:

```env
STS_URL=http://dsai-sts-provider:port
```

See `docker-compose-deepgram.yml` and `docker-compose-ultravox.yml` for examples.

## Configuration Summary (Core)
- ASR pipeline: **ASR_URL, LLM_URL, TTS_URL**
- STS pipeline (direct): STS_URL (and comment out ASR/LLM/TTS variables)

- Example URLs:
```yaml
ASR_URL=http://dsai-asr-deepgram:6010/speech-to-text-stream
LLM_URL=http://dsai-llm-anthropic:6000/prompt-stream
TTS_URL=http://dsai-tts-google:6003/text-to-speech-stream
STS_URL=http://dsai-sts-openai:6033/speech-to-speech-stream
```

> Hostnames/ports depend on your Docker Compose and service names.
> 