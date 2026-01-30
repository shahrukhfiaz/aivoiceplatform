import { Injectable, Logger, OnModuleInit, OnModuleDestroy, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { TwilioNumber } from './twilio-number.entity';
import { Agent, AgentStatus } from '../agents/agent.entity';
import { WebhooksService } from '../webhooks/webhooks.service';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Audio recorder for Twilio calls
 * Captures both channels and writes to WAV file
 */
class TwilioCallRecorder {
  private readonly logger = new Logger(TwilioCallRecorder.name);
  private inboundChunks: Buffer[] = [];  // Audio from caller (mulaw from Twilio)
  private outboundChunks: Buffer[] = [];  // Audio from agent (linear16 from STS)
  private isRecording = false;
  private readonly callUuid: string;
  private readonly sampleRate = 8000;  // Twilio uses 8kHz

  constructor(callUuid: string) {
    this.callUuid = callUuid;
  }

  start() {
    this.isRecording = true;
    this.logger.log(`Started recording for call ${this.callUuid}`);
  }

  addInboundAudio(mulawBuffer: Buffer) {
    if (this.isRecording) {
      // Convert mulaw to linear16 for recording
      const linearBuffer = this.mulawToLinear16(mulawBuffer);
      this.inboundChunks.push(linearBuffer);
    }
  }

  addOutboundAudio(linearBuffer: Buffer) {
    if (this.isRecording) {
      // Downsample from 16kHz to 8kHz if needed (STS may use 16kHz)
      // For simplicity, we'll store as-is and let the final mix handle it
      this.outboundChunks.push(linearBuffer);
    }
  }

  async stop(): Promise<string | null> {
    this.isRecording = false;
    this.logger.log(`Stopping recording for call ${this.callUuid}`);

    try {
      // Combine all chunks
      const inboundAudio = Buffer.concat(this.inboundChunks);
      const outboundAudio = Buffer.concat(this.outboundChunks);

      if (inboundAudio.length === 0 && outboundAudio.length === 0) {
        this.logger.warn(`No audio recorded for call ${this.callUuid}`);
        return null;
      }

      // Mix the two channels into mono WAV
      const mixedAudio = this.mixChannels(inboundAudio, outboundAudio);
      const wavData = this.createWavFile(mixedAudio, this.sampleRate, 1, 16);

      // Save to the same location Asterisk uses
      const filePath = await this.saveRecording(wavData);
      this.logger.log(`Saved recording to ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error(`Failed to save recording: ${error}`);
      return null;
    }
  }

  private mixChannels(channel1: Buffer, channel2: Buffer): Buffer {
    // Make channels the same length by padding with silence
    const maxLength = Math.max(channel1.length, channel2.length);
    const ch1 = Buffer.alloc(maxLength);
    const ch2 = Buffer.alloc(maxLength);
    channel1.copy(ch1);
    channel2.copy(ch2);

    // Mix the two channels (average)
    const mixed = Buffer.alloc(maxLength);
    for (let i = 0; i < maxLength; i += 2) {
      if (i + 1 < maxLength) {
        const sample1 = ch1.readInt16LE(i);
        const sample2 = ch2.readInt16LE(i);
        // Mix by averaging (prevents clipping)
        const mixedSample = Math.round((sample1 + sample2) / 2);
        mixed.writeInt16LE(Math.max(-32768, Math.min(32767, mixedSample)), i);
      }
    }

    return mixed;
  }

  private createWavFile(audioData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = audioData.length;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);

    // fmt subchunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);  // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20);   // AudioFormat (1 for PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data subchunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, audioData]);
  }

  private async saveRecording(wavData: Buffer): Promise<string> {
    const tenant = process.env.TENANT || 'demo';
    const monitorPath = process.env.ASTERISK_MONITOR_PATH || '../recordings';
    const basePath = path.isAbsolute(monitorPath)
      ? monitorPath
      : path.resolve(process.cwd(), monitorPath);
    const tenantPath = path.join(basePath, tenant);

    // Ensure directory exists
    await fs.mkdir(tenantPath, { recursive: true });

    const filePath = path.join(tenantPath, `${this.callUuid}.wav`);
    await fs.writeFile(filePath, wavData);

    return filePath;
  }

  private mulawToLinear16(mulawBuffer: Buffer): Buffer {
    const linearBuffer = Buffer.alloc(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
      const mulaw = mulawBuffer[i];
      const linear = this.mulawDecode(mulaw);
      linearBuffer.writeInt16LE(linear, i * 2);
    }
    return linearBuffer;
  }

  private mulawDecode(mulaw: number): number {
    const MULAW_BIAS = 33;
    mulaw = ~mulaw;
    const sign = (mulaw & 0x80) ? -1 : 1;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0F;
    let linear = ((mantissa << 3) + MULAW_BIAS) << exponent;
    linear -= MULAW_BIAS;
    return sign * linear;
  }
}

/**
 * Twilio Media Stream Gateway
 *
 * This gateway bridges Twilio Media Streams to the Deepgram STS container.
 * It handles:
 * 1. WebSocket connections from Twilio
 * 2. Audio format conversion (mulaw <-> linear16)
 * 3. Protocol translation between Twilio and STS formats
 */
@Injectable()
export class TwilioMediaStreamGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TwilioMediaStreamGateway.name);
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;

  constructor(
    @InjectRepository(TwilioNumber)
    private readonly twilioNumberRepo: Repository<TwilioNumber>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @Inject(forwardRef(() => WebhooksService))
    private readonly webhooksService: WebhooksService,
  ) {}

  onModuleInit() {
    this.logger.log('TwilioMediaStreamGateway initialized - waiting for HTTP server');
  }

  onModuleDestroy() {
    if (this.wss) {
      this.wss.close();
      this.logger.log('WebSocket server closed');
    }
  }

  /**
   * Initialize the WebSocket server with the HTTP server
   * Called from main.ts after NestJS app is created
   */
  initializeWebSocket(server: HttpServer) {
    this.httpServer = server;

    this.wss = new WebSocketServer({
      server,
      path: '/twilio/media-stream',
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });

    this.logger.log('Twilio Media Stream WebSocket server started on /twilio/media-stream');
  }

  /**
   * Handle new WebSocket connection from Twilio
   */
  private async handleConnection(twilioWs: WebSocket, req: any) {
    this.logger.log('New Twilio Media Stream connection');

    let stsWs: WebSocket | null = null;
    let streamSid: string | null = null;
    let callSid: string | null = null;
    let agentId: string | null = null;
    let agentPort: number | null = null;
    let callUuid: string | null = null;
    let isInitialized = false;
    let recorder: TwilioCallRecorder | null = null;
    let recordingEnabled = false;

    // Handle messages from Twilio
    twilioWs.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.event) {
          case 'connected':
            this.logger.log('Twilio Media Stream connected');
            break;

          case 'start':
            // Extract stream info from Twilio's start event
            streamSid = message.start?.streamSid;
            callSid = message.start?.callSid;

            // Extract custom parameters from TwiML
            const customParams = message.start?.customParameters || {};
            agentId = customParams.agentId;
            agentPort = customParams.agentPort ? parseInt(customParams.agentPort) : null;
            const stsPort = customParams.stsPort ? parseInt(customParams.stsPort) : 6678;
            callUuid = customParams.callUuid;
            recordingEnabled = customParams.recordingEnabled === 'true';

            this.logger.log(`Stream started: ${streamSid}, Call: ${callSid}, Agent: ${agentId}, STS Port: ${stsPort}, Recording: ${recordingEnabled}`);

            // Initialize recorder if enabled
            if (recordingEnabled && callUuid) {
              recorder = new TwilioCallRecorder(callUuid);
              recorder.start();
            }

            // Connect to the STS container
            if (agentId) {
              stsWs = await this.connectToSTS(agentId, stsPort, callUuid || 'unknown');

              if (stsWs) {
                isInitialized = true;
                this.setupSTSHandlers(stsWs, twilioWs, streamSid, callUuid, recorder);

                // Send call_started event now that the call is connected to STS
                if (callUuid) {
                  this.webhooksService
                    .handleEvent({
                      uuid: callUuid,
                      type: 'call_started',
                      timestamp: new Date().toISOString(),
                      payload: {
                        source: 'twilio',
                        twilioCallSid: callSid,
                        streamSid: streamSid,
                      },
                    })
                    .catch((err) =>
                      this.logger.error(`Failed to send call_started: ${err.message}`),
                    );
                }
              } else {
                this.logger.error('Failed to connect to STS container');
                twilioWs.close();
              }
            } else {
              this.logger.error('Missing agentId in start event');
              twilioWs.close();
            }
            break;

          case 'media':
            // Forward audio from Twilio to STS
            if (stsWs && stsWs.readyState === WebSocket.OPEN && isInitialized) {
              const audioPayload = message.media?.payload;
              if (audioPayload) {
                // Convert mulaw to linear16 and forward to STS
                const mulawBuffer = Buffer.from(audioPayload, 'base64');
                const linearBuffer = this.mulawToLinear16(mulawBuffer);

                // Record inbound audio (from caller)
                if (recorder) {
                  recorder.addInboundAudio(mulawBuffer);
                }

                stsWs.send(JSON.stringify({
                  type: 'audio',
                  audio: linearBuffer.toString('base64'),
                }));
              }
            }
            break;

          case 'stop':
            this.logger.log('Twilio Media Stream stopped');
            // Send call_ended event
            if (callUuid) {
              this.webhooksService
                .handleEvent({
                  uuid: callUuid,
                  type: 'call_ended',
                  timestamp: new Date().toISOString(),
                  payload: {
                    source: 'twilio',
                    twilioCallSid: callSid,
                    reason: 'completed',
                  },
                })
                .catch((err) =>
                  this.logger.error(`Failed to send call_ended: ${err.message}`),
                );
            }
            // Stop recording and save
            if (recorder) {
              recorder.stop().catch((err) =>
                this.logger.error(`Failed to save recording: ${err}`),
              );
            }
            if (stsWs) {
              stsWs.close();
            }
            break;

          case 'mark':
            // Handle mark events (used for audio synchronization)
            this.logger.debug(`Mark event: ${message.mark?.name}`);
            break;

          default:
            this.logger.debug(`Unknown Twilio event: ${message.event}`);
        }
      } catch (error) {
        this.logger.error('Error processing Twilio message:', error);
      }
    });

    twilioWs.on('close', () => {
      this.logger.log('Twilio WebSocket closed');
      // Stop recording and save
      if (recorder) {
        recorder.stop().catch((err) =>
          this.logger.error(`Failed to save recording: ${err}`),
        );
      }
      if (stsWs) {
        stsWs.close();
      }
    });

    twilioWs.on('error', (error) => {
      this.logger.error('Twilio WebSocket error:', error);
      if (stsWs) {
        stsWs.close();
      }
    });
  }

  /**
   * Connect to the STS container's WebSocket server
   */
  private async connectToSTS(agentId: string, stsPort: number, callUuid: string): Promise<WebSocket | null> {
    try {
      // Get agent to find STS container info
      const agent = await this.agentRepo.findOne({ where: { id: agentId } });
      if (!agent) {
        this.logger.error(`Agent not found: ${agentId}`);
        return null;
      }

      // Build STS WebSocket URL
      // The STS port is dynamically assigned when the container starts and passed via TwiML
      const stsContainerName = `dsai-sts-${agentId}`;
      const stsUrl = `ws://${stsContainerName}:${stsPort}`;

      this.logger.log(`Connecting to STS at ${stsUrl}`);

      return new Promise((resolve, reject) => {
        const ws = new WebSocket(stsUrl);

        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('STS connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          this.logger.log('Connected to STS container');

          // Send init message to STS
          ws.send(JSON.stringify({
            type: 'init',
            uuid: callUuid,
          }));

          resolve(ws);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.logger.error('STS connection error:', error);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error('Failed to connect to STS:', error);
      return null;
    }
  }

  /**
   * Set up handlers for STS WebSocket messages
   */
  private setupSTSHandlers(
    stsWs: WebSocket,
    twilioWs: WebSocket,
    streamSid: string | null,
    callUuid: string | null,
    recorder: TwilioCallRecorder | null,
  ) {
    stsWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'audio':
            // Forward audio from STS to Twilio
            if (twilioWs.readyState === WebSocket.OPEN && message.audio) {
              // Convert linear16 to mulaw for Twilio
              const linearBuffer = Buffer.from(message.audio, 'base64');
              const mulawBuffer = this.linear16ToMulaw(linearBuffer);

              // Record outbound audio (from agent)
              if (recorder) {
                recorder.addOutboundAudio(linearBuffer);
              }

              twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid: streamSid,
                media: {
                  payload: mulawBuffer.toString('base64'),
                },
              }));
            }
            break;

          case 'transcript':
            // Log and forward transcripts to webhooks service
            this.logger.debug(`Transcript [${message.role}]: ${message.text}`);
            // Forward to webhooks service to create CallEvent record
            if (callUuid && message.text) {
              this.webhooksService
                .handleEvent({
                  uuid: callUuid,
                  type: 'transcription',
                  timestamp: new Date().toISOString(),
                  payload: {
                    role: message.role || 'unknown',
                    text: message.text,
                    source: 'twilio',
                  },
                })
                .catch((err) =>
                  this.logger.error(`Failed to save transcript: ${err.message}`),
                );
            }
            break;

          case 'interruption':
            // Handle barge-in/interruption
            this.logger.debug('User interruption detected');
            // Forward to webhooks service
            if (callUuid) {
              this.webhooksService
                .handleEvent({
                  uuid: callUuid,
                  type: 'interruption',
                  timestamp: new Date().toISOString(),
                  payload: { source: 'twilio' },
                })
                .catch((err) =>
                  this.logger.error(`Failed to save interruption: ${err.message}`),
                );
            }
            // Send clear message to Twilio to stop playing audio
            if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
              twilioWs.send(JSON.stringify({
                event: 'clear',
                streamSid: streamSid,
              }));
            }
            break;

          case 'error':
            this.logger.error(`STS error: ${message.message}`);
            break;

          default:
            this.logger.debug(`Unknown STS message type: ${message.type}`);
        }
      } catch (error) {
        this.logger.error('Error processing STS message:', error);
      }
    });

    stsWs.on('close', () => {
      this.logger.log('STS WebSocket closed');
      twilioWs.close();
    });

    stsWs.on('error', (error) => {
      this.logger.error('STS WebSocket error:', error);
      twilioWs.close();
    });
  }

  /**
   * Convert mulaw audio to linear16 PCM
   * Mulaw is 8-bit, linear16 is 16-bit signed
   */
  private mulawToLinear16(mulawBuffer: Buffer): Buffer {
    const linearBuffer = Buffer.alloc(mulawBuffer.length * 2);

    for (let i = 0; i < mulawBuffer.length; i++) {
      const mulaw = mulawBuffer[i];
      const linear = this.mulawDecode(mulaw);
      linearBuffer.writeInt16LE(linear, i * 2);
    }

    return linearBuffer;
  }

  /**
   * Convert linear16 PCM to mulaw
   */
  private linear16ToMulaw(linearBuffer: Buffer): Buffer {
    const mulawBuffer = Buffer.alloc(linearBuffer.length / 2);

    for (let i = 0; i < mulawBuffer.length; i++) {
      const linear = linearBuffer.readInt16LE(i * 2);
      mulawBuffer[i] = this.mulawEncode(linear);
    }

    return mulawBuffer;
  }

  /**
   * Decode a single mulaw byte to linear16
   */
  private mulawDecode(mulaw: number): number {
    const MULAW_BIAS = 33;
    mulaw = ~mulaw;

    const sign = (mulaw & 0x80) ? -1 : 1;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0F;

    let linear = ((mantissa << 3) + MULAW_BIAS) << exponent;
    linear -= MULAW_BIAS;

    return sign * linear;
  }

  /**
   * Encode a linear16 sample to mulaw
   */
  private mulawEncode(linear: number): number {
    const MULAW_BIAS = 33;
    const MULAW_MAX = 0x1FFF;

    const sign = linear < 0 ? 0x80 : 0;
    if (linear < 0) linear = -linear;

    linear = Math.min(linear, MULAW_MAX);
    linear += MULAW_BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; exponent > 0 && !(linear & expMask); exponent--, expMask >>= 1);

    const mantissa = (linear >> (exponent + 3)) & 0x0F;
    const mulaw = ~(sign | (exponent << 4) | mantissa);

    return mulaw & 0xFF;
  }
}
