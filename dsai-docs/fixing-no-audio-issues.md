---
title: Fixing “No Audio” Issues on Cloud Servers
description: 
published: true
date: 2025-12-02T13:30:39.949Z
tags: 
editor: markdown
dateCreated: 2025-12-02T13:27:34.760Z
---

# Fixing “No Audio” Issues on Cloud Servers (DSAI + Asterisk + Docker)

When running DSAI and Asterisk on a cloud VPS (Hetzner, AWS, DigitalOcean, etc.) using Docker, a very common issue is:

> The call connects, but there is no audio (or one-way audio).

In most cases this is caused by an incorrect **NAT / network configuration** in Asterisk’s `pjsip.conf`, especially these fields:

* `external_media_address`
* `external_signaling_address`
* `local_net`

This page explains how to configure them properly in the context of **dsai-infra**.

## File location

In the `dsai-infra` project, the relevant file is:

```text
asterisk/conf/pjsip.conf
```

By default, this file may contain placeholder values such as:

```ini
external_media_address=127.0.0.1
external_signaling_address=127.0.0.1
local_net=127.0.0.1/32
```

These values **must** be updated when running on a public cloud VPS.

## Step 1 – Get your public IP

Run the following command on your VPS:

```bash
curl ipinfo.io/ip
```

Example output (fake but realistic):

```text
95.216.41.122
```

This IP should be used for:

* `external_media_address`
* `external_signaling_address`

## Step 2 – Get your local networks

Next, list your local network interfaces:

```bash
ip addr
```

Example output (simplified and fake but realistic):

```text
lo: 127.0.0.1/8
eth0: 172.31.26.138/20
docker0: 172.17.0.1/16
br-9834d22c1f45: 172.20.0.1/16
```

Each of these networks should be declared in `pjsip.conf` via `local_net`.

## Step 3 – Update `pjsip.conf`

Open:

```text
asterisk/conf/pjsip.conf
```

and update the NAT-related settings:

```ini
; Public IP of your VPS
external_media_address=95.216.41.122
external_signaling_address=95.216.41.122

; Local networks
local_net=127.0.0.1/8
local_net=172.31.26.138/20
local_net=172.17.0.1/16
local_net=172.20.0.1/16
```

> ⚠️ Do not leave `127.0.0.1/32` as the only `local_net` when running on a cloud VPS.
> Asterisk needs to know **all** local networks (host and Docker).

## Step 4 – Restart Asterisk inside Docker

If you’re using `docker compose` with dsai-infra, you can restart only the Asterisk container:

```bash
docker compose restart dsai-asterisk
```

Or, if you’re using a specific compose file:

```bash
docker compose -f docker-compose-openai.yml restart dsai-asterisk
```

(adjust the filename to match your setup).

## Step 5 – Quick checklist

If you still have no audio, verify:

* The SIP trunk registers successfully
* Calls are established (SIP signaling works)
* `external_media_address` and `external_signaling_address` are set to the **public IP** of the VPS
* All relevant networks from `ip addr` are listed as `local_net`
* UDP RTP ports (typically `10000–20000`) are allowed in the firewall / security groups
* You are using the latest version of `dsai-infra`

## Common symptoms and causes

| Symptom               | Likely cause                    | Fix                                            |
| --------------------- | ------------------------------- | ---------------------------------------------- |
| No audio (both sides) | Wrong `external_media_address`  | Set it to the VPS public IP                    |
| One-way audio         | Missing `local_net` entries     | Add all local networks from `ip addr`          |
| Works locally only    | `127.0.0.1` used for everything | Replace with real public IP and local networks |
| Random audio issues   | Firewall dropping RTP           | Open UDP 10000–20000 to/from the VPS           |

## Example: Hetzner VPS with dsai-infra

Assume:

* Public IP: `95.216.41.122`
* `ip addr` shows:

  * `lo: 127.0.0.1/8`
  * `eth0: 172.31.26.138/20`
  * `docker0: 172.17.0.1/16`
  * `br-9834d22c1f45: 172.20.0.1/16`

Then your `pjsip.conf` should contain:

```ini
external_media_address=95.216.41.122
external_signaling_address=95.216.41.122

local_net=127.0.0.1/8
local_net=172.31.26.138/20
local_net=172.17.0.1/16
local_net=172.20.0.1/16
```

After updating, restart the Asterisk container and test again.

## Still stuck?

If audio still doesn’t work after applying these settings:

* double-check that the correct `pjsip.conf` is being loaded inside the container
* verify firewall / security group rules for UDP RTP ports
* share your `pjsip.conf` and `ip addr` output (with sensitive data redacted) in the community for further help

## RTP Debugging (Advanced Troubleshooting)

If audio is still not working after configuring `pjsip.conf`, you should inspect the **RTP traffic** inside the Asterisk container. This is the most reliable way to confirm whether RTP packets are flowing correctly **in both directions** (to and from the server).

### Step 1 — Enter the Asterisk container

```bash
docker exec -it dsai-asterisk /bin/bash
```

This opens a shell *inside* the running Asterisk container.

### Step 2 — Open the Asterisk CLI

Once inside the container, run:

```bash
asterisk -vvvvr
```

You should now see the Asterisk CLI prompt.

### Step 3 — Enable RTP debugging

In the Asterisk CLI:

```bash
rtp set debug on
```

Now, whenever a call is active, you should see RTP packets scrolling in the console.

### Example output (fake but realistic)

```
Sent RTP packet to 95.216.41.122:16432 (type 00, seq 04123, ts 153241231, len 160)
Got  RTP packet from 95.216.41.122:16432 (type 00, seq 04124, ts 153241591, len 160)
```

You **must see both directions**:

* `Sent RTP packet to ...`
* `Got RTP packet from ...`

If you only see one direction, you likely have:

* NAT misconfiguration
* Firewall/security group blocking UDP
* Wrong IP in `external_media_address`


## Test RTP Using the Echo Test (Extension 600)

DSAI includes a built-in **echo test** available at extension **600**.
This is extremely useful to verify RTP flow without involving external providers.

### How to test:

1. Dial **600** from your SIP endpoint.
2. You should hear your own voice echoed back.
3. With RTP debug enabled, you should again see **both incoming and outgoing RTP packets** in the console.

If the echo test **does not** return audio, the issue is **100% network/NAT/RTP related**, not ASR/DSAI logic.

## When RTP Debugging Helps

RTP debugging is essential when:

* Calls connect but have no audio
* Echo test fails
* STF/DSAI receives silence
* Audio works locally but not on cloud servers
* You’re unsure whether the firewall is blocking RTP

This tool allows you to directly confirm whether RTP is flowing — eliminating guesswork.

> You can also reference this page whenever “no audio” issues appear in the community, since this misconfiguration is one of the most common root causes.
{.is-info}



