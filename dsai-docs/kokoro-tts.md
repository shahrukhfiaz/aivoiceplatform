---
title: Kokoro TTS
description: 
published: true
date: 2025-09-13T14:47:51.916Z
tags: 
editor: markdown
dateCreated: 2025-09-13T14:47:47.370Z
---

# Kokoro TTS Integration

**Kokoro** is a fast, lightweight, and open-source **text-to-speech (TTS) engine** that can be deployed locally.  
This makes it an excellent choice when you want **full control**, **reduced latency**, or the ability to run **offline without cloud dependencies**.  

DSAI integrates seamlessly with Kokoro to provide natural, customizable voices directly inside your telephony infrastructure.  
An example configuration is available in the [docker-compose-local.yml](https://github.com/agentvoiceresponse/dsai-infra/blob/main/docker-compose-local.yml) file in the `dsai-infra` repository.

---

## Advantages of Using Kokoro

- **Local Deployment** → Run fully offline, ideal for on-premise or privacy-sensitive setups  
- **Performance** → Optimized for speed, with real-time synthesis on CPU and even better on GPU  
- **Customizable** → Control voice model and speech speed  
- **Cost-effective** → No external API costs, once deployed it runs on your own hardware  
- **Easy Integration** → Simple REST API compatible with DSAI TTS microservice

---

## Configuration

### Environment Variables

| Variable          | Description                                    | Example Value              |
|-------------------|------------------------------------------------|----------------------------|
| `PORT`            | Port where the Kokoro TTS service listens       | `6012`                     |
| `KOKORO_BASE_URL` | Base URL of your Kokoro server                  | `http://dsai-kokoro:8880`   |
| `KOKORO_VOICE`    | Voice model to use                             | `af_alloy`                 |
| `KOKORO_SPEED`    | Speaking rate (1.0 = normal, >1 faster, <1 slower) | `1.3`                      |

Example `.env` file:
```bash
PORT=6012
KOKORO_BASE_URL=http://dsai-kokoro:8880
KOKORO_VOICE=af_alloy
KOKORO_SPEED=1.3
```

### Docker Compose Example

```yaml
dsai-kokoro:
  image: ghcr.io/remsky/kokoro-fastapi-cpu
  container_name: dsai-kokoro
  restart: always
  ports:
    - 8880:8880
  networks:
    - dsai

dsai-tts-kokoro:
  image: agentvoiceresponse/dsai-tts-kokoro
  platform: linux/x86_64
  container_name: dsai-tts-kokoro
  restart: always
  environment:
    - PORT=6012
    - KOKORO_BASE_URL=http://dsai-kokoro:8880
    - KOKORO_VOICE=af_alloy
    - KOKORO_SPEED=1.3
  networks:
    - dsai
```

You can test Kokoro directly from its built-in web UI:

```
http://localhost:8880/web/
```

### How It Works

1.	DSAI sends text input to the dsai-tts-kokoro microservice.
2.	The service forwards the request to the Kokoro server.
3.	Kokoro generates the speech audio at 24kHz.
4.	DSAI automatically downsamples it to 8kHz PCM to be compatible with Asterisk AudioSocket.
	5.	The audio is streamed back in 320-byte chunks for real-time playback.

### Example Test with cURL

```bash
curl -X POST http://localhost:6012/text-to-speech-stream \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello, welcome to Agent Voice Response with Kokoro TTS!"}' \
     --output response.raw
```
The resulting response.raw file will contain PCM audio (8kHz, 16-bit, mono).

### Best Practices

- Use GPU builds of Kokoro for large-scale or real-time scenarios.
- Adjust KOKORO_SPEED for faster or slower speech without retraining models.
- Combine Kokoro with local ASR (Vosk) and local LLM (Ollama) for a fully offline voicebot.

### Repository

- GitHub: [dsai-tts-kokoro](https://github.com/agentvoiceresponse/dsai-tts-kokoro)
