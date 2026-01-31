---
title: OpenAI Realtime Speech-to-Speech
description: 
published: true
date: 2026-01-17T11:55:24.800Z
tags: sts, openai
editor: markdown
dateCreated: 2025-09-04T15:05:27.174Z
---

# OpenAI Realtime Speech-to-Speech (STS)

The **OpenAI Realtime STS integration** enables DSAI to leverage OpenAI’s real-time speech-to-speech API.  
This mode provides low-latency voice conversations, with the added benefit of **function calling support** for advanced integrations.  

For more details on function calls, see [DSAI Function Calls](https://wiki.agentvoiceresponse.com/en/dsai-function-calls).

---

## Environment Variables

| Variable              | Description                                           | Example Value                           |
|-----------------------|-------------------------------------------------------|-----------------------------------------|
| PORT                  | Port on which the STS service runs                    | 6030                                    |
| OPENAI_API_KEY        | Your OpenAI API key                                   | sk-xxxxxx                               |
| OPENAI_MODEL          | OpenAI model ID to use                                | gpt-4o-realtime-preview                 |
| OPENAI_VOICE          | Specifies the voice to use for speech synthesis                                | alloy                 |
| OPENAI_LANGUAGE          | Specifies the language to use for speech recognition                                | auto-detected                 |
| OPENAI_INSTRUCTIONS   | # Method 1: Direct variable                       | "You are a helpful assistant."          |
| *OPENAI_URL_INSTRUCTIONS   | # Method 2: Web service                       | https://your-api.com/instructions          |
| *OPENAI_FILE_INSTRUCTIONS   | # Method 3: Local file                       | ./instructions.txt          |
| OPENAI_TEMPERATURE    | Controls randomness in responses (0.0–1.0, default 0.8) | 0.8                                     |
| OPENAI_MAX_TOKENS     | Maximum response length (default: unlimited)          | 100                                     |

---

## Docker Compose Example

```yaml
dsai-sts-openai:
  image: agentvoiceresponse/dsai-sts-openai
  platform: linux/x86_64
  container_name: dsai-sts-openai
  restart: always
  environment:
    - PORT=6030
    - OPENAI_API_KEY=$OPENAI_API_KEY
    - OPENAI_MODEL=gpt-4o-realtime-preview
    - OPENAI_INSTRUCTIONS="You are a helpful assistant."
    - OPENAI_TEMPERATURE=0.8
    - OPENAI_MAX_TOKENS=100
  networks:
    - dsai
```

## Integration with DSAI Core

Update your dsai-core service to point to the OpenAI STS endpoint:

```yaml
dsai-core:
  image: agentvoiceresponse/dsai-core
  platform: linux/x86_64
  container_name: dsai-core
  restart: always
  environment:
    - PORT=5001
    - STS_URL=ws://dsai-sts-openai:6030
  ports:
    - 5001:5001
  networks:
    - dsai
```

### Instruction Loading Methods

The application supports three different methods for loading AI instructions, with a specific priority order:

#### 1. Environment Variable (Highest Priority)
Set the `OPENAI_INSTRUCTIONS` environment variable with your custom instructions:

```bash
OPENAI_INSTRUCTIONS="You are a specialized customer service agent for a tech company. Always be polite and helpful."
```

#### 2. Web Service (Medium Priority)
If no environment variable is set, the application can fetch instructions from a web service using the `OPENAI_URL_INSTRUCTIONS` environment variable:

```bash
OPENAI_URL_INSTRUCTIONS=https://your-api.com/instructions
```

The web service should return a JSON response with a `system` field containing the instructions:
```json
{
  "system": "You are a helpful assistant that provides technical support."
}
```

The application will include the session UUID in the request headers as `X-DSAI-UUID` for personalized instructions.

#### 3. File (Lowest Priority)
If neither environment variable nor web service is configured, the application can load instructions from a local file using the `OPENAI_FILE_INSTRUCTIONS` environment variable:

```bash
OPENAI_FILE_INSTRUCTIONS=./instructions.txt
```

The file should contain plain text instructions that will be used as the system prompt.

# Configuring OpenAI Realtime Instructions

OpenAI Realtime (STS) allows you to fully customize the *voice affect*, *tone*, *emotion*, *pacing*, and overall *personality* of your AI voice agent by using the environment variable **`OPENAI_INSTRUCTIONS`**.

This makes it possible to create highly tailored voice personas: energetic sports commentators, empathetic support agents, navigation guides, and more.

Below is a step-by-step guide on how to configure:

* The **model** (`OPENAI_MODEL`)
* The **voice** (`OPENAI_VOICE`)
* The **speaking personality** (`OPENAI_INSTRUCTIONS`)

---

## 1. Selecting the OpenAI Realtime Model

Set your realtime model using:

```env
OPENAI_MODEL=gpt-realtime
```

This is the recommended default for streaming speech-to-speech interactions.

---

## 2. Choosing a Voice

OpenAI Realtime supports several voice presets.
Set your preferred voice using:

```env
OPENAI_VOICE=alloy
```

### Supported values:

`alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`

You can experiment with each voice to match the agent’s purpose and personality.

---

## 3. Writing Custom Instructions (Persona Tuning)

You can define **exactly how the agent should speak**, including affect, tone, pacing, pronunciation, pauses, and emotional expression.

Set instructions like this:

```env
OPENAI_INSTRUCTIONS="Your custom persona instructions here"
```

Below are **three ready-to-use instruction templates** you can copy directly into your `.env`.

---

## Example Voice Vibes

### 🎙️ Vibe 1 — Energetic Sports Commentator

> **Voice Affect**: Energetic and animated; dynamic with variations in pitch and tone. 
> 
> **Tone**: Excited and enthusiastic, conveying an upbeat and thrilling atmosphere. 
> 
> **Pacing**: Rapid delivery when describing the game or the key moments (e.g., "an overtime thriller," "pull off an unbelievable win") to convey intensity and build excitement. Slightly slower during dramatic pauses to let key points sink in.
> 
> **Emotion**: Intensely focused and excited, giving off positive energy.
> 
> **Personality**: Relatable and engaging.
> 
> **Pauses**: Short, purposeful pauses after key highlights.
{.is-info}

```env
OPENAI_INSTRUCTIONS="Voice Affect: Energetic and animated; dynamic with variations in pitch and tone.\n\nTone: Excited and enthusiastic, conveying an upbeat and thrilling atmosphere. \n\nPacing: Rapid delivery when describing the game or the key moments (e.g., \"an overtime thriller,\" \"pull off an unbelievable win\") to convey the intensity and build excitement.\n\nSlightly slower during dramatic pauses to let key points sink in.\n\nEmotion: Intensely focused, and excited. Giving off positive energy.\n\nPersonality: Relatable and engaging. \n\nPauses: Short, purposeful pauses after key moments in the game."
```

### 🤝 Vibe 2 — Calm, Empathetic Support Agent

> **Voice Affect**: Calm, composed, and reassuring; quiet authority and confidence.
> 
> **Tone**: Sincere, empathetic, and gently authoritative—express genuine apology while conveying competence.
> 
> **Pacing**: Steady and moderate; unhurried enough to communicate care, yet efficient enough to demonstrate professionalism.
> 
> **Emotion**: Deeply empathetic; warm and understanding.
> 
> **Pronunciation**: Clear and precise, emphasizing key reassurances ("smoothly", "quickly", "promptly").
> 
> **Pauses**: Brief pauses after offering help or asking for details, showing willingness to listen.
{.is-info}

```env
OPENAI_INSTRUCTIONS="Voice Affect: Calm, composed, and reassuring; project quiet authority and confidence.\n\nTone: Sincere, empathetic, and gently authoritative—express genuine apology while conveying competence.\n\nPacing: Steady and moderate; unhurried enough to communicate care, yet efficient enough to demonstrate professionalism.\n\nEmotion: Genuine empathy and understanding; speak with warmth, especially during apologies (\"I'm very sorry for any disruption...\").\n\nPronunciation: Clear and precise, emphasizing key reassurances (\"smoothly,\" \"quickly,\" \"promptly\") to reinforce confidence.\n\nPauses: Brief pauses after offering assistance or requesting details, highlighting willingness to listen and support."
```

### 🧭 Vibe 3 — Friendly Navigation Guide

> **Affect/personality**: A cheerful guide.
> 
> **Tone**: Friendly, clear, and reassuring, making the listener feel confident and comfortable.
> 
> **Pronunciation**: Clear and articulated, maintaining a natural conversational rhythm.
> 
> **Pause**: Brief and purposeful pauses after key steps ("cross the street", "turn right") so the listener can follow easily.
> 
> **Emotion**: Warm and supportive, ensuring the listener feels guided and safe.
{.is-info}


```env
OPENAI_INSTRUCTIONS="Affect/personality: A cheerful guide \n\nTone: Friendly, clear, and reassuring, creating a calm atmosphere and making the listener feel confident and comfortable.\n\nPronunciation: Clear, articulate, and steady, ensuring each instruction is easily understood while maintaining a natural, conversational flow.\n\nPause: Brief, purposeful pauses after key instructions (e.g., \"cross the street\" and \"turn right\") to allow time for the listener to process the information and follow along.\n\nEmotion: Warm and supportive, conveying empathy and care, ensuring the listener feels guided and safe throughout the journey."
```

## 4. Full Example Configuration

```env
OPENAI_MODEL=gpt-realtime
OPENAI_VOICE=alloy
OPENAI_INSTRUCTIONS="A cheerful guide who speaks clearly, with warm and supportive tone..."
```

Just update `OPENAI_MODEL`, `OPENAI_VOICE` and `OPENAI_INSTRUCTIONS` depending on your desired agent persona.


## 5. Tips for Designing Effective Vibe Instructions

* Be **explicit**: mention affect, tone, pacing, pronunciation, pauses.
* Keep instructions **consistent** with the voice’s role.
* Avoid contradictions (“fast AND slow pacing”).
* Use **examples** inside the text to shape how the agent should speak.
* Test live — small changes can have big effects.

For a complete example, check the docker-compose-openai-realtime.yml in the [dsai-infra](https://github.com/agentvoiceresponse/dsai-infra) repository.