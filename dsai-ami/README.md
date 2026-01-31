# DSAI-AMI: Digital Storming AI and Asterisk Manager Interface Integration

## Overview

DSAI-AMI is a Node.js application that provides a seamless integration with Asterisk Manager Interface (AMI) for call control operations. It enables the management of calls through a simple API interface, allowing for call transfers, hangups, and new call origination. This service is designed to work in conjunction with Digital Storming AI's Large Language Models (LLMs) to provide intelligent call handling capabilities.

## Features

- **Call Control Operations**:
  - Transfer active calls to different extensions
  - Hang up ongoing calls
  - Originate new outbound calls
- **UUID-based Call Tracking**: Each call is tracked using a unique UUID generated before the Asterisk AudioSocket Application is invoked
- **Simple REST API**: Easy-to-use endpoints for call management
- **LLM Integration**: Seamless integration with Digital Storming AI's Large Language Models for intelligent call handling

## Prerequisites

- Node.js 
- Asterisk server with Manager Interface enabled

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/agentvoiceresponse/dsai-ami.git
   cd dsai-ami
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables in `.env`:
   ```
   PORT=6006
   AMI_HOST=127.0.0.1
   AMI_PORT=5038
   AMI_USERNAME=dsai
   AMI_PASSWORD=dsai
   ```

## API Endpoints

These endpoints are primarily used by Digital Storming AI's Large Language Models to control calls through natural language processing:

### POST /transfer

Transfer an active call to a different extension.

**Request Body:**
```json
{
  "uuid": "call-uuid",
  "exten": "1234",
  "context": "from-internal",
  "priority": 1
}
```

### POST /hangup

Hang up an active call.

**Request Body:**
```json
{
  "uuid": "call-uuid"
}
```

### POST /originate

Initiate a new outbound call.

**Request Body:**
```json
{
  "channel": "SIP/trunk/1234567890",
  "exten": "1234",
  "context": "from-internal",
  "priority": 1,
  "callerid": "Digital Storming AI <dsai>"
}
```

## How It Works

1. **Call Identification**:
   - Each call is assigned a unique UUID before the AudioSocket Application is invoked in the Asterisk dialplan
   - The UUID is used to track and manage the call throughout its lifecycle

2. **AMI Connection**:
   - The application maintains a persistent connection to Asterisk Manager Interface
   - All call control operations are executed through AMI actions

3. **Call Management**:
   - Calls can be transferred between extensions
   - Active calls can be terminated
   - New outbound calls can be initiated
   - All operations are performed using the call's UUID for identification

4. **LLM Integration**:
   - Digital Storming AI's Large Language Models process natural language commands
   - The LLMs determine the appropriate call control action based on the conversation context
   - Actions are executed through the API endpoints to control the call flow
   - The system provides real-time feedback to the LLMs about the success or failure of operations

## Error Handling

The application includes robust error handling:
- Validates all incoming requests
- Provides clear error messages for failed operations
- Ensures proper cleanup of resources
- Maintains connection stability with Asterisk

