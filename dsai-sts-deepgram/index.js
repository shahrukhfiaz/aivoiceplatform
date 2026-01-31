/**
 * index.js
 * Entry point for the Deepgram Speech-to-Speech streaming WebSocket server.
 * This server handles real-time audio streaming between clients and Deepgram's API,
 * performing necessary audio format conversions and WebSocket communication.
 *
 * Client Protocol:
 * - Send {"type": "init", "uuid": "uuid"} to initialize session
 * - Send {"type": "audio", "audio": "base64_encoded_audio"} to stream audio
 * - Receive {"type": "audio", "audio": "base64_encoded_audio"} for responses
 * - Receive {"type": "error", "message": "error_message"} for errors
 *
 * @author Agent Voice Response <info@agentvoiceresponse.com>
 * @see https://www.agentvoiceresponse.com
 */

const WebSocket = require("ws");
const { createClient, AgentEvents } = require("@deepgram/sdk");
const { loadTools, getToolHandler } = require("./loadTools");

require("dotenv").config();

// Configuration is loaded from database via backend API
// Database is the primary source of truth - all values come from database
// Environment variables (passed by backend from database) are used as fallback only
// Changes in database are picked up on each new call without container restart

const PROVIDER_ID = process.env.PROVIDER_ID;
// Use container name (dsai-backend) as fallback for reliable Docker internal networking
const BACKEND_URL = process.env.BACKEND_URL || 'http://dsai-backend:3001';
const AGENT_ID = process.env.AGENT_ID;

/**
 * Sends a webhook event to the backend.
 * @param {string} uuid - Session UUID
 * @param {string} type - Event type
 * @param {Object} payload - Event payload
 */
async function sendWebhook(uuid, type, payload = {}) {
  if (!BACKEND_URL) {
    console.warn('[WEBHOOK] BACKEND_URL not set, skipping webhook');
    return;
  }

  const webhookUrl = `${BACKEND_URL}/webhooks`;
  const event = {
    uuid,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AGENT_ID && { 'x-dsai-agent-id': AGENT_ID }),
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.warn(`[WEBHOOK] Failed to send ${type} event: ${response.status}`);
    }
  } catch (error) {
    console.error(`[WEBHOOK] Error sending ${type} event:`, error.message);
  }
}

// Cache for configuration - balance between real-time updates and latency
// 30 second cache reduces call setup latency significantly
let configCache = null;
let configLastFetch = 0;
const CONFIG_CACHE_TTL = 30000; // 30 second cache - good balance between latency and real-time updates

/**
 * Fetches configuration from the backend API (database).
 * Database is the primary source of truth - all values come from database.
 * Falls back to environment variables (passed by backend from database) only if API is unavailable.
 * 
 * Real-time updates: Config is ALWAYS fetched fresh from database (0ms cache = no caching)
 * - When you update provider settings in dashboard, changes apply immediately to next call
 * - No container restart needed - each new call gets latest config from database
 * - Prompt, greeting, and all settings update in real-time
 * 
 * @param {boolean} forceRefresh - If true, bypasses cache and fetches fresh config (always true now)
 * @returns {Promise<Object>} Configuration object
 */
