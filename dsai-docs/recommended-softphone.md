---
title: Recommended Softphones
description: 
published: true
date: 2025-08-26T15:55:17.884Z
tags: 
editor: markdown
dateCreated: 2025-08-26T15:54:37.276Z
---

# Recommended Softphones

To test DSAI with your SIP/PBX setup, you’ll need a softphone client.  
Here are our recommendations based on operating system:

| OS        | Recommended Softphone | Download Link                                                                 |
|-----------|-----------------------|-------------------------------------------------------------------------------|
| **macOS** | Telephone             | [App Store](https://apps.apple.com/it/app/telephone/id406825478)             |
| **Linux** (Ubuntu/Debian) | GNOME Calls          | [Flathub](https://flathub.org/apps/org.gnome.Calls)                          |
| **Windows** | MicroSIP (portable & lightweight) | [Official site](https://www.microsip.org/downloads) |

> 💡 We recommend **Telephone** on macOS and **GNOME Calls** on Ubuntu for simplicity and compatibility.

## macOS – Telephone

### Step-by-Step Setup

#### 1. **Open Settings → Add Account**  
<br>
<div>
  <img src="/images/softphones/telephones/account.png" alt="info account" width="400"/>
</div>

Fill in the following values:  
- **Fullname**: `1000`  
- **Domain**: `127.0.0.1`  
- **User Name**: `1000`  
- **Password**: `1000`

#### 2. **Go to the "Network" tab**  
<br>
<div>
  <img src="/images/softphones/telephones/network.png" alt="network account" width="400"/>
</div>

- Select **SIP Transport: TCP**  
- **Disable** the flag *Update IP address* → ⚠️ this step is **very important**

#### 3. **Move to the "Account Information" tab**  
<br>
<div>
  <img src="/images/softphones/telephones/enable.png" alt="enable account" width="400"/>
</div>

- Enable the checkbox **Enable this account**

#### 4. **Test your setup**  
<br>
<div>
  <img src="/images/softphones/telephones/600.png" alt="internal 600" width="400"/>
</div>

- Dial **600** → this runs the echo test.  
- You should hear a voice prompt. Wait until asked to speak, then talk: your voice should be echoed back.

### Ready to Use

Your softphone is now configured and working with DSAI.  

- For default FreePBX extensions → call **5001** and your configured **Voicebot** will answer.  
- Use the echo test (**600**) anytime you need to verify audio flow.