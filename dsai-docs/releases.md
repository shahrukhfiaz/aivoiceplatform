---
title: Release Notes
description: List of new features, bug fixes and improvement
published: true
date: 2025-12-18T08:10:36.284Z
tags: 
editor: markdown
dateCreated: 2025-08-08T16:52:47.453Z
---

> 21 December 2025
> {.is-info}
{.is-info}

🎉 Big Update: ElevenLabs STS Just Got Even More Powerful! 🎉

We’re excited to announce two major new features for the ElevenLabs Speech-to-Speech integration in Agent Voice Response 👇

🧠 1️⃣ Tool (Function Call) Support

ElevenLabs STS now fully supports DSAI tools 🎯

You can use built-in tools like:
	•	dsai_transfer → transfer the call to another extension
	•	dsai_hangup → gracefully end the call

…and of course, you can define your own custom tools to connect your voice agents to business logic, CRMs, workflows, and more.

⚠️ Important: unlike OpenAI or Gemini, tools must also be declared in the ElevenLabs web UI under the Tools tab.

🔀 2️⃣ Dynamic Agent Loading (ELEVENLABS_AGENT_URL)

We’ve added a brand-new variable that lets you select the ElevenLabs agent dynamically per call:

👉 ELEVENLABS_AGENT_URL

DSAI will call your endpoint (passing the session UUID) and load the agent returned by your service.
This enables:
	•	per-call agent routing
	•	personalized agents
	•	advanced business logic and multi-tenant setups

📚 Full documentation and step-by-step setup here:
👉 https://wiki.agentvoiceresponse.com/en/elevenlabs-speech-to-speech-integration-dsai

This update unlocks a huge amount of flexibility for real-time voice agents with ElevenLabs 🚀

> 14 December 2025
> {.is-info}
{.is-info}

🔥 New Speech-to-Speech Integration Released: HumeAI + DSAI! 🔥

Hi @everyone , as promised, we’ve just released a brand-new Speech-to-Speech integration for Agent Voice Response, and it’s a very exciting one: HumeAI STS 🎉

This integration enables real-time voice-to-voice conversations with a strong focus on emotional intelligence and natural interaction, without passing through the classic ASR → LLM → TTS pipeline.

Why HumeAI?
    •    🧠 Emotion-aware conversational responses
    •    ⚡ Low-latency, real-time Speech-to-Speech
    •    🗣️ Native voice generation (no external TTS)
    •    🔌 WebSocket streaming, ideal for live conversations
    •    🎭 Config-driven personas (voice, behavior, instructions)

If you’d like to try it out, you can find the full documentation and setup guide here:
👉 https://wiki.agentvoiceresponse.com/en/using-humeai-sts-with-dsai

> 30 November 2025
> {.is-info}
{.is-info}

🚀 New Release: Soniox Speech-to-Text Integration Now Available!

Hi @everyone !
We’re excited to announce that the Soniox Speech-to-Text integration for AgentVoiceResponse is now officially released! 🎉

https://github.com/agentvoiceresponse/dsai-asr-soniox

This integration allows DSAI to use Soniox’s high-quality ASR engine within the Asterisk-based AI contact-center pipeline (ASR → LLM → TTS). If you want to set it up or learn how it works under the hood, we’ve published full documentation here:

👉 https://wiki.agentvoiceresponse.com/en/dsai-soniox-speech-to-text

> 22 November 2025
> {.is-info}
{.is-info}

🔥 **New Feature Announcement: `OPENAI_VOICE` + a New Way to Configure Instructions!** 🔥

Hey everyone!
We just introduced a brand-new variable for the OpenAI Realtime integration:

### 🎤 `OPENAI_VOICE`

You can now choose from multiple OpenAI realtime voices (`alloy`, `ash`, `echo`, `marin`, `cedar`, and more) directly from your DSAI environment settings. This makes it super easy to switch between voice personalities without touching any code.

