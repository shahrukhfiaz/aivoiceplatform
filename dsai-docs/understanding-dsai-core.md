---
title: Understanding DSAI Core
description: 
published: true
date: 2025-11-06T18:18:37.526Z
tags: asr, tts, asterisk, dsai-core, architecture, integration, voip, llm, sts
editor: markdown
dateCreated: 2025-09-30T11:07:10.215Z
---

# DSAI Core

The **Digital Storming AI (DSAI) Core** is the real-time orchestrator that connects your PBX (Asterisk via **AudioSocket**) with AI services. It replaces rigid IVRs with **conversational voicebots** by streaming audio in, routing it to **ASR / LLM / TTS** (or a single **STS** provider), and streaming synthesized audio back to callers with minimal latency.

## Overview

DSAI Core manages live call media and conversation state:

1. **ASR (Automatic Speech Recognition)** — transcribes caller audio to text.  
2. **LLM (Large Language Model)** — reasons on the transcript + context to produce a reply.  
3. **TTS (Text-to-Speech)** — renders the reply as audio back to the caller.  
4. **STS (Speech-to-Speech)** — optional *single-hop* pipeline: speech in → speech out (bypasses ASR/LLM/TTS).

DSAI Core is **provider-agnostic**. It talks to modules over **streaming HTTP** (and **WebSocket** for some STS providers), so you can mix-and-match vendors or build your own adapters.

## Call Flows

### ASR → LLM → TTS (text-mediated)
- Asterisk sends RTP audio to DSAI Core via **AudioSocket**.
- Core streams audio chunks to **ASR** (`ASR_URL=/speech-to-text-stream`).
- Final transcript is sent to **LLM** (`LLM_URL=/prompt-stream`).
- LLM reply text is sent to **TTS** (`TTS_URL=/text-to-speech-stream`).
- Core streams the synthesized audio back to Asterisk.

