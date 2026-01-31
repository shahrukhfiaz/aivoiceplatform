---
title: Hume Speech To Speech
description: 
published: true
date: 2025-12-14T11:14:12.137Z
tags: 
editor: markdown
dateCreated: 2025-12-14T11:13:05.689Z
---

# HumeAI Speech-to-Speech Integration

The **HumeAI Speech-to-Speech (STS) integration** enables Agent Voice Response to connect directly to **HumeAI’s real-time conversational voice API**, allowing voice-to-voice interactions with emotional intelligence and low latency.

This integration bypasses the traditional ASR → LLM → TTS pipeline and provides a **single real-time speech loop**, ideal for natural, expressive, and emotionally aware AI conversations.

Official website: https://www.hume.ai  
Realtime API documentation: https://dev.hume.ai  

## Why HumeAI?

HumeAI is uniquely focused on **emotion-aware conversational AI**, making it an excellent choice for applications where tone, empathy, and emotional context matter.

### Key Advantages

- **Real-time Speech-to-Speech** with very low latency  
- **Emotionally intelligent responses** tuned for human-like interaction  
- **Native voice generation** (no external TTS required)  
- **WebSocket-based streaming**, ideal for conversational agents  
- **Config-driven personas** using HumeAI configs, voices, and instructions  

### Typical Use Cases

- Empathetic customer support agents  
- Healthcare and wellness assistants  
- Coaching and conversational guidance  
- Human-like virtual assistants  

## Repository

Clone the official integration repository:

```bash
git clone https://github.com/agentvoiceresponse/dsai-sts-humeai.git
````

## Configuration

### Environment Variables

| Variable                 | Description                                     | Default                              | Required |
| ------------------------ | ----------------------------------------------- | ------------------------------------ | -------- |
| `HUMEAI_API_KEY`         | Your HumeAI API key                             | —                                    | **Yes**  |
| `PORT`                   | Local service port                              | `6039`                               | Optional |
| `HUMEAI_WS_URL`          | HumeAI WebSocket endpoint                       | `wss://api.hume.ai/v0/evi/chat`      | Optional |
| `HUMEAI_WELCOME_MESSAGE` | Initial greeting message                        | `"Hello, how can I help you today?"` | Optional |
| `HUMEAI_INSTRUCTIONS`    | System prompt when no config ID is used         | `"You are a helpful assistant"`      | Optional |
| `HUMEAI_CONFIG_ID`       | HumeAI config ID (overrides instructions/voice) | —                                    | Optional |
| `HUMEAI_VOICE_ID`        | Voice ID (used when no config ID is provided)   | —                                    | Optional |

### Example `.env`

```env
HUMEAI_API_KEY=your_humeai_api_key
PORT=6039
HUMEAI_WS_URL=wss://api.hume.ai/v0/evi/chat
HUMEAI_WELCOME_MESSAGE="Hello, how can I help you today?"
HUMEAI_INSTRUCTIONS="You are a helpful assistant"
HUMEAI_CONFIG_ID=
HUMEAI_VOICE_ID=
```

## Docker Compose Example

```yaml
dsai-sts-humeai:
  image: agentvoiceresponse/dsai-sts-humeai
  platform: linux/x86_64
  container_name: dsai-sts-humeai
  restart: always
  environment:
    - PORT=6039
    - HUMEAI_API_KEY=${HUMEAI_API_KEY}
    - HUMEAI_WS_URL=${HUMEAI_WS_URL:-wss://api.hume.ai/v0/evi/chat}
    - HUMEAI_WELCOME_MESSAGE=${HUMEAI_WELCOME_MESSAGE:-Hello, how can I help you today?}
    - HUMEAI_INSTRUCTIONS=${HUMEAI_INSTRUCTIONS:-You are a helpful assistant}
    - HUMEAI_CONFIG_ID=${HUMEAI_CONFIG_ID}
    - HUMEAI_VOICE_ID=${HUMEAI_VOICE_ID}
  networks:
    - dsai
```

## Integrating with DSAI Core

To use HumeAI as your Speech-to-Speech provider, configure `STS_URL` in **dsai-core**:

```env
STS_URL=http://dsai-sts-humeai:6039/speech-to-speech-stream
```

> ⚠️ When `STS_URL` is configured, **ASR_URL, LLM_URL, and TTS_URL must be commented out**, as DSAI Core switches to STS mode.

## How It Works

1. Asterisk streams audio to DSAI Core via AudioSocket
2. DSAI Core forwards audio to the HumeAI STS service
3. HumeAI processes speech and generates a spoken response in real time
4. Audio is streamed back to DSAI Core
5. DSAI Core sends audio back to Asterisk

All communication is handled via **WebSocket streaming**, ensuring low latency and natural conversational flow.

## Configuration Modes

### Using a HumeAI Config (`HUMEAI_CONFIG_ID`)

When a config ID is provided, HumeAI fully controls:

* Voice selection
* Emotional behavior
* Instructions and personality

This is the **recommended approach** for production use.

### Without a Config ID

If no config ID is set, DSAI will use:

* `HUMEAI_WELCOME_MESSAGE`
* `HUMEAI_INSTRUCTIONS`
* `HUMEAI_VOICE_ID`

This mode is useful for quick testing and experimentation.


## Error Handling

The integration includes robust handling for:

* WebSocket connection issues
* Audio streaming errors
* HumeAI API errors
* Session lifecycle failures

Errors are logged to the console for easier debugging.


## Notes & Limitations

* VAD is handled **natively by HumeAI**
* DSAI Core VAD and `INTERRUPT_LISTENING` are ignored in STS mode
* Ensure stable network connectivity for WebSocket streaming
