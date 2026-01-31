---
title: DSAI Function Calls
description: 
published: true
date: 2025-12-16T12:40:25.919Z
tags: dsai, transfer, hangup, function calls, tools, dsai_tools
editor: markdown
dateCreated: 2025-09-04T14:35:17.641Z
---

# DSAI Function Calls 

DSAI (Agent Voice Response) supports function calling capabilities, allowing developers to create custom tools that can be invoked during real-time speech-to-speech conversations. This guide explains how to create, implement, and use custom function calls in the DSAI system.

## Architecture

The function calling system in DSAI consists of two main directories:

- **`dsai_tools/`** - Project-provided tools (core functionality)
- **`tools/`** - User custom tools (extensible functionality)

Tools are automatically loaded at runtime and made available to the LLM for function calling.

## Default Function Calls

DSAI comes with two essential built-in function calls that are automatically available in every conversation:

### 1. `dsai_transfer` - Call Transfer Tool

**Purpose**: Transfers the current call to a specific extension, commonly used to connect users with human operators.

**Usage**: The AI agent can automatically transfer calls when:
- A user requests to speak with a human operator
- The conversation reaches a point where human intervention is needed
- The AI determines it cannot handle a specific request

**Parameters**:
- `transfer_extension` (required): The extension number to transfer to
- `transfer_context` (optional): The context/department for the transfer
- `transfer_priority` (optional): Priority level for the transfer

**Example AI Usage**: "I understand you'd like to speak with a human operator. Let me transfer you to our customer service team."

### 2. `dsai_hangup` - Call Termination Tool

**Purpose**: Forces the virtual agent to end the conversation and hang up the call.

**Usage**: The AI agent can automatically hang up when:
- A task or conversation is completed
- No further assistance is needed
- The user's request has been fulfilled
- Maintenance or booking has been completed

**Parameters**: None required

**Example AI Usage**: "Your appointment has been successfully scheduled. Thank you for calling, and have a great day!"

These default tools ensure that every DSAI deployment has the essential call management capabilities without requiring additional development.

## Tool Structure

Each tool must follow a specific structure defined by the following properties:

### Required Properties

```javascript
module.exports = {
  name: "tool_name",           // Unique identifier for the tool
  description: "Tool description", // Human-readable description
  input_schema: {},            // JSON Schema for input validation
  handler: async (uuid, args) => {} // Function to execute
};
```

### Property Details

#### `name` (string, required)
- Must be unique across all tools
- Used by LLM to identify which tool to call
- Should be descriptive and follow snake_case convention
- Example: `"get_weather"`, `"dsai_transfer"`, `"dsai_hangup"`

#### `description` (string, required)
- Clear explanation of what the tool does
- Used by LLM to understand when to call this tool
- Should be concise but informative
- Example: `"Retrieves weather information for a specific location"`

