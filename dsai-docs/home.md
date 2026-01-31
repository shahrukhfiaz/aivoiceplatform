---
title: Overview
description: 
published: true
date: 2025-09-29T15:27:16.656Z
tags: 
editor: markdown
dateCreated: 2025-05-01T18:04:55.946Z
---

# Digital Storming AI (DSAI)

Digital Storming AI (commonly abbreviated DSAI) is a conversational AI platform that integrates with the open-source PBX Asterisk to replace traditional IVR (Interactive Voice Response) systems using AI-driven voice interactions. It acts as a voicebot, transcribing speech, generating responses through large language models (LLMs), and synthesizing speech back to callers.

## Overview

DSAI offers a Docker-based deployment enabling organizations to integrate automatic speech recognition (ASR), large language models (LLM), text-to-speech (TTS), and direct speech-to-speech (STS) in voice calling systems. It supports a **flexible, provider-agnostic architecture**, allowing integration with both cloud services and local/open-source providers.  

**Examples of supported providers include:**  
- **Cloud services:** Google, Deepgram, OpenAI, Anthropic  
- **Local / open-source options:** Vosk ASR, Kokoro TTS, CoquiTTS, Ollama LLM  

A key part of DSAI's design is its **intelligent audio handling**:  
- **Voice Activity Detection (VAD):** Ensures responsive and natural turn-taking during calls, allowing users to interrupt the agent smoothly  
- **Noise Handling & Ambient Sounds:** Enables background noise management for realistic or adaptive environments  
- **Speech-to-Speech (STS) Mode:** Delivers real-time voice-to-voice conversations without intermediate text processing

## Features

- **Modular AI Components:** Swappable ASR, LLM, TTS, and STS blocks via HTTP APIs, including support for local providers like Vosk, Kokoro, CoquiTTS, and Ollama  
- **Voice Activity Detection (VAD):** Enables natural interruption and fast turn-taking  
- **Noise & Ambient Sound Control:** Background audio simulation and noise reduction  
- **Dockerized Microservices:** Each core service runs isolated in containers for scalability  
- **Support for Function-Calling:** Integration with OpenAI and Anthropic assistive features  
- **Speech-to-Speech Mode (STS):** Direct voice transformation using providers like OpenAI Realtime, Ultravox, or Deepgram  
- **Multi-language & Custom Voices:** Configurable voice personalities and multilingual support

## Architecture

- **Core Service:** Orchestrates voice input/output via Asterisk and AudioSocket  
- **ASR Service:** Transcribes caller audio into text (supports cloud and local providers like Vosk)  
- **LLM Service:** Generates conversational responses (supports OpenAI, Anthropic, Ollama)  
- **TTS Service:** Converts responses back to speech (supports cloud and local engines like Kokoro, CoquiTTS)  
- **STS Service:** (Optional) Provides direct speech-to-speech mode for ultra-low latency  
- **VAD & Noise Engine:** Handles voice activity detection and background noise simulation  
- **Web GUI:** (Under development) for deployment management  
- **Asterisk Integration:** Communication via SIP and AudioSocket

## Deployment

The `dsai-infra` GitHub repository provides Docker Compose templates integrating DSAI Core, Asterisk, and configurable ASR/LLM/TTS/STS stacks.  
Supported combinations include:  
- **Cloud providers:** Deepgram + OpenAI, Google + OpenRouter, ElevenLabs + Anthropic  
- **Local / open-source providers:** Vosk + Ollama + CoquiTTS  
- **Full voice pipelines:** OpenAI Realtime, Ultravox  

## Use and Community

- **Installation:** DSAI can be deployed on any system running Docker and Asterisk (v18+ with AudioSocket) or on Asterisk-based platforms such as **FreePBX**, **VitalPBX** or **Vicidial**. Users register a SIP client and call a defined extension to interact with the AI agent.  
- **Licensing:** DSAI is free for personal and commercial use. The core DSAI source remains proprietary, while the infrastructure and integration repositories are fully open-source.  
- **Contributions:** The community is active on [Discord](https://discord.com/invite/MUd3y7eGVF), and the project accepts donations via [Ko-fi](https://ko-fi.com/agentvoiceresponse).  

## GitHub Repositories

For a complete list of DSAI repositories, please refer to the GitHub page: [https://github.com/orgs/agentvoiceresponse/repositories](https://github.com/orgs/agentvoiceresponse/repositories).  

You can search the repositories by keywords such as **ASR**, **LLM**, **TTS**, **STS**, etc., to find the specific modules and integrations you need.