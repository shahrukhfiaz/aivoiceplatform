import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrunksService } from '../trunks/trunks.service';
import { Trunk } from '../trunks/trunk.entity';
import { Agent } from '../agents/agent.entity';
import { TwilioNumber } from './twilio-number.entity';
import { getTwilioIpsAsString } from '../trunks/twilio-ip-ranges';

export interface CreateTwilioTrunkDto {
  name: string;
  phoneNumber: string;  // E.164 format (e.g., +14155551234)
  agentId: string;
  recordingEnabled?: boolean;
  denoiseEnabled?: boolean;
}

export interface ProvisionSipTrunkDto {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  label: string;
  agentId: string;
  recordingEnabled?: boolean;
  denoiseEnabled?: boolean;
}

export interface ProvisionSipTrunkResult {
  trunk: Trunk;
  twilioTrunkSid: string;
  originationUrlSid: string;
}

@Injectable()
export class TwilioTrunkService {
  private readonly logger = new Logger(TwilioTrunkService.name);

  constructor(
    private readonly trunksService: TrunksService,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(TwilioNumber)
    private readonly twilioNumberRepository: Repository<TwilioNumber>,
    @InjectRepository(Trunk)
    private readonly trunkRepository: Repository<Trunk>,
  ) {}

  /**
   * Create a new Twilio SIP trunk for inbound calls
   * This creates a trunk configured for Twilio Elastic SIP Trunking
   */
  async createTwilioTrunk(dto: CreateTwilioTrunkDto): Promise<Trunk> {
    // Validate agent exists
    const agent = await this.agentRepository.findOne({
      where: { id: dto.agentId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Normalize phone number to use as DID
    const didNumber = this.normalizePhoneNumber(dto.phoneNumber);

    this.logger.log(`Creating Twilio SIP trunk for ${didNumber} -> Agent ${agent.name}`);

    // Create the trunk with Twilio-specific settings
    const trunk = await this.trunksService.create({
      name: dto.name,
      direction: 'inbound',
      providerType: 'twilio',
      transport: 'udp',
      codecs: 'ulaw,alaw',
      didNumber,
      agentId: dto.agentId,
      allowedIps: getTwilioIpsAsString(),
      recordingEnabled: dto.recordingEnabled ?? true,
      denoiseEnabled: dto.denoiseEnabled ?? true,
      // No host/port/username/password needed for inbound Twilio trunks
      // Twilio identifies via IP ACL
    });

    this.logger.log(`Created Twilio SIP trunk: ${trunk.id}`);

    return trunk;
  }

  /**
   * Migrate an existing TwilioNumber to a SIP Trunk
   * This converts from Twilio Media Streams to Elastic SIP Trunking
   */
  async migrateToSipTrunk(twilioNumberId: string): Promise<Trunk> {
    const twilioNumber = await this.twilioNumberRepository.findOne({
      where: { id: twilioNumberId },
      relations: ['agent'],
    });

    if (!twilioNumber) {
      throw new NotFoundException('Twilio number not found');
    }

    if (!twilioNumber.agent) {
      throw new BadRequestException('Twilio number must have an assigned agent to migrate');
    }

    this.logger.log(`Migrating TwilioNumber ${twilioNumber.phoneNumber} to SIP Trunk`);

    // Create equivalent trunk
    const trunk = await this.createTwilioTrunk({
      name: `twilio-${twilioNumber.label || twilioNumber.phoneNumber}`,
      phoneNumber: twilioNumber.phoneNumber,
      agentId: twilioNumber.agent.id,
      recordingEnabled: twilioNumber.recordingEnabled,
      denoiseEnabled: true,
    });

    this.logger.log(`Migration complete: TwilioNumber ${twilioNumberId} -> Trunk ${trunk.id}`);

    return trunk;
  }

  /**
   * Get all Twilio SIP trunks
   */
  async findAllTwilioTrunks(): Promise<Trunk[]> {
    return this.trunkRepository.find({
      where: { providerType: 'twilio' },
      relations: ['agent'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Find a Twilio trunk by DID number
   */
  async findByDidNumber(didNumber: string): Promise<Trunk | null> {
    const normalized = this.normalizePhoneNumber(didNumber);
    return this.trunkRepository.findOne({
      where: {
        providerType: 'twilio',
        didNumber: normalized,
      },
      relations: ['agent'],
    });
  }

  /**
   * Provision a complete Twilio SIP trunk via Twilio API
   * This automatically:
   * 1. Creates a SIP trunk in Twilio
   * 2. Creates an origination URL pointing to our Asterisk server
   * 3. Associates the phone number with the trunk
   * 4. Creates the local trunk in our database
   */
  async provisionTwilioSipTrunk(dto: ProvisionSipTrunkDto): Promise<ProvisionSipTrunkResult> {
    this.logger.log(`Provisioning Twilio SIP trunk for ${dto.phoneNumber}`);

    // Validate agent exists
    const agent = await this.agentRepository.findOne({
      where: { id: dto.agentId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Import Twilio client
    const twilio = await import('twilio');
    const client = twilio.default(dto.accountSid, dto.authToken);

    try {
      // 1. Get the phone number SID from Twilio
      const normalizedPhone = this.normalizePhoneNumber(dto.phoneNumber);
      const numbers = await client.incomingPhoneNumbers.list({
        phoneNumber: normalizedPhone,
      });

      if (numbers.length === 0) {
        throw new BadRequestException(`Phone number ${normalizedPhone} not found in your Twilio account`);
      }

      const phoneNumberSid = numbers[0].sid;
      this.logger.log(`Found phone number SID: ${phoneNumberSid}`);

      // 2. Create the Twilio SIP Trunk
      const trunkName = `dsai-${dto.label.replace(/[^a-zA-Z0-9-]/g, '-')}`;
      const domainName = `dsai-${Date.now()}.pstn.twilio.com`;

      const twilioTrunk = await client.trunking.v1.trunks.create({
        friendlyName: trunkName,
        domainName: domainName,
      });

      this.logger.log(`Created Twilio SIP trunk: ${twilioTrunk.sid}`);

      // 3. Create Origination URL (points incoming calls to our Asterisk)
      // Prefer domain (PUBLIC_HOST) over IP for better maintainability
      const sipHost = process.env.PUBLIC_HOST || process.env.PUBLIC_IP || process.env.PUBLIC_URL?.replace(/https?:\/\//, '').split(':')[0];
      if (!sipHost) {
        // Clean up the trunk we just created
        await client.trunking.v1.trunks(twilioTrunk.sid).remove();
        throw new BadRequestException('PUBLIC_HOST or PUBLIC_IP environment variable not set');
      }

      const originationUrl = await client.trunking.v1
        .trunks(twilioTrunk.sid)
        .originationUrls.create({
          friendlyName: 'Asterisk Server',
          sipUrl: `sip:${sipHost}:5060`,
          weight: 10,
          priority: 10,
          enabled: true,
        });

      this.logger.log(`Created origination URL: ${originationUrl.sid} -> sip:${sipHost}:5060`);

      // 4. Associate the phone number with the trunk
      await client.trunking.v1
        .trunks(twilioTrunk.sid)
        .phoneNumbers.create({
          phoneNumberSid: phoneNumberSid,
        });

      this.logger.log(`Associated phone number ${normalizedPhone} with trunk ${twilioTrunk.sid}`);

      // 5. Create the local trunk in our database
      const trunk = await this.createTwilioTrunk({
        name: dto.label,
        phoneNumber: dto.phoneNumber,
        agentId: dto.agentId,
        recordingEnabled: dto.recordingEnabled,
        denoiseEnabled: dto.denoiseEnabled,
      });

      this.logger.log(`Provisioning complete: Local trunk ${trunk.id}, Twilio trunk ${twilioTrunk.sid}`);

      return {
        trunk,
        twilioTrunkSid: twilioTrunk.sid,
        originationUrlSid: originationUrl.sid,
      };
    } catch (error) {
      this.logger.error(`Failed to provision Twilio SIP trunk: ${error}`);

      // Re-throw with more context if it's a Twilio error
      if (error instanceof Error && error.message.includes('Twilio')) {
        throw new BadRequestException(`Twilio API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume US number if 10 digits
      if (normalized.length === 10) {
        normalized = '+1' + normalized;
      } else if (normalized.length === 11 && normalized.startsWith('1')) {
        normalized = '+' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }
}