#### `input_schema` (object, required)
- JSON Schema that defines the expected input parameters
- LLM uses this to validate and structure the input data
- Must follow [JSON Schema specification](https://json-schema.org/)

#### `handler` (function, required)
- Async function that executes the tool's logic
- Receives two parameters: `uuid` and `args`
- Must return a string response that will be sent back to the user

## Creating a Custom Tool

### Step 1: Create the Tool File

Create a new JavaScript file in the `tools/` directory:

```bash
touch path/to/tools/my_custom_tool.js
```

### Step 2: Implement the Tool

```javascript
// tools/my_custom_tool.js

module.exports = {
  name: "my_custom_tool",
  description: "Performs a custom operation based on user input",
  
  input_schema: {
    type: "object",
    properties: {
      parameter1: {
        type: "string",
        description: "First parameter description"
      },
      parameter2: {
        type: "number",
        description: "Second parameter description"
      }
    },
    required: ["parameter1"] // parameter2 is optional
  },
  
  handler: async (uuid, { parameter1, parameter2 }) => {
    try {
      // Your custom logic here
      const result = await performCustomOperation(parameter1, parameter2);
      
      return `Operation completed successfully: ${result}`;
    } catch (error) {
      return `Error occurred: ${error.message}`;
    }
  }
};
```

### Step 3: Restart the Services

After adding a new tool, restart the DSAI services for changes to take effect.

## Input Schema Examples

### Simple String Parameter

```javascript
input_schema: {
  type: "object",
  properties: {
    location: {
      type: "string",
      description: "The name of the location"
    }
  },
  required: ["location"]
}
```

### Multiple Parameters with Types

```javascript
input_schema: {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "User's full name"
    },
    age: {
      type: "number",
      description: "User's age in years"
    },
    isActive: {
      type: "boolean",
      description: "Whether the user account is active"
    }
  },
  required: ["name", "age"]
}
```

### Array Parameters

```javascript
input_schema: {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "string"
      },
      description: "List of items to process"
    }
  },
  required: ["items"]
}
```

## Handler Function

### Signature

```javascript
handler: async (uuid, args) => {
  // uuid: Session identifier for tracking
  // args: Object containing the validated input parameters
}
```

### Parameters

- **`uuid`** (string): Unique session identifier for the current conversation
  - Use this for logging, tracking, or making session-specific API calls
  - Example: `"550e8400-e29b-41d4-a716-446655440000"`

- **`args`** (object): Destructured parameters from the input schema
  - Contains the validated parameters as defined in `input_schema`
  - Example: `{ location: "New York" }`

### Return Value

The handler must return a string that will be:
1. Sent back to OpenAI as instructions
2. Converted to speech and sent to the user
3. Used to continue the conversation

### Error Handling

Always implement proper error handling in your handlers:

```javascript
handler: async (uuid, args) => {
  try {
    // Your logic here
    const result = await someAsyncOperation(args);
    return `Success: ${result}`;
  } catch (error) {
    console.error(`Error in ${this.name}:`, error);
    return `I encountered an error: ${error.message}`;
  }
}
```

## Real-World Examples

### Weather Tool

```javascript
// tools/get_weather.js
const axios = require('axios');

module.exports = {
  name: "get_weather",
  description: "Retrieves current weather information for a specified location",
  
  input_schema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city or location name"
      },
      units: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature units (default: celsius)"
      }
    },
    required: ["location"]
  },
  
  handler: async (uuid, { location, units = "celsius" }) => {
    try {
      // Simulate weather API call
      const weather = await getWeatherData(location);
      
      return `The weather in ${location} is currently ${weather.condition} with a temperature of ${weather.temperature}°${units === "fahrenheit" ? "F" : "C"}.`;
    } catch (error) {
      return `I'm sorry, I couldn't retrieve the weather for ${location}. Please try again.`;
    }
  }
};
```

### Call Transfer Tool

```javascript
// tools/dsai_transfer.js

require("dotenv").config();

const axios = require("axios");

module.exports = {
  name: "dsai_transfer",
  description: "Transfers the call to a designated internal extension when the user requests to speak with an internal operator or be redirected to another extension. Optional context and priority information may be included to support proper call handling and routing.",
  input_schema: {
    type: "object",
    properties: {
      transfer_extension: {
        type: "string",
        description: "The transfer extension to transfer the call to.",
      },
      transfer_context: {
        type: "string",
        description: "The context to transfer the call to.",
      },
      transfer_priority: {
        type: "string",
        description: "The priority of the transfer.",
      },
    },
    required: ["transfer_extension"],
  },
  handler: async (
    uuid,
    { transfer_extension, transfer_context, transfer_priority }
  ) => {
    console.log("Transfering call to:", transfer_extension);
    console.log("UUID:", uuid);

    try {
      const url = process.env.AMI_URL || "http://127.0.0.1:6006";
      const res = await axios.post(`${url}/transfer`, {
        uuid,
        exten: transfer_extension,
        context: transfer_context || "demo",
        priority: transfer_priority || 1,
      });
      console.log("Transfer response:", res.data);
      return res.data.message;
    } catch (error) {
      console.error("Error during transfer:", error.message);
      return `Error during transfer: ${error.message}`;
    }
  },
};

```

### Call Hangup Tool

```javascript
// tools/dsai_hangup.js

require("dotenv").config();

const axios = require("axios");

module.exports = {
  name: "dsai_hangup",
  description:
    "Ends the call when the customer has no further information to request, after all relevant actions have been completed, or when the customer explicitly says goodbye, ensuring a clean and graceful termination of the interaction.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async (uuid, {}) => {
    console.log("Hangup call");
    const url = process.env.AMI_URL || "http://127.0.0.1:6006";
    try {
      const res = await axios.post(`${url}/hangup`, { uuid });
      console.log("Hangup response:", res.data);
      return res.data.message;
    } catch (error) {
      console.error("Error during hangup:", error.message);
      return `Error during hangup: ${error.message}`;
    }
  },
};


```


## Best Practices

### 1. Naming Conventions
- Use descriptive, lowercase names with underscores
- Prefix DSAI-specific tools with `dsai_`
- Keep names short but meaningful

### 2. Error Handling
- Always wrap your logic in try-catch blocks
- Return user-friendly error messages
- Log errors for debugging purposes

### 3. Input Validation
- Use comprehensive JSON schemas
- Make required fields explicit
- Provide clear descriptions for all parameters

### 4. Response Format
- Keep responses conversational and natural
- Include relevant information from the operation
- Use appropriate language for the context

### 5. Performance
- Keep handlers lightweight and fast
- Use async/await for external API calls
- Avoid blocking operations

## Troubleshooting

### Common Issues

1. **Tool not loading**
   - Check file syntax and exports
   - Verify file is in the correct directory
   - Restart the service after changes

2. **Handler not executing**
   - Check logs for function call attempts
   - Verify the tool name matches exactly
   - Ensure the handler function is properly exported

3. **Parameter validation errors**
   - Review your JSON schema syntax
   - Check required field definitions
   - Verify parameter types match expected values

### Debug Tips

- Add console.log statements in your handlers
- Check the DSAI service logs for errors
- Verify tool loading in the startup logs
- Test with simple tools first before complex implementations

## Environment Variables

Your tools can access environment variables through `process.env`:

```javascript
handler: async (uuid, args) => {
  const apiKey = process.env.MY_API_KEY;
  const baseUrl = process.env.MY_SERVICE_URL;
  
  // Use these in your tool logic
}
```

## Security Considerations

- Never expose sensitive information in tool responses
- Validate all input parameters thoroughly
- Use environment variables for API keys and secrets
- Implement rate limiting for external API calls
- Sanitize user input to prevent injection attacks

## Conclusion

Function calls in DSAI provide a powerful way to extend the system's capabilities. By following this guide, you can create robust, reliable tools that enhance the user experience and provide valuable functionality during voice conversations.

The built-in `dsai_transfer` and `dsai_hangup` tools ensure that every deployment has essential call management capabilities, while the extensible `tools/` directory allows you to add custom functionality specific to your use case.

For additional support and examples, refer to the existing tools in the `dsai_tools/` directory and the main DSAI documentation.