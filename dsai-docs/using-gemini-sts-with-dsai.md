---
title: Using Gemini STS with DSAI
description: 
published: true
date: 2025-12-17T08:02:58.174Z
tags: 
editor: markdown
dateCreated: 2025-09-02T13:38:04.526Z
---

# Using Gemini STS with DSAI

<div align="center">
  <img src="/images/gemini/gemini-logo.png" alt="Gemini Logo" width="300"/>
</div>

**Gemini** is Google’s family of multimodal AI models. With the **Gemini Speech-to-Speech (STS)** integration, Digital Storming AI (DSAI) can handle conversations where **speech input is directly transformed into speech output**, without requiring separate ASR (speech-to-text) and TTS (text-to-speech) components.

This approach significantly **reduces latency** and enables more **natural, human-like voice interactions**.



## Why Use Gemini STS?

- **End-to-End Speech Conversations** — Direct speech-to-speech transformation.
- **Low Latency** — Faster than traditional ASR + LLM + TTS pipelines.
- **Multilingual Support** — Supports multiple languages out of the box.
- **Instruction-Tuned** — Fully customizable system prompts.
- **Cloud-Native** — Runs on Google’s scalable and reliable infrastructure.



## Generate API Credentials

To connect DSAI with Gemini, you need a Gemini API key:

1. Open **Google AI Studio**
2. Sign in with your Google account
3. Navigate to **API Keys**
4. Create a new API key
5. Copy and store it securely

You will use this key as `GEMINI_API_KEY` in your Docker environment.



## Repository

- GitHub: https://github.com/agentvoiceresponse/dsai-sts-gemini



## Environment Variables

| Variable | Description | Example Value |
|--------|-------------|---------------|
| `PORT` | Port on which the Gemini STS service runs | `6037` |
| `GEMINI_API_KEY` | API Key from Google AI Studio | `AIza...` |
| `GEMINI_MODEL` | Gemini model ID to use | `gemini-2.5-flash-preview-native-audio-dialog` |
| `GEMINI_INSTRUCTIONS` | System prompt for the voice assistant | `"You are a helpful assistant."` |
| `GEMINI_URL_INSTRUCTIONS` | URL to fetch dynamic instructions | `https://your-api.com/instructions` |
| `GEMINI_FILE_INSTRUCTIONS` | Path to local instruction file | `./instructions.txt` |



## Docker Setup

Add the following service to your `docker-compose.yml`:

```yaml
dsai-sts-gemini:
  image: agentvoiceresponse/dsai-sts-gemini
  platform: linux/x86_64
  container_name: dsai-sts-gemini
  restart: always
  environment:
    - PORT=6037
    - GEMINI_API_KEY=$GEMINI_API_KEY
    - GEMINI_MODEL=$GEMINI_MODEL
    - GEMINI_INSTRUCTIONS=$GEMINI_INSTRUCTIONS
  networks:
    - dsai
```



## Integration with DSAI Core

Configure **dsai-core** to use Gemini STS by setting `STS_URL`:

```yaml
dsai-core:
  image: agentvoiceresponse/dsai-core
  platform: linux/x86_64
  container_name: dsai-core
  restart: always
  environment:
    - PORT=5001
    - STS_URL=ws://dsai-sts-gemini:6037
  ports:
    - 5001:5001
  networks:
    - dsai
```

> ⚠️ When `STS_URL` is configured, `ASR_URL`, `LLM_URL`, and `TTS_URL` must be commented out.



## Instruction Loading Methods

The Gemini STS integration supports **multiple instruction sources** with a clear priority order.

### 1. Environment Variable (Highest Priority)

```env
GEMINI_INSTRUCTIONS="You are a specialized customer service agent for a tech company. Always be polite and helpful."
```

If set, this overrides all other instruction sources.



### 2. Web Service (Medium Priority)

```env
GEMINI_URL_INSTRUCTIONS="https://your-api.com/instructions"
```

Expected response format:

```json
{
  "system": "You are a helpful assistant that provides technical support."
}
```

The request will include the call UUID as an HTTP header:

```
X-DSAI-UUID: <call-uuid>
```

This enables **dynamic, per-call instruction generation**.



### 3. File-Based Instructions (Lowest Priority)

```env
GEMINI_FILE_INSTRUCTIONS="./instructions.txt"
```

The file should contain plain text instructions.



### Instruction Priority Order

1. `GEMINI_INSTRUCTIONS`
2. `GEMINI_URL_INSTRUCTIONS`
3. `GEMINI_FILE_INSTRUCTIONS`
4. Default instructions (fallback)



## Example in DSAI Infra

A ready-to-use example is available in the **dsai-infra** repository:

- `docker-compose-gemini.yml` — Example #10

https://github.com/agentvoiceresponse/dsai-infra



## Performance Notes

- Optimized for real-time, low-latency conversations
- Requires a stable internet connection
- VAD is handled natively by Gemini
- DSAI Core VAD and `INTERRUPT_LISTENING` are ignored in STS mode