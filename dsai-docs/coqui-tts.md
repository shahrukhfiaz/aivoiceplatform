---
title: Coqui TTS
description: 
published: true
date: 2025-12-15T08:43:32.081Z
tags: 
editor: markdown
dateCreated: 2025-09-13T14:54:56.595Z
---


**Coqui TTS** is an open-source, high-quality **text-to-speech engine** built on deep learning.  
It provides natural-sounding voices and supports multiple languages, making it a great option for **local deployments** where flexibility and privacy are priorities.  

![coquitts.png](/images/coquitts/coquitts.png)

# Coqui TTS Integration

DSAI integrates with CoquiTTS to enable real-time speech synthesis inside your telephony infrastructure.

## Advantages of Using CoquiTTS

- **Open Source** → No vendor lock-in, free to customize  
- **Local Deployment** → Runs fully on your own hardware, ideal for privacy-sensitive use cases  
- **Multi-language Support** → Large selection of pre-trained voice models available  
- **Flexible Models** → Choose from different architectures (VITS, FastPitch, Tacotron2, etc.)  
- **Custom Voices** → Train your own voices with open datasets  

## Configuration

### Environment Variables

| Variable | Description                          | Example Value |
|----------|--------------------------------------|---------------|
| `PORT`   | Port where the CoquiTTS service runs | `6032`        |

Example `.env` file:
```bash
PORT=6032
```

### Docker Compose Example

Below is a sample configuration using DSAI with CoquiTTS:

```yaml
dsai-tts-coquitts:
  image: agentvoiceresponse/dsai-tts-coquitts
  platform: linux/x86_64
  container_name: dsai-tts-coquitts
  restart: always
  environment:
    - PORT=6032
    - COQUI_AI_TTS_URL=http://dsai-coqui-ai-tts:5002/api/tts
  ports:
    - 6032:6032
  networks:
    - dsai

dsai-coqui-ai-tts:
  image: ghcr.io/coqui-ai/tts-cpu
  platform: linux/x86_64
  container_name: dsai-coqui-ai-tts
  entrypoint: "python3 TTS/server/server.py --model_name tts_models/en/vctk/vits"
  restart: always
  environment:
    - PORT=5002
  ports:
    - 5002:5002
  networks:
    - dsai
```

**Notes**:
- dsai-tts-coquitts acts as the DSAI microservice wrapper.
- dsai-coqui-ai-tts runs the official Coqui TTS server with a selected model.
- You can replace tts_models/en/vctk/vits with any supported model from Coqui TTS models.

### How It Works

1.	DSAI sends text requests to dsai-tts-coquitts.
2.	The request is forwarded to the running Coqui TTS server (dsai-coqui-ai-tts).
3.	Coqui synthesizes speech using the selected model.
4.	The output is downsampled to 8kHz PCM for compatibility with Asterisk AudioSocket.
5.	DSAI streams audio back to the caller in 320-byte chunks for real-time playback.

### Example Test with cURL

```bash
curl -X POST http://localhost:6032/text-to-speech-stream \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello, this is CoquiTTS running with Agent Voice Response!"}' \
     --output response.raw
```

The resulting response.raw file will contain PCM audio at 8kHz.

### Best Practices

- Test different Coqui models (tts_models/...) to find the best trade-off between latency and voice quality.
- Run with GPU acceleration for production or real-time scenarios.
- Keep your models directory mounted as a Docker volume to avoid re-downloading on container restarts.

## Community & Support

- GitHub: [dsai-tts-coquitts](https://github.com/agentvoiceresponse/dsai-tts-coquitts)