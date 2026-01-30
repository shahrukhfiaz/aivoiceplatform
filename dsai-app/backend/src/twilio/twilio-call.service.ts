import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TwilioNumber } from './twilio-number.entity';
import { EncryptionService } from '../common/encryption.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AgentsService } from '../agents/agents.service';
import { Agent, AgentStatus } from '../agents/agent.entity';
import { v4 as uuidv4 } from 'uuid';

export interface TwiMLOptions {
  twilioNumber: TwilioNumber;
  callSid: string;
  from: string;
  to: string;
  callUuid: string;
}

@Injectable()
export class TwilioCallService {
  private readonly logger = new Logger(TwilioCallService.name);

  constructor(
    @InjectRepository(TwilioNumber)
    private readonly twilioNumberRepo: Repository<TwilioNumber>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly encryptionService: EncryptionService,
    private readonly webhooksService: WebhooksService,
    private readonly agentsService: AgentsService,
  ) {}

  /**
   * Find Twilio number by ID
   */
  async findNumberById(id: string): Promise<TwilioNumber | null> {
    return this.twilioNumberRepo.findOne({
      where: { id },
      relations: ['agent'],
    });
  }

  /**
   * Find Twilio number by phone number (E.164)
   */
  async findNumberByPhoneNumber(phoneNumber: string): Promise<TwilioNumber | null> {
    return this.twilioNumberRepo.findOne({
      where: { phoneNumber },
      relations: ['agent'],
    });
  }

  /**
   * Handle incoming voice call from Twilio webhook
   * Returns TwiML to connect the call to the AI agent
   */
  async handleInboundCall(
    numberId: string,
    callSid: string,
    from: string,
    to: string,
  ): Promise<string> {
    // 1. Find the Twilio number configuration
    const twilioNumber = await this.findNumberById(numberId);
    if (!twilioNumber) {
      this.logger.error(`Twilio number not found: ${numberId}`);
      return this.generateRejectTwiML('Number not configured');
    }

    // 2. Check if calls are enabled
    if (!twilioNumber.callsEnabled) {
      this.logger.warn(`Calls disabled for number: ${twilioNumber.phoneNumber}`);
      return this.generateRejectTwiML('Calls are disabled');
    }

    // 3. Check if agent is assigned
    if (!twilioNumber.agent) {
      this.logger.warn(`No agent assigned to number: ${twilioNumber.phoneNumber}`);
      return this.generateRejectTwiML('No agent available');
    }

    const agent = twilioNumber.agent;

    // 4. Check if agent is running
    if (agent.status !== AgentStatus.RUNNING) {
      this.logger.warn(`Agent not running: ${agent.id}`);
      return this.generateRejectTwiML('Agent not available');
    }

    // 5. Generate unique call UUID
    const callUuid = uuidv4();

    // 6. Create call record in webhooks service
    await this.webhooksService.handleEvent({
      uuid: callUuid,
      type: 'call_initiated',
      timestamp: new Date().toISOString(),
      payload: {
        direction: 'inbound',
        from,
        to,
        source: 'twilio',
        twilioCallSid: callSid,
        twilioNumberId: twilioNumber.id,
      },
    }, agent.id);

    // 7. Generate TwiML with Media Streams
    return await this.generateMediaStreamTwiML({
      twilioNumber,
      callSid,
      from,
      to,
      callUuid,
    });
  }

