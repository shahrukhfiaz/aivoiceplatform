---
title: Using DSAI with a Custom MCP Server
description: 
published: true
date: 2025-09-25T10:03:52.429Z
tags: 
editor: markdown
dateCreated: 2025-09-25T10:03:52.429Z
---

# Using DSAI Wiki with a Custom MCP Server

ChatGPT supports integration with **custom MCP (Model Context Protocol) servers**, allowing you to extend ChatGPT’s capabilities with your own documentation or APIs.  

This feature makes it possible to query the **Agent Voice Response Wiki** directly from ChatGPT, without manually browsing the documentation.

---

## Why Use an MCP Server?

- 📖 Access DSAI documentation directly inside ChatGPT  
- ⚡ Save time if you don’t want to search manually  
- 🧑‍💻 Ask in natural language (e.g. *“Show me an example docker-compose with DSAI and OpenAI Realtime”*)  
- 🔗 Always stay aligned with the latest documentation  

---

## DSAI Wiki MCP Server

We’ve exposed the MCP server for the DSAI Wiki at:

👉 **https://wikimcp.agentvoiceresponse.com/mcp**

This server allows ChatGPT to fetch real-time answers directly from the DSAI documentation.

---

## How to Configure MCP in ChatGPT

1. Open **ChatGPT** → go to **Settings → Beta features**.  
   - Enable **Custom GPTs** and **MCP Servers**.  

2. Go to **Settings → MCP Servers**.  

3. Add a new server:  
   - **Name**: `DSAI Wiki MCP`  
   - **Endpoint**: `https://wikimcp.agentvoiceresponse.com/mcp`  

4. Save the configuration.  

5. Start a new chat — ChatGPT will now be able to query the DSAI Wiki via the MCP server.

---

## Example Queries

Once configured, you can ask ChatGPT things like:

- *“How can I configure the docker-compose file to work with Agent Voice Response and OpenAI Realtime?”*  
- *“What are the environment variables for Gemini STS?”*  
- *“How do I integrate DSAI with VitalPBX?”*  

ChatGPT will return the correct answer from the DSAI documentation.

---

## Benefits

- 🕒 **Faster onboarding** — new users can ask ChatGPT instead of reading through the docs manually  
- 🧑‍💻 **Developer productivity** — answers in natural language, instantly  
- ✅ **Always accurate** — responses are sourced from the official DSAI Wiki  

---

## Troubleshooting

- If ChatGPT doesn’t return results:  
  - Verify MCP server URL: `https://wikimcp.agentvoiceresponse.com/mcp`  
  - Make sure **MCP servers are enabled** in ChatGPT settings  
  - Restart the chat session after adding the server  