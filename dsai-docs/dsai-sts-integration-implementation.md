---
title: DSAI-STS Integration Implementation
description: 
published: true
date: 2025-09-16T16:00:14.721Z
tags: 
editor: markdown
dateCreated: 2025-09-05T17:08:04.809Z
---

# DSAI-STS Integration Implementation

This guide explains how to implement a new Speech-to-Speech (STS) integration with a new AI provider, following the standard DSAI protocol.

## Overview

An STS integration is a WebSocket server that acts as a bridge between DSAI Core and an external AI provider. The server receives audio from the client, sends it to the AI provider, and returns audio responses to the client in real-time.

## Architecture

```
Client (DSAI Core) ←→ WebSocket Server (Your Integration) ←→ AI Provider
```

## Step 1: Setup WebSocket Server

### 1.1 Create WebSocket Server

```javascript
const WebSocket = require('ws');
const PORT = process.env.PORT || 6036; // Choose a unique port

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (clientWs) => {
  console.log('New client connected');
  handleClientConnection(clientWs);
});
```

### 1.2 Handle Client Connections

```javascript
const handleClientConnection = (clientWs) => {
  let sessionUuid = null;
  let providerConnection = null;

  // Handle messages from client
  clientWs.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleClientMessage(message, clientWs, sessionUuid, providerConnection);
    } catch (error) {
      console.error('Message parsing error:', error);
      sendError(clientWs, 'Invalid message format');
    }
  });

  // Handle client disconnection
  clientWs.on('close', () => {
    console.log('Client disconnected');
    cleanup(providerConnection, clientWs);
  });

  clientWs.on('error', (error) => {
    console.error('Client WebSocket error:', error);
    cleanup(providerConnection, clientWs);
  });
};
```

## Step 2: Handle Client Events

### 2.1 `init` Event - Session Initialization

**When received**: At the beginning of each new conversation session.

**Structure**:
```json
{
  "type": "init",
  "uuid": "unique-session-identifier"
}
```

**Handling**:
```javascript
const handleInit = async (message, clientWs, sessionUuid, providerConnection) => {
  sessionUuid = message.uuid;
  const config = message.provider_config || {};
  
  console.log(`Initializing session: ${sessionUuid}`);
  
  try {
    // Initialize connection with AI provider
    providerConnection = await initializeProviderConnection(config);
    
    // Setup event handlers for provider
    setupProviderEventHandlers(providerConnection, clientWs);
    
    console.log('Session initialized successfully');
  } catch (error) {
    console.error('Provider initialization error:', error);
    sendError(clientWs, 'Unable to connect to AI provider');
  }
};
```

### 2.2 `audio` Event - Audio Data

**When received**: Continuously during conversation to send user audio.

**Structure**:
```json
{
  "type": "audio",
  "audio": "base64_encoded_audio_data"
}
```

**Audio Specifications**:
- **Format**: PCM 16-bit
- **Sample Rate**: 8000 Hz
- **Channels**: Mono (1 channel)
- **Encoding**: Base64

**Handling**:
```javascript
const handleAudio = (message, clientWs, sessionUuid, providerConnection) => {
  if (!providerConnection) {
    console.warn('Provider not initialized, ignoring audio');
    return;
  }

  try {
    // Decode base64 audio
    const audioBuffer = Buffer.from(message.audio, 'base64');
    
    // Validate audio format (optional but recommended)
    if (!validateAudioFormat(audioBuffer)) {
      console.warn('Invalid audio format');
      return;
    }
    
    // Send audio to AI provider
    sendAudioToProvider(providerConnection, audioBuffer);
    
  } catch (error) {
    console.error('Audio handling error:', error);
  }
};

const validateAudioFormat = (audioBuffer) => {
  // Verify buffer is in PCM 16-bit format
  return audioBuffer.length > 0 && audioBuffer.length % 2 === 0;
};
```

### 2.3 `dtmf_digit` Event - DTMF Digit

**When received**: User digit a DTMF

**Structure**:
```json
{
  "type": "dtmf_digit",
  "digit": "1|2|3|..."
}
```

**Handling**:
```javascript

```

## Step 3: Send Events to Client

### 3.1 `audio` Event - Audio Response

**When to send**: When you receive audio from the AI provider.

