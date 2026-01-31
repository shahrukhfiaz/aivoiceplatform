---
title: Using DSAI with N8N
description: 
published: true
date: 2025-08-26T13:01:47.378Z
tags: 
editor: markdown
dateCreated: 2025-08-26T11:02:33.190Z
---

# Using DSAI with n8n (AI Workflow Integration)

<div align="center">
  <img src="/images/n8n/n8n.png" alt="FreePBX" width="300"/>
</div>

Integrating DSAI with [n8n](https://n8n.io) allows you to build **AI-powered voicebots** with visual workflows and direct integration with DSAI.  
This integration is powered by the [dsai-llm-n8n](https://github.com/agentvoiceresponse/dsai-llm-n8n) connector.

---

## Environment Variables

| Variable         | Description                                           | Example Value                                     |
|------------------|-------------------------------------------------------|---------------------------------------------------|
| `PUBLIC_CHAT_URL`| Your n8n public chat workflow endpoint                | `https://your-n8n-instance.com/webhook/chat`      |
| `PORT`           | Port where the DSAI n8n connector will listen          | `6016`                                            |

Replace `your_n8n_public_chat_endpoint` with your actual n8n public chat workflow URL.

---

## Example docker-compose (DSAI n8n connector)

```yaml
dsai-llm-n8n:
  image: agentvoiceresponse/dsai-llm-n8n
  platform: linux/x86_64
  container_name: dsai-llm-n8n
  restart: always
  environment:
    - PORT=6016
    - PUBLIC_CHAT_URL=$PUBLIC_CHAT_URL
  networks:
    - dsai
```

## Example with local n8n

In the dsai-infra project, you can find a complete example of how to integrate n8n with DSAI.
The compose file includes both the DSAI n8n connector and a local instance of n8n:
```yaml
dsai-n8n:
  image: n8nio/n8n:latest
  container_name: dsai-n8n
  environment:
    - GENERIC_TIMEZONE=Europe/Amsterdam
    - NODE_ENV=production
    - N8N_SECURE_COOKIE=false
  ports:
    - 5678:5678
  volumes:
    - ./n8n:/home/node/.n8n
  networks:
    - dsai
```

> If you already have an n8n installation (either in the cloud or on another server), you can comment out the dsai-n8n section.
> {.is-info}
{.is-warning}


> If you use the local installation, first create an account by providing email, first name, last name, and password, then continue with the setup below.
![user.png](/images/n8n/user.png)
{.is-info}

## Step-by-step Setup AI Voicebot

![workflow.png](/images/n8n/workflow.png)

### 1. Start with a Chat Trigger
In n8n, create a new workflow with a Chat Trigger node.
Enable “Make Chat Publicly Available” and copy the **Chat URL** to use in **PUBLIC_CHAT_URL**.

![trigger.png](/images/n8n/trigger.png)

### 2.	Connect the Chat Trigger to an AI Agent node
Choose whether to use a Conversational Agent or a Tools Agent depending on your workflow needs.

![ai-agent.png](/images/n8n/ai-agent.png)

### 3.	Add your Chat Model
Insert an AI Chat Model node (e.g., OpenAI, Anthropic, etc.).
Configure temperature, max tokens, and model according to your application.

![openai-model.png](/images/n8n/openai-model.png)

### 4.	Enable Memory
Add a memory node (e.g., buffer memory) for context-aware conversations.
Use the chat session ID from the Chat Trigger as the session key.

![simple-memory.png](/images/n8n/simple-memory.png)

### 5.	Add Tools like SerpAPI

Extend your workflow with additional nodes like SerpAPI, databases, or custom APIs.

![serpapi-apikey.png](/images/n8n/serpapi-apikey.png)

![serpapi.png](/images/n8n/serpapi.png)





