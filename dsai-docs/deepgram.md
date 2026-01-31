---
title: Deepgram
description: Deepgram is an AI-powered speech platform providing both Automatic Speech Recognition (ASR) and Text-to-Speech (TTS) capabilities.
published: true
date: 2025-09-30T11:30:56.744Z
tags: asr, tts, sts, deepgram
editor: markdown
dateCreated: 2025-08-11T10:20:30.335Z
---

# Configuring Deepgram in DSAI
<br>
<div align="center">
  <img src="/images/deepgram/deepgram-logo.webp" alt="Deepgram" width="300"/>
</div>

## Overview
[Deepgram](https://deepgram.com/) is an AI-powered speech platform providing **Automatic Speech Recognition (ASR)**, **Text-to-Speech (TTS)** and **Speech-to-Speech (STS)** capabilities.

**ASR Features:**
- Real-time and batch transcription.
- High accuracy with advanced models like *Nova-2*.
- Support for over 36 languages and dialects.
- Low latency (under 300 ms for streaming).
- Options for diarization, keyword boosting, and filler word removal.

**TTS Features:**
- Natural-sounding, low-latency voice synthesis.
- Multiple voices and styles across supported languages.
- Configurable models, voices, and versions.

## How to Obtain a Deepgram API Key

1. Sign up at Deepgram Console (free tier available with trial credits).
2. Select your default project or create a new one.
3. Navigate to Settings → API Keys.
4. Click Create a New API Key.
5. Provide a friendly name, choose appropriate permissions, and optionally set an expiration date.
6. Click Create Key and copy the key immediately — it will not be shown again.
7. Store the API key securely; do not commit it to public repositories.

## Deepgram ASR Setup

### Repository
- GitHub: [dsai-asr-deepgram](https://github.com/agentvoiceresponse/dsai-asr-deepgram)

### Environment Variables
| Variable                       | Description                                               | Example Value            |
|--------------------------------|-----------------------------------------------------------|--------------------------|
| `PORT`                         | Port where the ASR module listens                         | `6010`                   |
| `DEEPGRAM_API_KEY`             | Your Deepgram API key                                     | `abc123xyz...`           |
| `SPEECH_RECOGNITION_LANGUAGE`  | Target language code for transcription                    | `en-US`                  |
| `SPEECH_RECOGNITION_MODEL`     | Deepgram model name (including version, if applicable)    | `nova-2-phonecall`       |

**Example `.env` section:**
```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
SPEECH_RECOGNITION_LANGUAGE=en-US
SPEECH_RECOGNITION_MODEL=nova-2-phonecall
PORT=6010
```
Docker Compose Configuration:

```yaml
dsai-asr-deepgram:
  image: agentvoiceresponse/dsai-asr-deepgram
  platform: linux/x86_64
  container_name: dsai-asr-deepgram
  restart: always
  environment:
    - PORT=6010
    - DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY
    - SPEECH_RECOGNITION_LANGUAGE=en-US
    - SPEECH_RECOGNITION_MODEL=nova-2-phonecall
  networks:
    - dsai
```

## Deepgram TTS Setup

### Repository
- GitHub: [dsai-tts-deepgram](https://github.com/agentvoiceresponse/dsai-tts-deepgram)

### Environment Variables

| Variable            | Description                                                        | Example Value              |
|---------------------|--------------------------------------------------------------------|----------------------------|
| PORT                | Port where the TTS module listens                                  | 6011                       |
| DEEPGRAM_API_KEY    | Your Deepgram API key                                               | abc123xyz...               |
| DEEPGRAM_TTS_MODEL  | Deepgram TTS model in format `[model]-[voice]-[language]-[version]` | aura-arabella-en-xxhifi    |

Example .env section:
```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
DEEPGRAM_TTS_MODEL=aura-arabella-en-xxhifi
PORT=6011
```
Docker Compose Configuration:
```yaml
dsai-tts-deepgram:
  image: agentvoiceresponse/dsai-tts-deepgram
  platform: linux/x86_64
  container_name: dsai-tts-deepgram
  restart: always
  environment:
    - PORT=6011
    - DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY
    - DEEPGRAM_TTS_MODEL=aura-arabella-en-xxhifi
  networks:
    - dsai
```

## Deepgram STS Setup

### Repository
- GitHub: [dsai-sts-deepgram](https://github.com/agentvoiceresponse/dsai-sts-deepgram)

### Environment Variables

| Variable               | Description                                               | Default / Example Value         |
|------------------------|-----------------------------------------------------------|---------------------------------|
| `PORT`                 | Port where the STS module listens                         | `6033`                          |
| `DEEPGRAM_API_KEY`     | Your Deepgram API key                                     | `abc123xyz...`                  |
| `AGENT_PROMPT`         | System prompt that defines the AI agent’s behavior        | `"You are a helpful assistant"` |
| `DEEPGRAM_SAMPLE_RATE` | Audio sample rate                                         | `8000`                          |
| `DEEPGRAM_ASR_MODEL`   | Deepgram ASR model used for transcription                 | `nova-3`                        |
| `DEEPGRAM_TTS_MODEL`   | Deepgram TTS model used for speech generation             | `aura-2-thalia-en`              |
| `DEEPGRAM_GREETING`    | Optional greeting message sent at the start of a session  | `"Hello! How can I help you?"`  |
| `OPENAI_MODEL`         | OpenAI model for generating responses                     | `gpt-4o-mini`                   |

**Example `.env` section:**
```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
AGENT_PROMPT=You are a helpful assistant
DEEPGRAM_SAMPLE_RATE=8000
DEEPGRAM_ASR_MODEL=nova-3
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_GREETING=Hello! How can I help you?
OPENAI_MODEL=gpt-4o-mini
PORT=6033
```
Docker Compose Configuration:
```yaml
dsai-sts-deepgram:
  image: agentvoiceresponse/dsai-sts-deepgram
  platform: linux/x86_64
  container_name: dsai-sts-deepgram
  restart: always
  environment:
    - PORT=6033
    - DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY
    - AGENT_PROMPT=$AGENT_PROMPT
    - DEEPGRAM_SAMPLE_RATE=8000
    - DEEPGRAM_ASR_MODEL=nova-3
    - DEEPGRAM_TTS_MODEL=aura-2-thalia-en
    - DEEPGRAM_GREETING="Hello! How can I help you?"
    - OPENAI_MODEL=gpt-4o-mini
  networks:
    - dsai
```

### How DSAI Uses Deepgram

**ASR Module**: DSAI Core streams audio to Deepgram ASR, receives transcribed text, and passes it to the LLM.

**TTS Module**: DSAI Core sends the LLM’s text response to Deepgram TTS, which returns audio to Asterisk or the calling application.

**STS Module**: The STS Module combines speech-to-text (STT/ASR) and text-to-speech (TTS) in a single flow.