---
title: Overview: Noise and VAD
description: 
published: true
date: 2025-11-02T10:41:56.997Z
tags: 
editor: markdown
dateCreated: 2025-08-26T09:52:43.102Z
---

# Overview: Noise & VAD

Learn how **Digital Storming AI (DSAI)** intelligently handles **background noise** and **voice activity detection (VAD)** to create natural, responsive, real-time voice conversations.

Voice Activity Detection and ambient noise handling are fundamental components that determine how natural and human-like the caller experience feels. DSAI provides a **multi-layered audio pipeline** that works out of the box but is also highly configurable for advanced tuning.

---

## Our Philosophy: Smart Defaults

DSAI is designed with **smart, adaptive defaults** so that most installations work perfectly without manual configuration.

We believe:
- 🕒 **Latency matters** → Voice conversations must feel instantaneous.  
- 🧠 **Intelligent models compensate** → Neural VAD (Silero) and noise control manage false positives and interruptions.  
- 🗣️ **Context is key** → Conversation state determines when the user is truly done speaking.

By default, DSAI activates **VAD automatically** and applies **light ambient noise** mixing to improve the listening experience.

---

## Ambient Noise

DSAI Core supports optional **background sound blending** to make AI conversations sound more natural and reduce the “dead air” effect between responses.

### Configuration

Mount your folder containing ambient sound files inside the Core container, and specify a file in `.env`:

```env
AMBIENT_NOISE_FILE=ambient_sounds/office_background.raw
AMBIENT_NOISE_LEVEL=0.10
````

* **Format:** raw PCM, mono, 16-bit, 8 kHz
* **Noise level:** set between `0.0` (mute) and `1.0` (max volume)

Example:

* `0.10` → soft ambient background
* `0.50` → moderate environment noise
* `0.90` → high ambient presence

👉 All related variables are listed in the [Environment Variables (Summary)](#environment-variables-summary) section.

---

## Voice Activity Detection (VAD)

DSAI Core includes an integrated **Silero VAD** engine that continuously analyzes the audio stream to detect when a user is speaking or silent.
This enables:

* **Fast response triggering**
* **Natural “barge-in”** — callers can interrupt AI speech
* **Efficient audio processing** with less unnecessary streaming

### Enabling and Controlling VAD

VAD activation is controlled via the `INTERRUPT_LISTENING` variable:

```env
INTERRUPT_LISTENING=false
```

#### Behavior Summary

| Setting                     | Description                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERRUPT_LISTENING=true`  | Disables continuous ASR listening. The ASR temporarily stops during TTS playback — the user cannot interrupt the AI mid-sentence.                                          |
| `INTERRUPT_LISTENING=false` | Keeps the ASR stream active and **enables VAD automatically**. The integrated Silero VAD continuously detects speech and silence, allowing the user to barge in naturally. |

> ⚠️ **Note:**
> The `INTERRUPT_LISTENING` variable applies **only** to the **ASR + LLM + TTS** architecture.
> When using **STS providers** (like OpenAI Realtime, Gemini STS, Ultravox), VAD is handled **internally by the provider**, and this configuration has no effect.

---

## VAD Tuning Parameters

For advanced tuning, DSAI exposes several `VAD_*` environment variables based on **Silero VAD**. These allow fine-grained control over speech sensitivity, latency, and robustness.

| Variable                        | Description                                           | Default | Recommendation                      |
| ------------------------------- | ----------------------------------------------------- | ------- | ----------------------------------- |
| `VAD_POSITIVE_SPEECH_THRESHOLD` | Probability threshold above which speech is detected  | `0.08`  | Lower = more sensitive              |
| `VAD_NEGATIVE_SPEECH_THRESHOLD` | Probability threshold below which silence is detected | `0.03`  | Higher = stricter silence detection |
| `VAD_MIN_SPEECH_FRAMES`         | Minimum consecutive frames required to confirm speech | `3`     | Lower = faster response             |
| `VAD_PRE_SPEECH_PAD_FRAMES`     | Frames included before detected speech                | `3`     | Keeps word beginnings intact        |
| `VAD_REDEMPTION_FRAMES`         | Frames after speech ends before marking silence       | `8`     | Prevents early cutoff               |
| `VAD_FRAME_SAMPLES`             | Audio samples per frame                               | `512`   | Fixed for 8kHz audio                |
| `VAD_MODEL`                     | Model version used by Silero VAD                      | `v5`    | Recommended: latest stable version  |