**Structure**:
```json
{
  "type": "audio",
  "audio": "base64_encoded_audio_data"
}
```

**Implementation**:
```javascript
const sendAudioToClient = (clientWs, audioBuffer) => {
  if (clientWs.readyState === WebSocket.OPEN) {
    const base64Audio = audioBuffer.toString('base64');
    
    clientWs.send(JSON.stringify({
      type: 'audio',
      audio: base64Audio
    }));
  }
};
```

### 3.2 `interruption` Event - Stream Interruption

**When to send**: When you need to interrupt the audio stream to the client (e.g., new user input, provider error).

**Structure**:
```json
{
  "type": "interruption"
}
```

**Implementation**:
```javascript
const sendInterruption = (clientWs) => {
  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(JSON.stringify({
      type: 'interruption'
    }));
  }
};

// Examples of when to send interruption:
// 1. New user audio input
const handleNewUserInput = (clientWs) => {
  sendInterruption(clientWs);
  // Then send the new audio
};

// 2. Provider error
const handleProviderError = (clientWs) => {
  sendInterruption(clientWs);
  sendError(clientWs, 'AI provider error');
};
```

### 3.3 `transcript` Event - Text Transcription

**When to send**: When you receive transcriptions from the provider (optional but useful for debugging).

**Structure**:
```json
{
  "type": "transcript",
  "role": "user|agent",
  "text": "transcribed text"
}
```

**Implementation**:
```javascript
const sendTranscript = (clientWs, role, text) => {
  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(JSON.stringify({
      type: 'transcript',
      role: role, // 'user' or 'agent'
      text: text
    }));
  }
};
```

### 3.4 `error` Event - Error Handling

**When to send**: When an error occurs that needs to be communicated to the client.

**Structure**:
```json
{
  "type": "error",
  "message": "error description"
}
```

**Implementation**:
```javascript
const sendError = (clientWs, message) => {
  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(JSON.stringify({
      type: 'error',
      message: message
    }));
  }
};
```

## Step 4: Provider-Specific Implementation

### 4.1 Provider Initialization

```javascript
const initializeProviderConnection = async (config) => {
  // Provider-specific implementation
  // Examples:
  
  // For HTTP REST provider
  const providerClient = new ProviderClient({
    apiKey: config.api_key,
    model: config.model,
    voice: config.voice
  });
  
  // For WebSocket provider
  const providerWs = new WebSocket(providerUrl, {
    headers: {
      'Authorization': `Bearer ${config.api_key}`
    }
  });
  
  return providerClient; // or providerWs
};
```

### 4.2 Provider Event Handling

```javascript
const setupProviderEventHandlers = (providerConnection, clientWs) => {
  // Example for WebSocket provider
  providerConnection.on('message', (data) => {
    try {
      const response = JSON.parse(data);
      
      switch (response.type) {
        case 'audio':
          // Convert provider audio to 8kHz if necessary
          const audio8k = convertTo8kHz(response.audio);
          sendAudioToClient(clientWs, audio8k);
          break;
          
        case 'transcript':
          sendTranscript(clientWs, response.role, response.text);
          break;
          
        case 'error':
          sendError(clientWs, response.message);
          break;
      }
    } catch (error) {
      console.error('Provider response handling error:', error);
    }
  });
  
  providerConnection.on('close', () => {
    console.log('Provider connection closed');
    sendError(clientWs, 'Provider connection lost');
  });
  
  providerConnection.on('error', (error) => {
    console.error('Provider error:', error);
    sendError(clientWs, 'AI provider error');
  });
};
```

### 4.3 Send Audio to Provider

```javascript
const sendAudioToProvider = (providerConnection, audioBuffer) => {
  // Provider-specific implementation
  
  // For HTTP REST provider
  if (providerConnection.sendAudio) {
    providerConnection.sendAudio(audioBuffer);
  }
  
  // For WebSocket provider
  if (providerConnection.readyState === WebSocket.OPEN) {
    providerConnection.send(JSON.stringify({
      type: 'audio',
      audio: audioBuffer.toString('base64')
    }));
  }
};
```

## Step 5: Audio Handling and Conversions

### 5.1 Sample Rate Conversion

