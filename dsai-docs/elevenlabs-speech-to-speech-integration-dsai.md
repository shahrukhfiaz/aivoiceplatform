---
title: ElevenLabs Speech To Speech Integration
description: 
published: true
date: 2025-12-18T08:32:16.697Z
tags: 
editor: markdown
dateCreated: 2025-09-05T16:53:25.321Z
---

# ElevenLabs Speech-to-Speech Integration

The Digital Storming AI (DSAI) platform supports integration with **ElevenLabs Speech-to-Speech (STS)**, enabling high-quality, real-time conversational AI. ElevenLabs is well known for its natural and expressive voices, making it an excellent choice for creating human-like conversational agents.

## Why Use ElevenLabs STS?

- **Natural, Human-like Voices** — Industry-leading voice quality.
- **Real-time Streaming** — Low-latency audio generation for fluid conversations.
- **Flexible Integration** — Seamless integration with DSAI Core via AudioSocket.
- **Private Agents Support** — Use public or private/custom ElevenLabs agents.
- **Tool (Function Call) Support** — Native support for DSAI tools and custom actions.

## Configuration

### Environment Variables

| Variable | Description | Example Value |
|--------|-------------|---------------|
| `PORT` | Port on which the ElevenLabs STS service runs | `6035` |
| `ELEVENLABS_AGENT_ID` | Static ElevenLabs Agent ID | `your_agent_id` |
| `ELEVENLABS_AGENT_URL` | HTTP endpoint returning the agent ID dynamically | `https://your-api.com/agent` |
| `ELEVENLABS_API_KEY` | API key (only required for private agents) | `sk-xxxx` |

> ⚠️ If `ELEVENLABS_AGENT_URL` is set, it overrides `ELEVENLABS_AGENT_ID`.

## Dynamic Agent Loading

When `ELEVENLABS_AGENT_URL` is configured, DSAI will dynamically resolve the agent to use per call.

- DSAI performs an HTTP **GET** request
- Header included:
  ```
  X-DSAI-UUID: <session-uuid>
  ```
- Expected response:
  ```json
  {
    "system": "your_elevenlabs_agent_id"
  }
  ```

This enables per-session routing, personalization, and advanced business logic.

## Example: Dynamic Agent Loader Web Service (Node.js)

When using `ELEVENLABS_AGENT_URL`, DSAI expects an HTTP endpoint that returns the **ElevenLabs Agent ID** to use for the current session.

This section shows a **minimal Node.js + Express** example that you can use as a starting point.

### How It Works

- DSAI performs an HTTP **GET** request to the configured `ELEVENLABS_AGENT_URL`
- The request includes the session identifier in the header:

X-DSAI-UUID: 

- The web service must respond with a JSON object containing a `system` field set to the **ElevenLabs Agent ID**

### Minimal Node.js Example

```js
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/agent', (req, res) => {
// You can access the DSAI session UUID here if needed
const dsaiUuid = req.headers['x-dsai-uuid'];

// Example: return a static agent ID
res.json({
    system: 'agent_'
  });
});

app.listen(port, () => {
	console.log(`Agent resolver listening on port ${port}`);
});
```

### Configuration in DSAI

Point DSAI to your service using the environment variable:

```env
ELEVENLABS_AGENT_URL=http://your-agent-service:3000/agent
```

When this variable is set, DSAI will ignore `ELEVENLABS_AGENT_ID` and resolve the agent dynamically for each call.

### Advanced Use Cases

This approach enables powerful scenarios such as:

- Selecting different agents based on:
- Caller number
- Time of day
- Language
- Campaign or queue
- Multi-tenant setups
- A/B testing voice agents
- Personalized customer experiences

You can implement any business logic you want before returning the agent ID.

## ⚠️ Important Audio Configuration (Required)

Before using this integration, configure your **ElevenLabs Agent** with the correct audio settings.

### TTS Output Format
- Go to **Agent → Voice Settings**

![11labs-0.png](/images/elevenlabs/11labs-0.png)

- Set **TTS Output Format** to **PCM 8000 Hz**

![11labs-1.png](/images/elevenlabs/11labs-1.png)

### User Input Audio Format
- Go to **Advanced**
- Set **User Input Audio Format** to **PCM 8000 Hz**

![11labs-2.png](/images/elevenlabs/11labs-2.png)

These settings are mandatory for proper compatibility with DSAI.

---

## Tools (Function Calls)

ElevenLabs STS supports **DSAI tools**, enabling the AI to trigger telephony actions.

### Default Tools

- **`dsai_transfer`** — Transfers the call to another extension.
- **`dsai_hangup`** — Gracefully ends the call.

Custom tools are also supported.

> 📘 See full documentation:  
> https://wiki.agentvoiceresponse.com/en/dsai-function-calls

---

## Declaring Tools in ElevenLabs UI

Unlike OpenAI or Gemini, tools must be explicitly declared in the ElevenLabs web interface.

### Adding a Tool

1. Open your ElevenLabs agent
2. Go to **Tools**
3. Click **Add Tool**

![11labs-tools-1.png](/images/elevenlabs/11labs-tools-1.png)

Repeat this process for default and custom tools.

### Configuring `dsai_transfer`

- **Name**: `dsai_transfer`
- **Description**:
  Transfers the call to a designated internal extension when the user requests to speak with an internal operator or be redirected to another extension.
- **Wait for response**: Enabled
- **Execution mode**: Post Speech

![11labs-tools-2.png](/images/elevenlabs/11labs-tools-2.png)

### Configuring `dsai_hangup`

- **Name**: `dsai_hangup`
- **Description**:
  Ends the call when the customer explicitly says goodbye or no further action is required.
- **Wait for response**: Not required
- **Execution mode**: Post Speech (recommended)

![11labs-tools-3.png](/images/elevenlabs/11labs-tools-3.png)

## Docker Compose Example

```yaml
dsai-sts-elevenlabs:
  image: agentvoiceresponse/dsai-sts-elevenlabs
  platform: linux/x86_64
  container_name: dsai-sts-elevenlabs
  restart: always
  environment:
    - PORT=6035
    - ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY
    - ELEVENLABS_AGENT_ID=$ELEVENLABS_AGENT_ID
    # - ELEVENLABS_AGENT_URL=$ELEVENLABS_AGENT_URL
    - AMI_URL=${AMI_URL:-http://dsai-ami:6006}
  # volumes: # uncomment if you want to use the custom tools
  #   - ./tools:/usr/src/app/tools
  networks:
    - dsai

dsai-core:
  image: agentvoiceresponse/dsai-core
  platform: linux/x86_64
  container_name: dsai-core
  restart: always
  environment:
    - PORT=5001
    - STS_URL=ws://dsai-sts-elevenlabs:6035
  ports:
    - 5001:5001
  networks:
    - dsai
```

---

## References

- **GitHub Repository**: https://github.com/agentvoiceresponse/dsai-sts-elevenlabs
- **DSAI Infra Example**: https://github.com/agentvoiceresponse/dsai-infra/blob/main/docker-compose-elevenlabs.yml
- **Function Calls Documentation**: https://wiki.agentvoiceresponse.com/en/dsai-function-calls
