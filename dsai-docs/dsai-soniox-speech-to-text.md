---
title: Soniox ASR integration
description: 
published: true
date: 2025-12-01T13:37:32.116Z
tags: asr
editor: markdown
dateCreated: 2025-12-01T13:28:05.498Z
---

# Soniox ASR Integration

The **Soniox ASR integration** allows DSAI to leverage **Soniox’s high-accuracy, low-latency real-time speech recognition** via WebSocket streaming.
Soniox is well known for delivering **state-of-the-art transcription quality**, outperforming most cloud providers across noisy environments, accents, and spontaneous speech.

Official website: [https://soniox.com/](https://soniox.com/)
Real-time ASR: [https://soniox.com/docs/stt-realtime](https://soniox.com/docs/stt-realtime)

## Why Use Soniox?

Soniox delivers several strong advantages, making it an excellent ASR choice for real-time voicebots:

### Key Advantages

* **State-of-the-art accuracy** (benchmarks consistently outperforming Google, AssemblyAI, Whisper, etc.)
* **Ultra low latency** real-time transcription via WebSocket
* **Robust in noisy environments**, accents, and spontaneous natural speech
* **Multi-language support** with fast detection and stable recognition
* **Readable formatting**, punctuation insertion, diarization, and timestamping

### Use Cases

* Real-time conversational AI
* Noisy call centers
* Voice assistants requiring high accuracy
* Applications needing instant transcription

## Repository

Clone the official Soniox ASR integration:

```bash
git clone https://github.com/agentvoiceresponse/dsai-asr-soniox.git
```

## Configuration

### Environment Variables

| Variable                             | Description                           | Default                                        | Required |
| ------------------------------------ | ------------------------------------- | ---------------------------------------------- | -------- |
| `SONIOX_API_KEY`                     | Your Soniox API key                   | —                                              | **Yes**  |
| `SONIOX_WEBSOCKET_URL`               | Soniox real-time WebSocket endpoint   | `wss://stt-rt.soniox.com/transcribe-websocket` | Optional |
| `SONIOX_SPEECH_RECOGNITION_MODEL`    | ASR model to use                      | `stt-rt-v3`                                    | Optional |
| `SONIOX_SPEECH_RECOGNITION_LANGUAGE` | Language code or comma-separated list | `en`                                           | Optional |
| `PORT`                               | Local service port                    | `6018`                                         | Optional |

### Example `.env`

```env
SONIOX_API_KEY=your_soniox_api_key
SONIOX_WEBSOCKET_URL=wss://stt-rt.soniox.com/transcribe-websocket
SONIOX_SPEECH_RECOGNITION_MODEL=stt-rt-v3
SONIOX_SPEECH_RECOGNITION_LANGUAGE=en
PORT=6018
```

## Docker Compose Example

```yaml
dsai-asr-soniox:
  image: agentvoiceresponse/dsai-asr-soniox
  platform: linux/x86_64
  container_name: dsai-asr-soniox
  restart: always
  environment:
    - PORT=6018
    - SONIOX_API_KEY=${SONIOX_API_KEY}
    - SONIOX_WEBSOCKET_URL=${SONIOX_WEBSOCKET_URL:-wss://stt-rt.soniox.com/transcribe-websocket}
    - SONIOX_SPEECH_RECOGNITION_MODEL=${SONIOX_SPEECH_RECOGNITION_MODEL:-stt-rt-v3}
    - SONIOX_SPEECH_RECOGNITION_LANGUAGE=${SONIOX_SPEECH_RECOGNITION_LANGUAGE:-en}
  networks:
    - dsai
```

## Integrating with DSAI Core

Set `ASR_URL` in your DSAI Core configuration:

```env
ASR_URL=http://dsai-asr-soniox:6018/speech-to-text-stream
```

Once set, DSAI Core will:

1. Stream real-time audio to Soniox
2. Receive transcriptions via WebSocket
3. Forward them to the LLM
4. Continue the conversation loop (LLM → TTS → Asterisk)


## How It Works Internally

* DSAI receives raw audio chunks from Asterisk via AudioSocket
* The Soniox ASR module opens a WebSocket session with the Soniox Real-Time API
* Audio is continuously streamed with millisecond latency
* Soniox returns partial and final transcripts
* The module streams results back to DSAI Core in the DSAI-compatible ASR protocol

## Performance Tips

* For best accuracy, choose the **`stt-rt-v3`** model (default)
* Increase resilience in noisy environments by using Soniox’s noise-robust models
* Ensure stable network connectivity—WebSocket models require uninterrupted streaming

## Additional Resources

* Soniox Real-Time Documentation: [https://soniox.com/docs/stt-realtime](https://soniox.com/docs/stt-realtime)
* Soniox Model Overview: [https://soniox.com/models](https://soniox.com/models)
* DSAI Integration Repo: [https://github.com/agentvoiceresponse/dsai-asr-soniox](https://github.com/agentvoiceresponse/dsai-asr-soniox)