```javascript
const convertTo8kHz = (audioBuffer) => {
  // If provider returns audio at different frequency than 8kHz,
  // implement conversion here
  
  // Example with resampling library
  const inputSamples = new Int16Array(audioBuffer.buffer);
  const outputSamples = resample(inputSamples, originalRate, 8000);
  
  return Buffer.from(outputSamples.buffer);
};
```

### 5.2 Audio Validation

```javascript
const validateAudioFormat = (audioBuffer) => {
  // Verify audio is in PCM 16-bit at 8kHz format
  const expectedLength = 160; // 20ms at 8kHz = 160 samples
  
  return audioBuffer.length > 0 && 
         audioBuffer.length % 2 === 0 && // 16-bit = 2 bytes per sample
         audioBuffer.length <= expectedLength * 2; // Max 20ms
};
```

## Step 6: Cleanup and Resource Management

```javascript
const cleanup = (providerConnection, clientWs) => {
  // Close provider connection
  if (providerConnection) {
    if (providerConnection.close) {
      providerConnection.close();
    } else if (providerConnection.readyState === WebSocket.OPEN) {
      providerConnection.close();
    }
  }
  
  // Close client connection
  if (clientWs && clientWs.readyState === WebSocket.OPEN) {
    clientWs.close();
  }
};
```

## Step 7: Error Handling and Logging

```javascript
// Structured logging
const log = {
  info: (message, data = {}) => console.log(`[INFO] ${message}`, data),
  error: (message, error = {}) => console.error(`[ERROR] ${message}`, error),
  warn: (message, data = {}) => console.warn(`[WARN] ${message}`, data)
};

// Global error handling
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
```

## Step 8: Configuration and Environment

```javascript
// .env file
PORT=6036
PROVIDER_API_URL=https://api.yourprovider.com
DEFAULT_MODEL=your-default-model
DEFAULT_VOICE=your-default-voice
LOG_LEVEL=info

// Configuration
const config = {
  port: process.env.PORT || 6036,
  providerUrl: process.env.PROVIDER_API_URL,
  defaultModel: process.env.DEFAULT_MODEL,
  defaultVoice: process.env.DEFAULT_VOICE,
  logLevel: process.env.LOG_LEVEL || 'info'
};
```

## Complete Handler Example

```javascript
const handleClientMessage = (message, clientWs, sessionUuid, providerConnection) => {
  switch (message.type) {
    case 'init':
      handleInit(message, clientWs, sessionUuid, providerConnection);
      break;
      
    case 'audio':
      handleAudio(message, clientWs, sessionUuid, providerConnection);
      break;
      
    default:
      log.warn('Unknown message type:', message.type);
      sendError(clientWs, `Unsupported message type: ${message.type}`);
  }
};
```

## Best Practices

1. **Connection Management**: Always implement connection cleanup
2. **Input Validation**: Always validate messages received from client
3. **Error Handling**: Provide clear and informative error messages
4. **Logging**: Implement structured logging for debugging
5. **Performance**: Handle audio buffers efficiently
6. **Security**: Validate and sanitize all inputs
7. **Timeout**: Implement timeouts for inactive connections
8. **Rate Limiting**: Consider rate limiting to prevent abuse

## Testing

```javascript
// Basic test to verify server
const testConnection = () => {
  const ws = new WebSocket('ws://localhost:6036');
  
  ws.onopen = () => {
    // Test init
    ws.send(JSON.stringify({
      type: 'init',
      uuid: 'test-session',
      provider_config: { api_key: 'test-key' }
    }));
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
  };
};
```

## Key Points Summary

### Client to Server Events:
- **`init`**: Initialize session with UUID and provider configuration
- **`audio`**: Send base64-encoded PCM 8kHz 16-bit audio data

### Server to Client Events:
- **`audio`**: Send base64-encoded PCM 8kHz 16-bit audio responses
- **`interruption`**: Signal to interrupt current audio stream
- **`transcript`**: Send transcribed text (optional)
- **`error`**: Send error messages

### Audio Requirements:
- **Input/Output Format**: PCM 16-bit, 8000 Hz, Mono
- **Encoding**: Base64
- **Chunk Size**: Recommended 20ms (160 samples)

This guide provides a solid foundation for implementing any STS integration with a new AI provider, following the standard DSAI protocol.