  /**
   * Handle call status updates from Twilio
   */
  async handleStatusCallback(
    numberId: string,
    callSid: string,
    callStatus: string,
    callDuration?: string,
  ): Promise<void> {
    this.logger.log(`Call status update: ${callSid} -> ${callStatus}`);

    // Use the webhooks service to handle the status callback
    // It will look up the call by twilioCallSid and update accordingly
    const duration = callDuration ? parseInt(callDuration, 10) : undefined;
    await this.webhooksService.handleTwilioStatusCallback(callSid, callStatus, duration);

    // When call ends, fetch the actual cost from Twilio asynchronously
    if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(callStatus)) {
      this.fetchAndSaveTwilioCost(numberId, callSid).catch((err) =>
        this.logger.error(`Failed to fetch Twilio cost: ${err.message}`),
      );
    }
  }

  /**
   * Fetch call details from Twilio and save the cost
   */
  private async fetchAndSaveTwilioCost(numberId: string, callSid: string): Promise<void> {
    const twilioNumber = await this.findNumberById(numberId);
    if (!twilioNumber) {
      this.logger.warn(`Twilio number not found for cost fetch: ${numberId}`);
      return;
    }

    try {
      const authToken = this.encryptionService.decrypt(twilioNumber.authTokenEncrypted);
      const twilio = await import('twilio');
      const client = twilio.default(twilioNumber.accountSid, authToken);

      // Fetch call details from Twilio
      const callDetails = await client.calls(callSid).fetch();

      if (callDetails.price != null) {
        // Twilio returns price as a negative number (charge)
        const cost = Math.abs(parseFloat(callDetails.price));

        // Update the call record with Twilio cost
        await this.webhooksService.updateTwilioCost(callSid, cost);

        this.logger.log(`Twilio cost saved for call ${callSid}: $${cost} ${callDetails.priceUnit}`);
      } else {
        this.logger.debug(`No price available yet for call ${callSid}`);
      }
    } catch (error) {
      this.logger.error(`Error fetching Twilio call details: ${error}`);
    }
  }

  /**
   * Initiate outbound call via Twilio
   */
  async initiateOutboundCall(
    numberId: string,
    toNumber: string,
    options?: {
      statusCallback?: string;
      timeout?: number;
    },
  ): Promise<{ callSid: string; callUuid: string }> {
    // 1. Find the Twilio number
    const twilioNumber = await this.findNumberById(numberId);
    if (!twilioNumber) {
      throw new NotFoundException('Twilio number not found');
    }

    // 2. Check if calls are enabled
    if (!twilioNumber.callsEnabled) {
      throw new BadRequestException('Calls are disabled for this number');
    }

    // 3. Check if agent is assigned and running
    if (!twilioNumber.agent) {
      throw new BadRequestException('No agent assigned to this number');
    }

    if (twilioNumber.agent.status !== AgentStatus.RUNNING) {
      throw new BadRequestException('Agent must be running to initiate calls');
    }

    // 4. Decrypt auth token
    const authToken = this.encryptionService.decrypt(twilioNumber.authTokenEncrypted);

    // 5. Create Twilio client
    const twilio = await import('twilio');
    const client = twilio.default(twilioNumber.accountSid, authToken);

    // 6. Generate call UUID
    const callUuid = uuidv4();

    // 7. Build webhook URL for TwiML
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    const twimlUrl = `${publicUrl}/twilio/webhook/voice/${numberId}?callUuid=${callUuid}`;
    const statusCallbackUrl = options?.statusCallback || `${publicUrl}/twilio/webhook/status/${numberId}`;

    // 8. Make the call
    const call = await client.calls.create({
      to: toNumber,
      from: twilioNumber.phoneNumber,
      url: twimlUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      timeout: options?.timeout || 30,
      record: twilioNumber.recordingEnabled,
    });

    this.logger.log(`Initiated outbound call: ${call.sid} to ${toNumber}`);

    // 9. Create call record
    await this.webhooksService.handleEvent({
      uuid: callUuid,
      type: 'call_initiated',
      timestamp: new Date().toISOString(),
      payload: {
        direction: 'outbound',
        from: twilioNumber.phoneNumber,
        to: toNumber,
        source: 'twilio',
        twilioCallSid: call.sid,
        twilioNumberId: twilioNumber.id,
      },
    }, twilioNumber.agent.id);

    return {
      callSid: call.sid,
      callUuid,
    };
  }

  /**
   * Generate TwiML for Media Streams connection to AI agent
   */
  private async generateMediaStreamTwiML(options: TwiMLOptions): Promise<string> {
    const { twilioNumber, callUuid } = options;
    const agent = twilioNumber.agent!;

    // Get the STS URL from the running container
    const providerUrls = await this.agentsService.getProviderUrlsForAgent(agent.id);
    const stsUrl = providerUrls.stsUrl;

    // Extract port from STS URL (e.g., ws://dsai-sts-xxx:6429 -> 6429)
    let stsPort = '6678'; // fallback
    if (stsUrl) {
      const portMatch = stsUrl.match(/:(\d+)$/);
      if (portMatch) {
        stsPort = portMatch[1];
      }
    }

    this.logger.log(`STS URL: ${stsUrl}, extracted port: ${stsPort}`);

    // Media stream URL should connect to our Twilio Media Stream gateway
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    const mediaStreamUrl = `${publicUrl.replace('http', 'ws').replace('https', 'wss')}/twilio/media-stream`;

    // Generate TwiML with Media Streams
    // Recording is handled by the Media Stream Gateway if recordingEnabled is true
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${mediaStreamUrl}">
      <Parameter name="callUuid" value="${callUuid}" />
      <Parameter name="agentId" value="${agent.id}" />
      <Parameter name="agentPort" value="${agent.port}" />
      <Parameter name="stsPort" value="${stsPort}" />
      <Parameter name="twilioNumberId" value="${twilioNumber.id}" />
      <Parameter name="recordingEnabled" value="${twilioNumber.recordingEnabled}" />
    </Stream>
  </Connect>
</Response>`;

    return twiml;
  }

  /**
   * Generate TwiML to reject a call with a message
   */
  private generateRejectTwiML(reason: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${reason}</Say>
  <Hangup />
</Response>`;
  }

  /**
   * Verify Twilio webhook signature
   */
  async verifyWebhookSignature(
    numberId: string,
    signature: string,
    url: string,
    params: Record<string, string>,
  ): Promise<boolean> {
    const twilioNumber = await this.findNumberById(numberId);
    if (!twilioNumber) {
      return false;
    }

    const authToken = this.encryptionService.decrypt(twilioNumber.authTokenEncrypted);
    const twilio = await import('twilio');

    return twilio.validateRequest(authToken, signature, url, params);
  }
}