async function fetchConfig(forceRefresh = false) {
  const now = Date.now();
  
  // Always fetch fresh config (cache disabled for real-time updates)
  // This ensures provider config changes apply immediately without container restart
  if (!forceRefresh && configCache && (now - configLastFetch) < CONFIG_CACHE_TTL) {
    return configCache;
  }

  // Primary source: Fetch from backend API (database)
  if (PROVIDER_ID && BACKEND_URL) {
    const fetchUrl = `${BACKEND_URL}/internal/providers/${PROVIDER_ID}/config`;
    console.log(`[CONFIG] Attempting to fetch config from: ${fetchUrl}`);
    try {
      // Use Promise.race for timeout compatibility
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fetch timeout after 2 seconds')), 2000)
      );
      const fetchPromise = fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      console.log(`[CONFIG] Fetch response status: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        configCache = data.env;
        configLastFetch = now;
        console.log("✅ [CONFIG] Fetched configuration from database via backend API");
        console.log(`[CONFIG] Config keys: ${Object.keys(configCache).join(', ')}`);
        console.log(`[CONFIG] AGENT_PROMPT: ${configCache.AGENT_PROMPT ? configCache.AGENT_PROMPT.substring(0, 50) + '...' : 'NOT SET'}`);
        console.log(`[CONFIG] DEEPGRAM_GREETING: ${configCache.DEEPGRAM_GREETING || 'NOT SET'}`);
        return configCache;
      } else {
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.warn(`❌ [CONFIG] Failed to fetch config from database API: ${response.status} - ${errorText}`);
        console.warn(`[CONFIG] Falling back to environment variables (may be outdated)`);
      }
    } catch (error) {
      console.error(`❌ [CONFIG] Error fetching config from database API: ${error.message}`);
      console.error(`[CONFIG] Error name: ${error.name}, code: ${error.code}`);
      console.error(`[CONFIG] Error details:`, error);
      console.warn(`[CONFIG] Falling back to environment variables (may be outdated)`);
    }
  } else {
    console.warn(`⚠️ [CONFIG] PROVIDER_ID or BACKEND_URL not set - cannot fetch from database.`);
    console.warn(`[CONFIG] PROVIDER_ID: ${PROVIDER_ID || 'NOT SET'}`);
    console.warn(`[CONFIG] BACKEND_URL: ${BACKEND_URL || 'NOT SET'}`);
    console.warn(`[CONFIG] Using environment variables passed by backend.`);
  }

  // Fallback: Use environment variables passed by backend (these also come from database)
  // These are set by the backend when starting the container, so they're from the database too
  configCache = {
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    AGENT_PROMPT: process.env.AGENT_PROMPT,
    DEEPGRAM_SAMPLE_RATE: process.env.DEEPGRAM_SAMPLE_RATE,
    DEEPGRAM_GREETING: process.env.DEEPGRAM_GREETING,
    DEEPGRAM_AGENT_LANGUAGE: process.env.DEEPGRAM_AGENT_LANGUAGE,
    DEEPGRAM_OUTPUT_ENCODING: process.env.DEEPGRAM_OUTPUT_ENCODING,
    DEEPGRAM_OUTPUT_BITRATE: process.env.DEEPGRAM_OUTPUT_BITRATE,
    OPENAI_TEMPERATURE: process.env.OPENAI_TEMPERATURE,
    OPENAI_CONTEXT_LENGTH: process.env.OPENAI_CONTEXT_LENGTH,
    DEEPGRAM_KEYTERMS: process.env.DEEPGRAM_KEYTERMS,
    DEEPGRAM_TAGS: process.env.DEEPGRAM_TAGS,
    DEEPGRAM_SMART_FORMAT: process.env.DEEPGRAM_SMART_FORMAT,
    DEEPGRAM_EXPERIMENTAL: process.env.DEEPGRAM_EXPERIMENTAL,
    DEEPGRAM_MIP_OPT_OUT: process.env.DEEPGRAM_MIP_OPT_OUT,
    DEEPGRAM_HISTORY_ENABLED: process.env.DEEPGRAM_HISTORY_ENABLED,
    DEEPGRAM_ASR_MODEL: process.env.DEEPGRAM_ASR_MODEL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    DEEPGRAM_TTS_MODEL: process.env.DEEPGRAM_TTS_MODEL,
  };
  configLastFetch = now;
  console.log("⚠️ Using configuration from environment variables (passed by backend from database)");
  console.log(`⚠️ NOTE: These values are from when container was started. For real-time updates, ensure BACKEND_URL is accessible.`);
  console.log(`Environment AGENT_PROMPT: ${process.env.AGENT_PROMPT ? process.env.AGENT_PROMPT.substring(0, 50) + '...' : 'NOT SET'}`);
  console.log(`Environment DEEPGRAM_GREETING: ${process.env.DEEPGRAM_GREETING || 'NOT SET'}`);
  return configCache;
}

/**
 * Gets a configuration value, with fallback to default.
 * @param {Object} config - Configuration object
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Configuration value
 */
function getConfigValue(config, key, defaultValue = undefined) {
  const value = config[key];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return value;
}

// Initial validation - at least check if env has basic config
if (!process.env.DEEPGRAM_API_KEY && !PROVIDER_ID) {
  throw new Error("DEEPGRAM_API_KEY is not set and no PROVIDER_ID configured for dynamic loading");
}

if (!process.env.AGENT_PROMPT && !PROVIDER_ID) {
  throw new Error("AGENT_PROMPT environment variable is required and no PROVIDER_ID configured for dynamic loading");
}

/**
 * Creates and configures a Deepgram agent connection.
 * @param {string} apiKey - Deepgram API key
 * @returns {Object} Configured Deepgram agent connection
 */
function createDeepgramAgentConnection(apiKey) {
  return createClient(apiKey).agent();
}

/**
 * Handles incoming client WebSocket connection and manages communication with Deepgram's API.
 * Implements buffering for audio chunks received before WebSocket connection is established.
 * Fetches latest configuration from backend API for each new call.
 *
 * @param {WebSocket} clientWs - Client WebSocket connection
 */
const handleClientConnection = async (clientWs) => {
  console.log("New client WebSocket connection received");
  let sessionUuid = null;
  let connection = null;
  let keepAliveIntervalId = null;
  let currentConfig = null;

  function cleanup() {
    if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
    if (connection) {
      connection.disconnect();
    }
    if (clientWs) clientWs.close();
  }

  // Buffer messages received before config is loaded
  const messageBuffer = [];
  let configReady = false;

  // Buffer audio until Deepgram is configured (after Welcome + Settings)
  const audioBuffer = [];
  let deepgramReady = false;

  // Initialize Deepgram WebSocket connection (defined early so it can be called from buffered messages)
  const initializeDeepgramConnection = async () => {
    // Use config fetched at connection start
    const config = currentConfig;
    const sampleRate = Number(getConfigValue(config, 'DEEPGRAM_SAMPLE_RATE', 8000));

    connection = createDeepgramAgentConnection(getConfigValue(config, 'DEEPGRAM_API_KEY'));

    connection.on(AgentEvents.Open, () => {
      console.log("Deepgram agent WebSocket opened - sending Settings immediately");

      // Parse configuration values (from DB or env)
      const agentLanguage = getConfigValue(config, 'DEEPGRAM_AGENT_LANGUAGE', 'en');
      const outputEncoding = getConfigValue(config, 'DEEPGRAM_OUTPUT_ENCODING', 'linear16');
      const outputBitrate = getConfigValue(config, 'DEEPGRAM_OUTPUT_BITRATE')
        ? Number(getConfigValue(config, 'DEEPGRAM_OUTPUT_BITRATE'))
        : undefined;
      const temperature = getConfigValue(config, 'OPENAI_TEMPERATURE')
        ? Number(getConfigValue(config, 'OPENAI_TEMPERATURE'))
        : 0.7;
      const contextLength = getConfigValue(config, 'OPENAI_CONTEXT_LENGTH');
      const keyterms = getConfigValue(config, 'DEEPGRAM_KEYTERMS')
        ? getConfigValue(config, 'DEEPGRAM_KEYTERMS').split(",").map((k) => k.trim())
        : undefined;
      const tags = getConfigValue(config, 'DEEPGRAM_TAGS')
        ? getConfigValue(config, 'DEEPGRAM_TAGS').split(",").map((t) => t.trim())
        : undefined;
      const smartFormat = getConfigValue(config, 'DEEPGRAM_SMART_FORMAT') === "true";
      const experimental = getConfigValue(config, 'DEEPGRAM_EXPERIMENTAL') === "true";
      const mipOptOut = getConfigValue(config, 'DEEPGRAM_MIP_OPT_OUT') === "true";
      const historyEnabled = getConfigValue(config, 'DEEPGRAM_HISTORY_ENABLED') !== "false"; // Default true

      let obj = {
        type: "Settings",
        tags: tags,
        experimental: experimental,
        mip_opt_out: mipOptOut,
        flags: {
          history: historyEnabled,
        },
        audio: {
          input: {
            encoding: "linear16",
            sample_rate: sampleRate,
          },
          output: {
            encoding: outputEncoding,
            sample_rate: sampleRate,
            container: "none",
            ...(outputBitrate && { bitrate: outputBitrate }),
          },
        },
        agent: {
          language: agentLanguage,
          listen: {
            provider: {
              type: "deepgram",
              model: getConfigValue(config, 'DEEPGRAM_ASR_MODEL', 'nova-3'),
              ...(keyterms && keyterms.length > 0 && { keyterms: keyterms }),
              smart_format: smartFormat,
            },
          },
          think: {
            provider: {
              type: "open_ai",
              model: getConfigValue(config, 'OPENAI_MODEL', 'gpt-4o-mini'),
              temperature: temperature,
            },
            prompt: getConfigValue(config, 'AGENT_PROMPT'),
            ...(contextLength && {
              context_length:
                contextLength === "max" ? "max" : Number(contextLength),
            }),
          },
          speak: {
            provider: {
              type: "deepgram",
              model: getConfigValue(config, 'DEEPGRAM_TTS_MODEL', 'aura-2-thalia-en'),
            },
          },
          greeting:
            getConfigValue(config, 'DEEPGRAM_GREETING') ||
            "Hi there, I'm your virtual assistant—how can I help today?",
        },
      };

      try {
        obj.agent.think.functions = loadTools();
        console.log(`Loaded ${obj.agent.think.functions.length} tools for Deepgram`);
      } catch (error) {
        console.error(`Error loading tools for Deepgram: ${error.message}`);
      }

      // Send Settings immediately in Open event (Deepgram expects this before sending Welcome)
      connection.configure(obj);
      console.log("Deepgram agent Settings sent", obj);
    });

    connection.on(AgentEvents.Welcome, () => {
      console.log("Deepgram agent Welcome received - agent is ready");

      // Mark Deepgram as ready and flush buffered audio
      deepgramReady = true;
      console.log(`Flushing ${audioBuffer.length} buffered audio chunks`);
      for (const audioChunk of audioBuffer) {
        connection.send(audioChunk);
      }
      audioBuffer.length = 0; // Clear buffer

      keepAliveIntervalId = setInterval(() => {
        connection.keepAlive();
      }, 5000);
    });

    connection.on(AgentEvents.ConversationText, (data) => {
      // ConversationText event contains: role ('user' or 'assistant') and content
      const role = data.role === 'assistant' ? 'agent' : 'user';
      const text = data.content;

      console.log(`[TRANSCRIPT] ${role}: ${text}`);

      // Send to client WebSocket (dsai-core)
      // dsai-core will forward this to the webhook, so we don't send directly
      clientWs.send(
        JSON.stringify({
          type: "transcript",
          role: role,
          text: text,
        })
      );
    });

    connection.on(AgentEvents.Audio, (data) => {
      clientWs.send(
        JSON.stringify({
          type: "audio",
          audio: data.toString("base64"),
        })
      );
    });

    connection.on(AgentEvents.AgentAudioDone, () => {
      console.log("Deepgram agent audio done");
    });

    connection.on(AgentEvents.UserStartedSpeaking, () => {
      clientWs.send(JSON.stringify({ type: "interruption" }));
    });

    connection.on(AgentEvents.FunctionCallRequest, async (data) => {
      console.log("Deepgram agent function call request", data);
      for (const func of data.functions) {
        const handler = getToolHandler(func.name);

        if (!handler) {
          console.error(`No handler found for tool: ${func.name}`);
          continue;
        }
        
        try {
          const content = await handler(
            sessionUuid,
            JSON.parse(func.arguments)
          );
          console.log("Tool response:", content);
          connection.send(JSON.stringify({
            type: "FunctionCallResponse",
            id: func.id,
            name: func.name,
            content
          }));
        } catch (error) {
          console.error(`Error executing tool ${func.name}:`, error);
          connection.send(JSON.stringify({
            type: "FunctionCallResponse",
            id: func.id,
            name: func.name,
            content: error.message
          }));
        }
      }
    });

    connection.on(AgentEvents.Error, (err) => {
      console.error("Deepgram agent error:", err?.message || err);
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: err?.message || "Deepgram agent error",
        })
      );
      cleanup();
    });

    connection.on(AgentEvents.Close, () => {
      console.log("Deepgram agent WebSocket closed");
      cleanup();
    });

    // Explicitly connect to Deepgram agent API
    console.log("Initiating Deepgram agent connection...");
    try {
      await connection.connect();
      console.log("Deepgram agent connect() called successfully");
    } catch (error) {
      console.error("Deepgram agent connect() failed:", error);
      clientWs.send(JSON.stringify({
        type: "error",
        message: "Failed to connect to Deepgram: " + error.message,
      }));
      cleanup();
    }
  };

  // Handle client WebSocket messages (set up immediately to avoid losing messages)
  clientWs.on("message", async (data) => {
    if (!configReady) {
      // Buffer messages until config is loaded
      messageBuffer.push(data);
      return;
    }

    // Process message normally once config is ready
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case "init":
          sessionUuid = message.uuid;
          console.log("Session UUID:", sessionUuid);
          // Deepgram is already pre-warmed in handleClientConnection
          // Just set the UUID here
          break;

        case "audio":
          // Handle audio data from client
          if (message.audio && connection) {
            const audioData = Buffer.from(message.audio, "base64");
            if (deepgramReady) {
              // Deepgram is configured, send audio directly
              connection.send(audioData);
            } else {
              // Buffer audio until Deepgram is ready
              audioBuffer.push(audioData);
            }
          }
          break;

        default:
          console.log("Unknown message type from client:", message.type);
          break;
      }
    } catch (error) {
      console.error("Error processing client message:", error);
    }
  });

  // Fetch latest configuration for this call (always fetch fresh for real-time updates)
  // This ensures provider config changes apply immediately without container restart
  try {
    console.log(`[CONFIG] Starting config fetch for new connection...`);
    console.log(`[CONFIG] PROVIDER_ID: ${PROVIDER_ID || 'NOT SET'}`);
    console.log(`[CONFIG] BACKEND_URL: ${BACKEND_URL || 'NOT SET'}`);
    currentConfig = await fetchConfig(true); // Force refresh to get latest config from database
    console.log(`[CONFIG] ✅ Configuration loaded successfully for new connection`);
    console.log(`[CONFIG] Greeting: ${getConfigValue(currentConfig, 'DEEPGRAM_GREETING', 'NOT SET')}`);
    console.log(`[CONFIG] Prompt: ${getConfigValue(currentConfig, 'AGENT_PROMPT', 'NOT SET').substring(0, 60)}...`);
  } catch (error) {
    console.error(`[CONFIG] ❌ Failed to load configuration:`, error);
    console.error(`[CONFIG] Error stack:`, error.stack);
    clientWs.send(JSON.stringify({
      type: "error",
      message: "Failed to load configuration: " + error.message,
    }));
    clientWs.close();
    return;
  }

  // Validate required configuration
  const apiKey = getConfigValue(currentConfig, 'DEEPGRAM_API_KEY');
  const agentPrompt = getConfigValue(currentConfig, 'AGENT_PROMPT');

  if (!apiKey) {
    console.error("DEEPGRAM_API_KEY not configured");
    clientWs.send(JSON.stringify({
      type: "error",
      message: "DEEPGRAM_API_KEY not configured",
    }));
    clientWs.close();
    return;
  }

  if (!agentPrompt) {
    console.error("AGENT_PROMPT not configured");
    clientWs.send(JSON.stringify({
      type: "error",
      message: "AGENT_PROMPT not configured",
    }));
    clientWs.close();
    return;
  }

  // Mark config as ready and process buffered messages
  configReady = true;

  // PRE-WARM: Start Deepgram connection immediately after config loads
  // Don't wait for "init" message - this reduces latency by ~3-4 seconds
  console.log("[OPTIMIZE] Pre-warming Deepgram connection before init message...");
  await initializeDeepgramConnection();

  for (const bufferedData of messageBuffer) {
    try {
      const message = JSON.parse(bufferedData);
      switch (message.type) {
        case "init":
          sessionUuid = message.uuid;
          console.log("Session UUID (from buffer):", sessionUuid);
          // Deepgram already initialized above, just set the UUID
          break;

        case "audio":
          // Audio messages will be handled after init, so we can ignore buffered audio
          break;

        default:
          console.log("Unknown buffered message type:", message.type);
          break;
      }
    } catch (error) {
      console.error("Error processing buffered message:", error);
    }
  }
  messageBuffer.length = 0; // Clear buffer

  // Handle client WebSocket close
  clientWs.on("close", () => {
    console.log("Client WebSocket connection closed");
    cleanup();
  });

  clientWs.on("error", (err) => {
    console.error("Client WebSocket error:", err);
    cleanup();
  });
};

// Start the server
const startServer = () => {
  try {
    // Create WebSocket server
    const PORT = process.env.PORT || 6033;
    const wss = new WebSocket.Server({ port: PORT });

    wss.on("connection", (clientWs) => {
      console.log("New client connected");
      handleClientConnection(clientWs);
    });

    console.log(
      `Deepgram Speech-to-Speech WebSocket server running on port ${PORT}`
    );
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
