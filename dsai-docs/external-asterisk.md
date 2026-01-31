---
title: External Asterisk
description: Using DSAI with External Asterisk PBX
published: true
date: 2025-08-20T23:20:15.260Z
tags: asterisk, pbx
editor: markdown
dateCreated: 2025-08-08T16:44:58.314Z
---

# Using DSAI with External Asterisk PBX

<div align="center">
  <img src="/images/asterisk.png" alt="Asterisk" width="300"/>
</div>

This guide explains how to configure **Asterisk PBX** so that calls are sent to **DSAI Core** via the AudioSocket channel driver.

## Prerequisites

Before proceeding, ensure you have:

- A working **Asterisk PBX** installation.
- The **AudioSocket channel driver** installed and enabled in Asterisk.
- The IP address and port of your **DSAI Core** instance (e.g., `192.168.1.100:6000`).
- The `uuidgen` command available on your system (usually pre-installed on Linux).

## Editing `extensions.conf`

Asterisk dial plans are configured in the `extensions.conf` file.  
By default, this file is located in:

```
/etc/asterisk/extensions.conf
```

## Basic Configuration

**Option 1 – Direct AudioSocket Connection:**
```asterisk
same => n,AudioSocket(${UUID},IP_DSAI_CORE:PORT_DSAI_CORE)`
```

**Option 2 – Recommended for scalability (Dial syntax):**

```asterisk
same => n,Dial(AudioSocket/IP_DSAI_CORE:PORT_DSAI_CORE/${UUID})
```

The Dial method is recommended because it integrates better with Asterisk’s native call handling, enabling more flexible call routing and scalability.

## Example: extensions.conf

Below is a minimal working example that answers a call, generates a UUID, and connects it to DSAI Core.

```env
[dsai-context]
exten => 5001,1,Answer()
 same => n,Ringing()
 same => n,Wait(1)
 same => n,Set(UUID=${SHELL(uuidgen | tr -d '\n')})
 same => n,Dial(AudioSocket/IP_DSAI_CORE:PORT_DSAI_CORE/${UUID})
 same => n,Hangup()
```
 
Explanation:
- exten => 5001,1,Answer() → Answers the incoming call.
- Wait(1) → Adds a short delay to ensure the call is stable before connecting.
- Set(UUID=...) → Creates a unique identifier for the session, used by DSAI Core to track the call.
- Dial(...) → Connects to DSAI Core using AudioSocket.
- Hangup() → Ends the call when DSAI Core terminates the session.

## Reloading Asterisk

After editing extensions.conf, reload the Asterisk dialplan:

```bash
asterisk -rx "dialplan reload"
```

## Testing

1. Dial 5001 (or the extension you configured) from any endpoint connected to your Asterisk PBX.
2. The call should route to DSAI Core and start interacting via your configured ASR/LLM/TTS or STS modules.
3. Check Asterisk logs for troubleshooting:

```bash
asterisk -rvvvvv
```
  
> **Tip**: For production deployments, you may want to place DSAI Core on a dedicated network interface or behind a load balancer for better scalability.
  