But here’s the exciting part…
While testing this new variable, I discovered an even **more powerful way to configure persona instructions**, giving you full control over:

* affect (energetic, calm, cheerful…)
* tone (friendly, authoritative, empathetic…)
* pacing
* emotional depth
* pauses
* pronunciation clarity

…and basically anything that defines **how your AI should sound**.

I’ve added several **ready-to-use instruction templates** (sports commentator, support agent, navigation guide, etc.) here:

👉 [https://wiki.agentvoiceresponse.com/en/using-openai-realtime-sts-with-dsai#configuring-openai-realtime-instructions](https://wiki.agentvoiceresponse.com/en/using-openai-realtime-sts-with-dsai#configuring-openai-realtime-instructions)

This unlocks a *huge* amount of creative potential. Your DSAI agents can now sound exactly the way you imagine them.

Can’t wait to see the voice personas you build! 🎉
Feel free to share your experiments or ask for help! 🙌

> 2 November 2025
> {.is-info}
{.is-info}

:rocket: **Fresh changelog drop** for today — lots of exciting updates to make your AI calls even more natural :point_down:

### :speaking_head: Barge-in / Interruption Control with VAD

* We’ve now documented how to handle AI agent interruptions using the `INTERRUPT_LISTENING` variable.
Details: https://wiki.agentvoiceresponse.com/en/understanding-dsai-core#enabling-vad-in-dsai-core
* Added full documentation for **VAD variables** (thresholds, frames, Silero model, etc.).
Details: https://wiki.agentvoiceresponse.com/en/overview-noise-and-vad
* Improved **dsai-core documentation** with a complete list of all environment variables.
Details: https://wiki.agentvoiceresponse.com/en/understanding-dsai-core#environment-variables-summary

### :new: dsai-sts-deepgram **v1.2.0**

* By popular demand: **function calls/tools are now enabled by default** :tada:
Available out of the box: `dsai_transfer` and `dsai_hangup`.
More info: https://wiki.agentvoiceresponse.com/en/dsai-function-calls
* :wrench: Don’t forget to update your `docker-compose-deepgram.yml`:
* Add your AMI URL:
```
    - AMI_URL=${AMI_URL:-http://dsai-ami:6006}
```
* (Optional) Mount your **custom tools**:
```
# volumes: # uncomment if you want to use the custom tools
#   - ./tools:/usr/src/app/tools
```

> 14 September 2025
> {.is-info}
{.is-info}

🚀 Release dsai-core 1.9.0 – DTMF Support (only for Asterisk v22+)! 🎉

We’re excited to announce that DSAI now supports DTMF!
With version 1.9.0, every DTMF digit pressed by the user is captured and forwarded in different ways:

🔹 Webhook Event (https://wiki.agentvoiceresponse.com/en/webhook-integration-guide#dtmf_digit)
Each digit is sent to the configured webhook_URL as an event:
```
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "dtmf_digit",
  "timestamp": "2024-01-01T12:02:15.000Z",
  "payload": {
    "digit": "1|2|3|..."
  }
}
```
🔹 Message to the LLM
The pressed digit is also forwarded to the LLM in this format:
```
{ "role": "user", "content": "1|2|3|..." }
```
Where content contains the actual digit (1, 2, 3, etc.).

🔹 STS (Speech-to-Speech) Integration (https://wiki.agentvoiceresponse.com/en/dsai-sts-integration-implementation#h-23-dtmf_digit-event-dtmf-digit)
If you’re using STS, the digit is sent as a WebSocket event:
```
{ "type": "dtmf_digit", "digit": "1|2|3|..." }
```
 This makes it possible to combine voice input with keypad input in the same conversational flow, enabling hybrid voice + DTMF menus.

Happy testing, and share your feedback! 💬

> 13 September 2025
> {.is-info}
{.is-info}

We’re excited to announce two major updates that many of you have been asking for:

## 1. Webhooks are here! 🎉

DSAI Core now provides comprehensive webhook support for real-time event tracking and integration with external systems.

**Guide**: [webhook-integration-guide](/webhook-integration-guide)

### Supported Event Types:
- **call_started** → Call initiation
- **call_ended** → Call termination
- **transcription** → STT result { role, text }
- **interruption** → User interruption
- **error** → Error occurred { message }

### Implementation Examples
We’ve also released a GitHub repo to help you get started fast:
🔗 https://github.com/agentvoiceresponse/dsai-webhook

Use cases? Endless: Call Analytics, CRM Integration, Quality Assurance, and more!

## 2. Audio flow with AudioSocket() & Dial(AudioSocket/)

DSAI now supports alaw, ulaw, and slin16 codecs for better integration with Asterisk.

👉 Details: https://wiki.agentvoiceresponse.com/en/audio-codec-support

--- 

🔥 Both updates open up huge possibilities for building even more powerful, flexible, and real-time AI voice agents.

> 6 September 2025
> {.is-info}
{.is-info}

We’re releasing a new way to load prompt instructions (only dsai-sts-openai).

As DSAI projects get more and more complex, we decided to implement a dynamic instruction loading mode. Here’s how it works:

# Instruction Loading Methods

The application supports three different methods for loading AI instructions, with a specific priority order:

**1. Environment Variable (Highest Priority)**
Set the OPENAI_INSTRUCTIONS environment variable with your custom instructions:

```
OPENAI_INSTRUCTIONS="You are a specialized customer service agent for a tech company. Always be polite and helpful."
```
**2. Web Service (Medium Priority)**
If no environment variable is set, the app can fetch instructions from a web service using the OPENAI_URL_INSTRUCTIONS environment variable:

```
OPENAI_URL_INSTRUCTIONS="https://your-api.com/instructions"
```

The web service should return a JSON response with a system field containing the instructions:

```json
{
  "system": "You are a helpful assistant that provides technical support."
}
```
The application will include the session UUID in the request headers as X-DSAI-UUID for personalized instructions.

**3. File (Lowest Priority)**
If neither env var nor web service is configured, the app can load instructions from a local file using OPENAI_FILE_INSTRUCTIONS:

```
OPENAI_FILE_INSTRUCTIONS="./instructions.txt"
```

The file should contain plain text instructions that will be used as the system prompt.

--- 

📖 Updated docs: https://wiki.agentvoiceresponse.com/en/using-openai-realtime-sts-with-dsai


> 6 September 2025
> {.is-info}
{.is-info}

Lots of updates to share, so buckle up 🎉

🔹 Spoiler revealed!
We’ve just released the very first dsai-sts-elevenlabs integration 🗣️➡️🗣️
This means you can now leverage ElevenLabs for speech-to-speech with:
    •    Much more natural and realistic voices
    •    Lower latency in voice generation
    •    A wide variety of expressive voices and styles

👉 How many of you have been waiting for this? 😎
More details here: https://wiki.agentvoiceresponse.com/en/elevenlabs-speech-to-speech-integration-dsai

🔹 But that’s not all!
This week we’re also rolling out updates for dsai-sts-openai and dsai-sts-gemini with full tools support 🛠️
I’ve prepared a guide on how to use tools and even implement your own custom function calls:
https://wiki.agentvoiceresponse.com/en/dsai-function-calls

🔹 Core improvements 💥 💥 💥 💥 💥 💥 💥 
We noticed some latency with HTTP streaming between dsai-core and dsai-sts, so we rewrote the communication layer using WebSockets. 😅 
This brings:
    •    Zero latency audio streaming
    •    Support for user/agent interruptions via WebSocket events

Updated docs on events here:
https://wiki.agentvoiceresponse.com/en/dsai-sts-integration-implementation

⚙️ In your dsai-core Docker, update:
- STS_URL=ws://dsai-sts-openai:6030

instead of
- STS_URL=http://dsai-sts-openai:6030/speech-to-speech-stream


No worries—HTTP stream is still backward compatible, but we strongly recommend switching to WebSockets ASAP.
Official integrations (OpenAI, Ultravox, Deepgram, ElevenLabs, Gemini) are already converted. HTTP stream code will no longer be maintained.

🔹 Infra update
We’ve refreshed all URLs in dsai-infra—Docker Compose examples are already updated.

The result? Conversations are now way more natural and seamless. We’re really happy with how it feels. 
Oh, almost forgot—docs have also been updated:
    •    https://wiki.agentvoiceresponse.com/en/using-openai-realtime-sts-with-dsai
    •    https://wiki.agentvoiceresponse.com/en/using-gemini-sts-with-dsai

> 31 August 2025
> {.is-info}
{.is-info}

We just released a new version of dsai-sts-openai 1.4.0! 🚀

In this release, We’ve improved the downsample and upsample handling using a library we found online: @alexanderolsen/libsamplerate-js. The audio quality seems much better now, but we’d love to hear your thoughts.

---

We are super excited to announce the release of dsai-sts-gemini v1.0.0 https://github.com/agentvoiceresponse/dsai-sts-gemini 
From now on, you can integrate AgentVoiceResponse directly with Gemini! ✨

👉 What’s new and why it’s awesome?
    •    Native speech-to-speech integration with Gemini.
    •    Faster and more natural conversations powered by Gemini’s models.
    •    Even more flexibility to choose the AI provider that best fits your use case.

📌 I’ve also added a brand-new example (Example 10) to the dsai-infra project:
🔗 https://github.com/agentvoiceresponse/dsai-infra?tab=readme-ov-file#example-10-gemini-speech-to-speech

📖 Full documentation is available here:
🔗 https://wiki.agentvoiceresponse.com/en/using-gemini-sts-with-dsai

> 24 August 2025
> {.is-info}
{.is-info}

We’ve just released a new version of dsai-core (1.6.0) with support for **ambient background noise** 🎉
You can find the documentation on how to use it here:
👉 [using-ambient-background-noise-in-dsai](/using-ambient-background-noise-in-dsai)

With this feature, DSAI can simulate more realistic environments, making your tests and demos feel much closer to real-world conditions.

At the same time, We’ve also released dsai-infra (1.3.0), which now includes an ambient_sounds directory. For now, it contains one sample file: office_background.raw (RAW format).
In the documentation, you’ll also find an example using SoX to convert WAV to RAW, but you can also use other tools like ffmpeg, etc.

Here’s an example of how to configure it in your docker-compose.yml:
```yaml
dsai-core:
  image: agentvoiceresponse/dsai-core
  platform: linux/x86_64
  container_name: dsai-core
  restart: always
  environment:
    - PORT=5001 
    - STS_URL=http://dsai-sts-deepgram:6033/speech-to-speech-stream
    - AMBIENT_NOISE_FILE=ambient_sounds/office_background.raw
    - AMBIENT_NOISE_LEVEL=0.90
  volumes:
    - ./ambient_sounds:/usr/src/app/ambient_sounds
  ports:
    - 5001:5001
  networks:
    - dsai
```

We’ve also released the first version of dsai-llm-n8n (1.0.0) 🎉 → https://github.com/agentvoiceresponse/dsai-llm-n8n

<div align="center">
  <img src="/images/n8n/n8n.png" alt="FreePBX" width="300"/>
</div>

Integrating DSAI with n8n allows you to build AI-powered voicebots with visual workflows and direct integration with DSAI.

I’ve also published a docker-compose example with Deepgram as ASR & TTS and n8n as LLM here:
👉 https://github.com/agentvoiceresponse/dsai-infra/blob/main/docker-compose-n8n.yml

And here you can find the official documentation, including a basic example of an AI Agent configured on n8n:
👉 https://wiki.agentvoiceresponse.com/en/using-dsai-with-n8n

You can of course use your own n8n, but if you don’t have a local or cloud instance, the docker-compose I shared also includes an n8n service that will be installed together with the other containers.

Have fun! 🚀 I’ve already tested some cool integrations with Google Calendar, Google Sheets, CRM systems, etc. — and they work really well.

Thanks in advance to anyone who wants to share their own workflow! We could even create a dedicated wiki section for community use cases.

> 22 August 2025
> {.is-info}
{.is-info}

📢 Update on DSAI-STS-ULTRAVOX integration

The dsai-sts-ultravox integration now supports not only creating calls with a configurable Agent ID (from the UI) but also creating a generic call via prompt 🎉.

In the README you’ll find details on how to configure both modes:
    •    Agent mode (default, nothing has changed here)
    •    Generic mode (enabled by setting *ULTRAVOX_CALL_TYPE=generic*)

When using generic mode, you’ll need to configure the following variables:
```
ULTRAVOX_SYSTEM_PROMPT: System prompt for the AI (default: "You are a helpful AI assistant.")
ULTRAVOX_TEMPERATURE: AI temperature setting (default: 0)
ULTRAVOX_MODEL: AI model to use (default: "fixie-ai/ultravox")
ULTRAVOX_VOICE: Voice to use (default: "alloy")
ULTRAVOX_RECORDING_ENABLED: Enable call recording (default: false)
ULTRAVOX_JOIN_TIMEOUT: Join timeout (default: "30s")
ULTRAVOX_MAX_DURATION: Maximum call duration (default: "3600s")
```
🙏 Thanks everyone for the support and contributions — more updates coming soon!

> 13 August 2025
> {.is-info}
{.is-info}

:rocket: Big thanks to @mirkuz93  for contributing the Deepgram Speech-to-Speech integration for DSAI — dsai-sts-deepgram! :tada:
Code is here: https://github.com/agentvoiceresponse/dsai-sts-deepgram
Docker Compose example: Example 8 – Deepgram Speech-to-Speech https://github.com/agentvoiceresponse/dsai-infra?tab=readme-ov-file#example-8-deepgram-speech-to-speech

:bulb: Super easy to use:
:one: Generate your Deepgram API key (or reuse the one from your ASR/TTS integration).
:two: Configure your .env file:
```
PORT=6033
DEEPGRAM_API_KEY=
AGENT_PROMPT=
```
:gear: Extra config for ASR, LLM & TTS models:
```
DEEPGRAM_SAMPLE_RATE=   # default: 8000
DEEPGRAM_ASR_MODEL=     # default: nova-3
DEEPGRAM_TTS_MODEL=     # default: aura-2-thalia-en
DEEPGRAM_GREETING=
OPENAI_MODEL=           # default: gpt-4o-mini
```

> 8 August 2025
> {.is-info}
{.is-info}


🚀 New DSAI-Core Release: v1.5.6 is out!

We’ve just released a new version of dsai-core (v1.5.5) with a small but powerful update:
🔹 Every HTTP request now includes a X-UUID header!
You can retrieve it easily from your **STS** and **ASR** services like this:
```
const handleAudioStream = async (req, res) => {
  const uuid = req.headers['x-uuid'];
  console.log('Received UUID:', uuid);
...
```
⚙️ I’ve also released a new version of dsai-sts-ultravox (v.1.1.1), which now grabs the UUID and injects it into the metadata (see attach). This means… you can now use it directly inside your tools!

🧩 Feel free to share any cool tool examples with the community on #dsai-self-hosting — we’d love to see what you build.

Have fun and happy hacking! 🎧🧠✨
Thanks @everyone  and see you soon! 👋

> 3 August 2025
{.is-info}


🚀 New Release: STS Ultravox.ai & STS OpenAI Realtime 🛠️
Hi @everyone !
I’ve just released a new version of STS Ultravox.ai with significantly improved audio quality. I’d love to hear your feedback!

I’ve also published an update to STS OpenAI Realtime, which now includes a VAD-based interruption mechanism 🧠🎙️. Let me know how it works for you!

Have a great day and happy building!

> 2 August 2025
{.is-info}


🔥 Big Update Today! 🔥

Hey @everyone ! Hope you’re all doing great — Today I’m dropping a bunch of cool stuff for you to try out 👇


---


🤖 DSAI - STS now works with **Ultravox.ai**!

Yup, it’s here! First working integration between DSAI and **Ultravox.ai** 🎯
🛠️ GitHub repo:
https://github.com/agentvoiceresponse/dsai-sts-ultravox

🧪 Test it right away with a ready-made Docker setup:
https://github.com/agentvoiceresponse/dsai-infra → docker-compose-ultravox.yml

🔑 Quick start:
    1.    Sign up on https://www.ultravox.ai
    2.    Create your agent (set language, welcome message, etc.)
    3.    Generate your API key
    4.    Edit your .env:

ULTRAVOX_AGENT_ID=your_agent_id  
ULTRAVOX_API_KEY=your_api_key

✅ That’s it — your voice agent is live!


---


🧠 New: Audio Resampler Library!

To make all this smoother, I’ve built a brand new audio resampling library — super light, reusable across projects, and optimized for STS!

🔗 GitHub:
https://github.com/agentvoiceresponse/dsai-resampler

📦 NPM:
https://www.npmjs.com/package/dsai-resampler

Check out the README for setup and examples. It’s already being used in production!


---


🎧 Better audio in dsai-sts-openai

I’ve also updated dsai-sts-openai with the new resampler.
💡 Audio is cleaner, tighter — still room for improvement, but it’s a nice step forward.
I’ll keep tweaking it in the next few days!


---


💬 As always, I’d love your feedback, suggestions, bug reports, crazy ideas — bring it all.
Thank you for being part of this 🚀
Let’s keep building!

> 13 June 2025
{.is-info}


🧠 dsai-vad v1.0-7
    •    Fix: Improved VAD (Voice Activity Detection) compatibility with 8000Hz 16bit PCM audio. Detection is now more accurate and stable.

---
 dsai-core v1.5.0
    1.    VAD Integration
We’ve integrated the dsai-vad library into dsai-core. This allows instant interruption of the Agent AI when speech is detected.
➤ Be sure to set:

INTERRUPT_LISTENING=false

This ensures ASR keeps listening, even during user interruptions.
Default VAD parameters:
```env
positiveSpeechThreshold: process.env.VAD_POSITIVE_SPEECH_THRESHOLD || 0.08,
negativeSpeechThreshold: process.env.VAD_NEGATIVE_SPEECH_THRESHOLD || 0.03,
minSpeechFrames: process.env.VAD_MIN_SPEECH_FRAMES || 3,
preSpeechPadFrames: process.env.VAD_PRE_SPEECH_PAD_FRAMES || 3,
redemptionFrames: process.env.VAD_REDEMPTION_FRAMES || 8,
frameSamples: process.env.VAD_FRAME_SAMPLES || 512,
sampleRate: 8000,
model: process.env.VAD_MODEL || "v5"
```
More info in the dsai-vad README.

2. AudioSocket Dial Support

You can now scale your DSAI project to handle multiple channels using the native Dial() app with AudioSocket:

```env
exten => 5001,1,Answer()
exten => 5001,n,Ringing()
exten => 5001,n,Wait(1)
exten => 5001,n,Set(UUID=${SHELL(uuidgen | tr -d '\n')})
exten => 5001,n,Dial(AudioSocket/dsai-core:5001/${UUID})
exten => 5001,n,Hangup()
```

3. Assistant Text Cleanup Fixes
	• In handleText, we now clean 【】 tags across chunk boundaries before sentence splitting.
  • In cleanText, the 【】 cleanup was removed, as it’s now handled upstream.

→ This ensures tags like "【document.t" + "xt】" are correctly removed once fully received.

---

dsai-infra v1.2.0
    •    Update: Substituted the legacy AudioSocket application with the new Dial(AudioSocket) syntax.
→ More aligned with dsai-core 1.5.0 and scalable setups.