### STS (speech-mediated)
- Asterisk streams audio to Core via **AudioSocket**.
- Core streams speech to **STS** (`STS_URL=WS provider-dependent).
- STS returns synthesized speech; Core streams it back to Asterisk.

> Use **STS** for the lowest latency; use **ASR+LLM+TTS** for maximal control, tools/function-calling, and explainability.

## Features

- **Plug-and-play architecture** — swap ASR/LLM/TTS/STS via URLs.
- **True streaming** end-to-end (AudioSocket ↔ HTTP/WS streams).
- **Multi-codec support** — automatic detection of **μ-law (ulaw)**, **A-law (alaw)**, **Linear PCM (slin16)**.
- **Webhooks** — call lifecycle, interruption, transcription, DTMF events.
- **Ambient noise** — optional background sound mixing for natural feel.
- **VAD (Voice Activity Detection)** — fast turn-taking, barge-in handling.
- **Scalable & modular** — run each component independently (containers).

For ready-made adapters, see the organization repositories:  
**Integrations:** https://github.com/orgs/agentvoiceresponse/repositories

---

## Installation

### 1) Get the infrastructure
Clone **dsai-infra** for Docker Compose templates:
```bash
git clone https://github.com/agentvoiceresponse/dsai-infra
cd dsai-infra
```

### 2) Configure environment
Set the relevant variables in your `.env` (examples below). Core will use either **ASR+LLM+TTS** *or* **STS** depending on what you set.

#### Core (text-mediated)
```env
ASR_URL=http://dsai-asr-*:6010/speech-to-text-stream
LLM_URL=http://dsai-llm-*:6002/prompt-stream
TTS_URL=http://dsai-tts-*:6012/text-to-speech-stream
```

#### Core (speech-mediated)
```env
STS_URL=ws://dsai-sts-*:6033
# When STS_URL is set, comment out ASR_URL / LLM_URL / TTS_URL.
```

Optional:
```env
WEBHOOK_URL=https://yourapp.example.com/dsai-webhook
WEBHOOK_SECRET=supersecret
WEBHOOK_TIMEOUT=3000
WEBHOOK_RETRY=0

AMBIENT_NOISE_FILE=ambient_sounds/office_background.raw
AMBIENT_NOISE_LEVEL=0.50  # 0.0–1.0
```

### 3) Example docker-compose (Core only)
```yaml
dsai-core:
  image: agentvoiceresponse/dsai-core
  platform: linux/x86_64
  container_name: dsai-core
  restart: always
  environment:
    - PORT=5001
    # Choose either ASR+LLM+TTS ...
    # - ASR_URL=http://dsai-asr-deepgram:6010/speech-to-text-stream
    # - LLM_URL=http://dsai-llm-openai:6002/prompt-stream
    # - TTS_URL=http://dsai-tts-kokoro:6012/text-to-speech-stream
    # ... or STS
    # - STS_URL=ws://dsai-sts-openai:6030
    # Optional webhooks & ambient noise
    - WEBHOOK_URL=${WEBHOOK_URL}
    - WEBHOOK_SECRET=${WEBHOOK_SECRET}
    - AMBIENT_NOISE_FILE=ambient_sounds/office_background.raw
    - AMBIENT_NOISE_LEVEL=0.10
  volumes:
    - ./ambient_sounds:/usr/src/app/ambient_sounds
  ports:
    - 5001:5001
  networks:
    - dsai
```

## Asterisk Integration

DSAI Core connects over **AudioSocket**. You can integrate via the **AudioSocket() application** or the **Dial(AudioSocket/…)** channel interface.

### Option A — `AudioSocket()` (simple, auto-transcoding to slin16)
```asterisk
[dsai]
exten => 5001,1,Answer()
 same => n,Ringing()
 same => n,Wait(1)
 same => n,Set(UUID=${SHELL(uuidgen | tr -d '\n')})
 same => n,AudioSocket(${UUID},IP_DSAI_CORE:5001)
 same => n,Hangup()
```
**Pros:** Asterisk will transcode incoming audio to **slin16** (what Core expects), minimizing codec issues.

### Option B — `Dial(AudioSocket/...)` (scalable, but codec-sensitive)
```asterisk
[dsai]
exten => 5001,1,Answer()
 same => n,Ringing()
 same => n,Wait(1)
 same => n,Set(UUID=${SHELL(uuidgen | tr -d '\n')})
 same => n,Dial(AudioSocket/IP_DSAI_CORE:5001/${UUID})
 same => n,Hangup()
```
**Note:** With `Dial(AudioSocket/...)` Asterisk passes the **native endpoint codec** (e.g., Opus if your softphone uses Opus).  
If Core receives an unsupported codec, the call may drop immediately. Restrict endpoint codecs in `pjsip.conf`:
```ini
[endpoint-template](!)
type=endpoint
disallow=all
allow=alaw        ; or 'ulaw' or 'slin16'
```

**Debug tip**
```bash
asterisk -rx "core show channel AudioSocket/IP:PORT-XXXX"
```
Check `ReadFormat` is `slin` (or a supported G.711). If you see `opus`, restrict codecs as above **or** prefer `AudioSocket()`.

## Webhook Integration

DSAI Core can POST events to your app for monitoring and automation.

**Events**
- `call_started` — a new call session begins  
- `call_ended` — the call ends  
- `interruption` — user barges in / interrupts TTS  
- `transcription` — transcript item available (also in STS mode if exposed)  
- `dtmf_digit` — DTMF received

**Payload**
```json
{
  "uuid": "call-session-uuid",
  "type": "event_type",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "payload": { /* event-specific */ }
}
```

**Config**
```env
WEBHOOK_URL=https://yourapp.example.com/hooks/dsai
WEBHOOK_SECRET=optional-shared-secret
WEBHOOK_TIMEOUT=3000
WEBHOOK_RETRY=0
```

## Audio Codec Support

DSAI Core **auto-detects** the inbound codec (μ-law, A-law, slin16) from the first packets, logs the detection, decodes to **internal 8 kHz / 16-bit mono PCM**, and re-encodes for outbound streaming.  

**Best practices**
- Keep codecs consistent end-to-end (prefer **alaw/ulaw/slin16**).  
- Avoid Opus on the AudioSocket leg unless Asterisk transcodes to slin16.  
- Monitor logs: you’ll see `Audio codec detected: ALAW/ULAW/SLIN`.

## Ambient Noise & VAD

### Ambient Noise

DSAI Core supports the use of **ambient background sounds** to make conversations feel more natural and lifelike.  
You can mount a directory containing `.raw` audio files and reference one in your configuration.  
Each file must be **raw PCM**, **mono**, **16-bit**, and **8 kHz** sample rate.

```env
AMBIENT_NOISE_FILE=ambient_sounds/office_background.raw
AMBIENT_NOISE_LEVEL=0.10
````

This feature helps reduce perceived silence during pauses and can simulate environments like offices or call centers.
All related variables are listed in the [**Environment Variables (Summary)**](#environment-variables-summary) section.

### Voice Activity Detection (VAD)

DSAI Core includes a built-in **Voice Activity Detection (VAD)** engine powered by *Silero VAD*.
It continuously analyzes the incoming audio stream to detect when the caller is speaking or silent,
allowing the system to **trigger faster responses** and enable natural **barge-in** — where the caller can interrupt the AI mid-sentence.

You can fine-tune the sensitivity, detection thresholds, and timing behavior of VAD using the dedicated `VAD_*` environment variables, detailed in the [**Environment Variables (Summary)**](#environment-variables-summary) section.

### Enabling VAD in DSAI Core

The **Voice Activity Detection (VAD)** feature in DSAI Core is enabled and controlled through the environment variable `INTERRUPT_LISTENING`.

```env
INTERRUPT_LISTENING=false
````

At first glance, this variable name can be misleading — it originates from early DSAI Core versions where it was used to *temporarily stop* the ASR stream to prevent interruptions while the TTS response was being played.

#### Behavior Summary

| Setting                     | Description                                                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERRUPT_LISTENING=true`  | Disables continuous ASR streaming — the ASR stops listening while the TTS response is playing. The user cannot interrupt the AI mid-sentence.                                                               |
| `INTERRUPT_LISTENING=false` | Keeps the ASR stream active — **VAD is automatically enabled**, allowing callers to naturally interrupt or “barge in” during the AI’s speech. This is the recommended setting for conversational voicebots. |

When `INTERRUPT_LISTENING=false`, DSAI Core uses its **integrated VAD engine based on [Silero VAD](https://github.com/agentvoiceresponse/dsai-vad)** to manage speech activity detection in real time.

> ⚠️ **Important:**
> VAD control applies **only** to the **ASR + LLM + TTS** architecture.
> STS providers (e.g., OpenAI Realtime, Gemini, Ultravox) implement their own built-in VAD, so this setting is ignored when `STS_URL` is configured.


This ensures the ASR remains active during TTS playback and leverages the integrated Silero VAD for natural, responsive conversations.

## Environment Variables (Summary)

| Variable | Purpose | Example / Notes |
|-----------|----------|----------------|
| `PORT` | Core listen port | `5001` |
| `ASR_URL` | ASR streaming endpoint | `http://dsai-asr-*:6010/speech-to-text-stream` |
| `LLM_URL` | LLM streaming endpoint | `http://dsai-llm-*:6002/prompt-stream` |
| `TTS_URL` | TTS streaming endpoint | `http://dsai-tts-*:6012/text-to-speech-stream` |
| `STS_URL` | STS streaming endpoint (HTTP/WS) | `http://dsai-sts-*:6033/speech-to-speech-stream` |
| `WEBHOOK_URL` | Webhook receiver | `https://yourapp/hook` |
| `WEBHOOK_SECRET` | Signature secret (header: `X-DSAI-WEBHOOK-SECRET`) | Optional |
| `WEBHOOK_TIMEOUT` | Webhook request timeout (ms) | `3000` |
| `WEBHOOK_RETRY` | Retries for failed webhooks | `0` |
| `AMBIENT_NOISE_FILE` | Ambient PCM file (8 kHz, mono, 16-bit) | `ambient_sounds/office_background.raw` |
| `AMBIENT_NOISE_LEVEL` | Ambient volume (0.0–1.0) | `0.10` |
| `INTERRUPT_LISTENING` | Controls ASR stream interruption and VAD activation. When `false`, ASR remains active and VAD is enabled (recommended). When `true`, ASR stops during TTS playback. | `false` |
| `VAD_POSITIVE_SPEECH_THRESHOLD` | Probability threshold above which speech is detected | `0.08` |
| `VAD_NEGATIVE_SPEECH_THRESHOLD` | Probability threshold below which silence is detected | `0.03` |
| `VAD_MIN_SPEECH_FRAMES` | Minimum consecutive frames required to confirm speech | `3` |
| `VAD_PRE_SPEECH_PAD_FRAMES` | Frames included before detected speech | `3` |
| `VAD_REDEMPTION_FRAMES` | Frames after speech ends before marking silence | `8` |
| `VAD_FRAME_SAMPLES` | Number of audio samples per frame | `512` |
| `VAD_MODEL` | Model version used by Silero VAD | `v5` |

## Performance & Scaling

- **Latency:** Use STS for ultra-low latency; otherwise keep ASR/LLM/TTS local to minimize network hops.  
- **CPU:** Transcoding (G.711 ↔ slin) costs CPU; prefer consistent codecs.  
- **Horizontal scale:** Run multiple Core instances behind a TCP load balancer; scale ASR/LLM/TTS/STS independently.  
- **Monitoring:** Tail Core logs for codec detection and stream timing; add webhooks to feed analytics/QA.

---

## Troubleshooting

- **Immediate hang-up:** Likely codec mismatch (e.g., Opus). Use `AudioSocket()` or restrict endpoint codecs to `alaw/ulaw/slin16`.  
- **“No audio received / unsupported format”:** Verify Asterisk channel `ReadFormat`.  
- **Long delays:** Check ASR/LLM/TTS response times; consider smaller models or local providers.  
- **Webhook timeouts:** Increase `WEBHOOK_TIMEOUT` or ensure your endpoint responds < 3s.