### Example `.env` configuration

```env
INTERRUPT_LISTENING=false
VAD_POSITIVE_SPEECH_THRESHOLD=0.08
VAD_NEGATIVE_SPEECH_THRESHOLD=0.03
VAD_MIN_SPEECH_FRAMES=3
VAD_PRE_SPEECH_PAD_FRAMES=3
VAD_REDEMPTION_FRAMES=8
VAD_FRAME_SAMPLES=512
VAD_MODEL=v5
```

---

## When to Customize VAD

The default configuration works well for most telephony environments.
However, fine-tuning may be beneficial in specific cases:

| Environment                          | Suggested Adjustment                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| **Quiet call centers / offices**     | Use defaults — fast, responsive VAD                                      |
| **Noisy environments / open spaces** | Increase both speech thresholds slightly (`+0.02`) for better accuracy   |
| **Latency-sensitive voicebots**      | Lower `VAD_MIN_SPEECH_FRAMES` to `2` for quicker response                |
| **Overly frequent interruptions**    | Raise `VAD_NEGATIVE_SPEECH_THRESHOLD` to make silence detection stricter |

> 💡 Start with small adjustments and test with real call samples to ensure optimal responsiveness and stability.

---

## Architecture Behavior Summary

| Architecture                                           | VAD Behavior                                   | Controlled By                            |
| ------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| **ASR + LLM + TTS**                                    | Integrated VAD via `INTERRUPT_LISTENING=false` | `INTERRUPT_LISTENING`, `VAD_*` variables |
| **STS Providers (OpenAI, Gemini, Ultravox, Deepgram)** | VAD handled natively by provider               | Ignored — built-in provider logic        |

---

## Environment Variables (Summary)

| Variable                        | Purpose                                                  | Default / Example                      |
| ------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| `AMBIENT_NOISE_FILE`            | Path to ambient sound file (raw PCM, mono, 8kHz, 16-bit) | `ambient_sounds/office_background.raw` |
| `AMBIENT_NOISE_LEVEL`           | Background noise volume (0.0–1.0)                        | `0.10`                                 |
| `INTERRUPT_LISTENING`           | Controls ASR stream interruption and VAD activation      | `false`                                |
| `VAD_POSITIVE_SPEECH_THRESHOLD` | Probability threshold for speech detection               | `0.08`                                 |
| `VAD_NEGATIVE_SPEECH_THRESHOLD` | Probability threshold for silence detection              | `0.03`                                 |
| `VAD_MIN_SPEECH_FRAMES`         | Consecutive frames required to confirm speech            | `3`                                    |
| `VAD_PRE_SPEECH_PAD_FRAMES`     | Frames included before detected speech                   | `3`                                    |
| `VAD_REDEMPTION_FRAMES`         | Frames after speech before silence is confirmed          | `8`                                    |
| `VAD_FRAME_SAMPLES`             | Audio samples per frame                                  | `512`                                  |
| `VAD_MODEL`                     | Silero VAD model version                                 | `v5`                                   |

---

## References

* 🔗 [Silero VAD Repository](https://github.com/agentvoiceresponse/dsai-vad)
* 🧩 [Understanding DSAI Core](https://wiki.agentvoiceresponse.com/en/understanding-dsai-core)
* 🔊 [Ambient Sounds Examples](https://github.com/agentvoiceresponse/dsai-infra/tree/main/ambient_sounds)