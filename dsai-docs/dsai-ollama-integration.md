---
title: DSAI Ollama Integration
description: 
published: true
date: 2025-09-16T13:47:38.692Z
tags: 
editor: markdown
dateCreated: 2025-09-16T13:47:38.692Z
---

## DSAI ↔ Ollama Integration

DSAI integrates with [Ollama](https://ollama.com/) using the [dsai-llm-openai](https://github.com/agentvoiceresponse/dsai-llm-openai) connector, since Ollama exposes an **OpenAI-compatible API**.  
This allows you to run local LLMs (like TinyLLaMA, LLaMA 3, Mistral, Phi-2, etc.) directly on your own infrastructure, while keeping the DSAI architecture unchanged.

### Advantages of Using Ollama
- **Local-first** → Run without internet, keeping all data private  
- **Cost Control** → No token-based billing; limited only by your hardware  
- **Model Flexibility** → Use models from [Ollama’s library](https://ollama.com/library) or import your own  
- **OpenAI-Compatible** → Works out of the box with DSAI’s `dsai-llm-openai` integration  
- **Customizable** → Adjust `temperature`, `max_tokens`, and `system_prompt` to tune behavior  

---

### Environment Variables

| Variable             | Description                                   | Example Value                        |
|----------------------|-----------------------------------------------|--------------------------------------|
| `PORT`               | Port where the DSAI LLM adapter runs           | `6002`                               |
| `OPENAI_BASEURL`     | Base URL for Ollama’s OpenAI-compatible API   | `http://dsai-ollama:11434/v1`         |
| `OPENAI_API_KEY`     | API key generated in Ollama WebUI             | `sk-local-12345`                     |
| `OPENAI_MODEL`       | Model to use                                 | `tinyllama`                          |
| `OPENAI_MAX_TOKENS`  | Maximum response tokens                      | `100`                                |
| `OPENAI_TEMPERATURE` | Randomness control (0.0 = deterministic)      | `0.0`                                |
| `SYSTEM_PROMPT`      | Default system instructions                  | `"You are a helpful assistant."`     |

---

### Docker Compose Example

```yaml
dsai-llm-openai:
  image: agentvoiceresponse/dsai-llm-openai
  platform: linux/x86_64
  container_name: dsai-llm-openai
  restart: always
  environment:
    - PORT=6002
    - OPENAI_BASEURL=http://dsai-ollama:11434/v1
    - OPENAI_API_KEY=sk-your-local-key
    - OPENAI_MODEL=tinyllama
    - OPENAI_MAX_TOKENS=${OPENAI_MAX_TOKENS:-100}
    - OPENAI_TEMPERATURE=${OPENAI_TEMPERATURE:-0.0}
    - SYSTEM_PROMPT="You are a helpful assistant."
  networks:
    - dsai

dsai-ollama:
  image: ollama/ollama
  container_name: dsai-ollama
  restart: always
  ports:
    - 11434:11434
  volumes:
    - ./ollama:/root/.ollama
  networks:
    - dsai

dsai-ollama-web:
  image: ghcr.io/open-webui/open-webui
  container_name: dsai-ollama-web
  restart: always
  ports:
    - 3001:8080
  volumes:
    - ./ollama-web:/app/backend/data
  environment:
    - OLLAMA_BASE_URL=http://dsai-ollama:11434
  networks:
    - dsai
 ```
 
## Setup Steps
1.	Start Ollama (dsai-ollama)
2.	Open WebUI at http://localhost:3001
3.	Create an admin account and generate an API key
4.	Download a model (e.g. tinyllama) from Settings → Models
5.	Update OPENAI_MODEL and OPENAI_API_KEY in dsai-llm-openai
6.	Test via WebUI playground or using DSAI call flows

## Example Test with cURL
```bash
curl -X POST http://localhost:6002/prompt-stream \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello, Ollama running with DSAI!"}'
```
## Best Practices

- Use tiny models for responsiveness, larger ones for richer context
- Enable GPU support for real-time performance
- Tune SYSTEM_PROMPT for domain-specific voicebot behavior
- Combine with Vosk (ASR) and Kokoro (TTS) to build a fully local AI voicebot
