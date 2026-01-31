---
title: Webhook Integration Guide
description: 
published: true
date: 2025-12-29T17:02:32.895Z
tags: webhook
editor: markdown
dateCreated: 2025-09-13T10:28:58.099Z
---

# Webhook Integration Guide

DSAI Core provides comprehensive webhook support for real-time event tracking and integration with external systems. Webhooks allow you to receive instant notifications about call events, enabling you to build custom analytics, logging, and integration solutions.

## Overview

Webhooks are HTTP POST requests sent to your specified endpoint whenever specific events occur during a call session. This enables real-time monitoring, analytics, and integration with external systems like CRM platforms, analytics tools, or custom applications.

## Supported Webhook Events

### call_started
- **Trigger**: When a new call session begins
- **Payload**: Empty object `{}`
- **Use Case**: Initialize call tracking, start analytics, log call initiation

### call_ended
- **Trigger**: When a call session ends
- **Payload**: Empty object `{}`
- **Use Case**: Finalize call tracking, calculate call duration, update analytics

### interruption
- **Trigger**: When the AI response is interrupted by user speech
- **Payload**: Empty object `{}`
- **Use Case**: Track user engagement, measure interruption patterns, adjust AI behavior

### transcription
- **Trigger**: When speech is transcribed 
- **Payload**: Transcription object with role and text
- **Use Case**: Log conversations, analyze speech patterns, build conversation history

### dtmf_digit (only for Asterisk v22+)
- **Trigger**: When the user presses a DTMF key  
- **Payload**: The DTMF digit pressed  
- **Use Case**: Handle keypad input during a call (e.g., hybrid voice + DTMF menus)  

## Webhook Payload Format

All webhook requests follow a consistent JSON structure:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "call_started",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "payload": {
    // Event-specific data
  }
}
```

### Payload Fields

- **uuid**: Unique identifier for the call session
- **type**: Event type (call_started, call_ended, interruption, transcription)
- **timestamp**: ISO 8601 timestamp of when the event occurred
- **payload**: Event-specific data object

### Event-Specific Payloads

#### call_started
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "call_started",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "payload": {}
}
```

#### call_ended
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "call_ended",
  "timestamp": "2024-01-01T12:05:30.000Z",
  "payload": {}
}
```

#### interruption
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "interruption",
  "timestamp": "2024-01-01T12:02:15.000Z",
  "payload": {}
}
```

#### transcription
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "transcription",
  "timestamp": "2024-01-01T12:01:45.000Z",
  "payload": {
    "role": "user|agent",
    "text": "Hello, I need help with my account"
  }
}
```

#### dtmf_digit (only for Asterisk 22+)
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "dtmf_digit",
  "timestamp": "2024-01-01T12:02:15.000Z",
  "payload": {
  	"digit": "1|2|3|..."
  }
}
```

## Configuration

### Environment Variables

Configure webhook settings using the following environment variables:

#### Required Configuration
- **WEBHOOK_URL**: The endpoint URL where webhook notifications will be sent
- **WEBHOOK_SECRET**: Secret key for webhook signature verification

#### Optional Configuration
- **WEBHOOK_TIMEOUT**: Request timeout in milliseconds (default: 3000ms)
- **WEBHOOK_RETRY**: Number of retry attempts for failed requests (default: 0)

### Example Configuration

```bash
# .env file
WEBHOOK_URL=http://dsai-webhook:9000/events # or your custom webhook url
WEBHOOK_SECRET=your-secret-key-here
WEBHOOK_TIMEOUT=5000
WEBHOOK_RETRY=3
```

## Security

### Webhook Signature Verification

When `WEBHOOK_SECRET` is configured, DSAI Core includes the secret in the `X-DSAI-WEBHOOK-SECRET` header for verification:

```http
POST /events HTTP/1.1
Host: dsai-webhook
Content-Type: application/json
X-DSAI-WEBHOOK-SECRET: your-secret-key-here

{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "type": "call_started",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "payload": {}
}
```

## Implementation Examples

To help you get started quickly, we provide ready-to-use examples that show how to connect DSAI with external systems using webhooks.  
These examples demonstrate how to capture events, parse data, and trigger actions in your own applications.

- **GitHub Repository**: [agentvoiceresponse/dsai-webhook](https://github.com/agentvoiceresponse/dsai-webhook)  
  Contains sample webhook receivers and step-by-step instructions on how to integrate DSAI with your stack.

## Error Handling and Retries

### Automatic Retry Logic

DSAI Core implements automatic retry logic for failed webhook requests:

1. **Initial Request**: Webhook is sent to the configured URL
2. **Timeout Handling**: If no response within `WEBHOOK_TIMEOUT`, request is considered failed
3. **Retry Attempts**: Up to `WEBHOOK_RETRY` additional attempts are made
4. **Exponential Backoff**: Retry attempts are spaced with increasing delays
5. **Final Failure**: After all retries are exhausted, the webhook is logged as failed

### Error Logging

Failed webhook requests are logged with detailed error information:

```
[WEBHOOK][CALL_STARTED] Retry failed
Webhook Error:
Message: connect ECONNREFUSED dsai-webhook:9000
Code: ECONNREFUSED
URL: http://dsai-webhook:9000/events
Method: POST
Status: 
```


### Best Practices for Webhook Endpoints

1. **Fast Response**: Respond quickly (within timeout period)
2. **Idempotent Processing**: Handle duplicate webhook deliveries
3. **Error Handling**: Return appropriate HTTP status codes
4. **Logging**: Log all webhook events for debugging
5. **Security**: Verify webhook signatures when using secrets

### Common Issues and Solutions

#### Webhook Not Received
- **Check URL**: Verify `WEBHOOK_URL` is correct and accessible
- **Check Network**: Ensure network connectivity between DSAI Core and webhook endpoint
- **Check Logs**: Review DSAI Core logs for webhook delivery errors

#### Timeout Errors
- **Increase Timeout**: Set higher `WEBHOOK_TIMEOUT` value
- **Optimize Endpoint**: Improve webhook endpoint response time
- **Check Load**: Ensure webhook endpoint can handle request volume

#### Authentication Failures
- **Verify Secret**: Check `WEBHOOK_SECRET` configuration
- **Check Headers**: Ensure webhook endpoint reads `X-DSAI-WEBHOOK-SECRET` header
- **Test Verification**: Implement and test signature verification logic

## Use Cases

Webhooks in DSAI allow you to extend the platform beyond call handling, by sending events and call data to your own systems or third-party services.  
This makes it possible to enrich analytics, update business tools in real time, and ensure continuous quality improvements.

Here are some common scenarios:

### Call Analytics
Track key metrics like call duration, frequency, and interaction patterns.  
Useful for understanding customer behavior, optimizing agent performance, and measuring AI voicebot efficiency.

![call-analytics.png](/images/webhook/call-analytics.png)

### CRM Integration
Automatically update customer profiles with call transcripts, notes, or outcomes.  
This ensures your sales and support teams always have the latest information at hand.

![crm.jpg](/images/webhook/crm.jpg)

### Quality Assurance
Monitor AI performance, user satisfaction, and conversation quality.  
Webhook data can be connected to dashboards or QA tools to spot issues early and continuously improve your conversational flows.


![qa.jpg](/images/webhook/qa.jpg)