---
title: Google ASR and TTS
description: Google Cloud Speech-to-Text (ASR) and Text-to-Speech (TTS) Configuration
published: true
date: 2025-08-26T13:04:28.173Z
tags: asr, tts, google
editor: markdown
dateCreated: 2025-08-11T10:53:39.880Z
---

## Google Cloud ASR and TTS Configuration

### Overview

Google Cloud provides high-quality **Automatic Speech Recognition (ASR)** and **Text-to-Speech (TTS)** services with broad language support and advanced customization options.  

The ASR service (Google Cloud Speech-to-Text) supports **real-time** and **batch** transcription, optimized for various use cases including telephony.  

The TTS service (Google Cloud Text-to-Speech) offers a wide range of voices, languages, and control over speech parameters like speed and pitch.


### Advantages

- **High Accuracy**: Advanced machine learning models optimized for telephony, video, and general-purpose speech.
- **Extensive Language Support**: Dozens of languages and variants supported.
- **Customizable Voices**: Natural-sounding neural voices with adjustable speaking rate and pitch.
- **Secure**: Fully managed on Google Cloud with enterprise-grade security.


### Supported Languages

See the official documentation for:
- [Speech-to-Text supported languages](https://cloud.google.com/speech-to-text/docs/languages)
- [Text-to-Speech supported languages and voices](https://cloud.google.com/text-to-speech/docs/voices)


### Generating Google Cloud Credentials (`google.json`)

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **new project** or select an existing one.
3. Enable the APIs:
   - [Speech-to-Text API](https://console.cloud.google.com/apis/library/speech.googleapis.com)
   - [Text-to-Speech API](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)
4. Go to **APIs & Services → Credentials**.
5. Click **Create credentials → Service account**.
6. Fill in the details and click **Done**.
7. Select your new service account → **Keys → Add Key → Create New Key**.
8. Choose **JSON** and click **Create** — the file will download automatically.
9. Save this file securely and note its path — you will use it in the `GOOGLE_APPLICATION_CREDENTIALS` variable.

## Google ASR Configuration
<br>
<div align="center">
  <img src="/images/google/asr.png" alt="Google ASR" width="300"/>
</div>

### Environment Variables

| Variable                         | Description                                             | Example Value                |
|----------------------------------|---------------------------------------------------------|--------------------------------|
| PORT                             | Port where the ASR module listens                       | 6001                          |
| GOOGLE_APPLICATION_CREDENTIALS   | Path to your Google service account JSON key file       | `/path/to/google.json`        |
| SPEECH_RECOGNITION_LANGUAGE      | Language code for recognition                           | `en-US`                       |
| SPEECH_RECOGNITION_MODEL         | Recognition model (`default`, `telephony`, `video`, etc.)| `telephony`                   |

### Docker Compose Example

```yaml
  dsai-asr-google-cloud-speech:
    image: agentvoiceresponse/dsai-asr-google-cloud-speech
    platform: linux/x86_64
    container_name: dsai-asr-google
    restart: always
    environment:
      - PORT=6001
      - GOOGLE_APPLICATION_CREDENTIALS=/path/to/google.json
      - SPEECH_RECOGNITION_LANGUAGE=en-US
      - SPEECH_RECOGNITION_MODEL=telephony
    volumes:
      - ./google.json:/path/to/google.json
    networks:
      - dsai
```

## Google TTS Configuration

Repository: [dsai-tts-google-speech-tts](https://github.com/agentvoiceresponse/dsai-tts-google-speech-tts)

### Environment Variables

| Variable                         | Description                                             | Example Value                |
|----------------------------------|---------------------------------------------------------|--------------------------------|
| PORT                             | Port where the TTS module listens                       | 6003                          |
| GOOGLE_APPLICATION_CREDENTIALS   | Path to your Google service account JSON key file       | `/path/to/google.json`        |
| TEXT_TO_SPEECH_LANGUAGE          | Language code for TTS                                   | `en-AU`                       |
| TEXT_TO_SPEECH_GENDER            | Voice gender (`MALE`, `FEMALE`, `NEUTRAL`)              | `FEMALE`                      |
| TEXT_TO_SPEECH_NAME              | Specific voice name from Google TTS voices              | `en-AU-Neural2-C`              |
| TEXT_TO_SPEECH_SPEAKING_RATE     | Speaking rate multiplier                                | `1`                           |

### Docker Compose Example

```yaml
  dsai-tts-google-speech-tts:
    image: agentvoiceresponse/dsai-tts-google-speech-tts
    platform: linux/x86_64
    container_name: dsai-tts-google
    restart: always
    environment:
      - PORT=6003
      - GOOGLE_APPLICATION_CREDENTIALS=/path/to/google.json
      - TEXT_TO_SPEECH_LANGUAGE=en-AU
      - TEXT_TO_SPEECH_GENDER=FEMALE
      - TEXT_TO_SPEECH_NAME=en-AU-Neural2-C
      - TEXT_TO_SPEECH_SPEAKING_RATE=1
    volumes:
      - ./google.json:/path/to/google.json
    networks:
      - dsai
```
