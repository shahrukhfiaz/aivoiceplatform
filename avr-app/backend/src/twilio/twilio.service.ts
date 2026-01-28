import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { EncryptionService } from '../common/encryption.service';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';
import { CreateTwilioNumberDto } from './dto/create-twilio-number.dto';
import { UpdateTwilioNumberDto } from './dto/update-twilio-number.dto';
import { TwilioNumber } from './twilio-number.entity';

// Response DTO that never exposes auth token
export interface TwilioNumberResponse {
  id: string;
  phoneNumber: string;
  label: string;
  accountSid: string;
  smsEnabled: boolean;
  callsEnabled: boolean;
  recordingEnabled: boolean;
  denoiseEnabled: boolean;
  agent: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(
    @InjectRepository(TwilioNumber)
    private readonly twilioNumberRepository: Repository<TwilioNumber>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateTwilioNumberDto): Promise<TwilioNumberResponse> {
    const phoneNumber = dto.phoneNumber.trim();

    // Check for duplicate phone number
    const existing = await this.twilioNumberRepository.findOne({
      where: { phoneNumber },
    });
    if (existing) {
      throw new ConflictException('Phone number already configured');
    }

    // Resolve agent if provided
    let agent: Agent | null = null;
    if (dto.agentId) {
      agent = await this.agentRepository.findOne({
        where: { id: dto.agentId },
      });
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }
    }

    // Encrypt auth token
    const authTokenEncrypted = this.encryptionService.encrypt(dto.authToken);

    const twilioNumber = this.twilioNumberRepository.create({
      phoneNumber,
      label: dto.label.trim(),
      accountSid: dto.accountSid,
      authTokenEncrypted,
      smsEnabled: dto.smsEnabled ?? false,
      callsEnabled: dto.callsEnabled ?? true,
      recordingEnabled: dto.recordingEnabled ?? false,
      denoiseEnabled: dto.denoiseEnabled ?? true,
      agent,
      agentId: dto.agentId,
    });

    const saved = await this.twilioNumberRepository.save(twilioNumber);
    this.logger.log(`Created Twilio number: ${phoneNumber}`);

    return this.toResponse(saved);
  }

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResult<TwilioNumberResponse>> {
    const { skip, take, page, limit } = getPagination(query);
    const [data, total] = await this.twilioNumberRepository.findAndCount({
      order: { label: 'ASC' },
      skip,
      take,
      relations: ['agent'],
    });

    const responseData = data.map((item) => this.toResponse(item));
    return buildPaginatedResult(responseData, total, page, limit);
  }

  async findOne(id: string): Promise<TwilioNumberResponse> {
    const twilioNumber = await this.findOneEntity(id);
    return this.toResponse(twilioNumber);
  }

  async findOneEntity(id: string): Promise<TwilioNumber> {
    const twilioNumber = await this.twilioNumberRepository.findOne({
      where: { id },
      relations: ['agent'],
    });

    if (!twilioNumber) {
      throw new NotFoundException('Twilio number not found');
    }

    return twilioNumber;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<TwilioNumber | null> {
    return this.twilioNumberRepository.findOne({
      where: { phoneNumber },
      relations: ['agent'],
    });
  }

  async update(
    id: string,
    dto: UpdateTwilioNumberDto,
  ): Promise<TwilioNumberResponse> {
    const twilioNumber = await this.findOneEntity(id);

    // Check for duplicate phone number if changing
    if (dto.phoneNumber && dto.phoneNumber.trim() !== twilioNumber.phoneNumber) {
      const existing = await this.twilioNumberRepository.findOne({
        where: { phoneNumber: dto.phoneNumber.trim() },
      });
      if (existing) {
        throw new ConflictException('Phone number already configured');
      }
      twilioNumber.phoneNumber = dto.phoneNumber.trim();
    }

    if (dto.label !== undefined) {
      twilioNumber.label = dto.label.trim();
    }

    if (dto.accountSid !== undefined) {
      twilioNumber.accountSid = dto.accountSid;
    }

    // Only re-encrypt if auth token is provided
    if (dto.authToken !== undefined && dto.authToken) {
      twilioNumber.authTokenEncrypted = this.encryptionService.encrypt(
        dto.authToken,
      );
    }

    if (dto.smsEnabled !== undefined) {
      twilioNumber.smsEnabled = dto.smsEnabled;
    }

    if (dto.callsEnabled !== undefined) {
      twilioNumber.callsEnabled = dto.callsEnabled;
    }

    if (dto.recordingEnabled !== undefined) {
      twilioNumber.recordingEnabled = dto.recordingEnabled;
    }

    if (dto.denoiseEnabled !== undefined) {
      twilioNumber.denoiseEnabled = dto.denoiseEnabled;
    }

    // Handle agent assignment
    if (dto.agentId !== undefined) {
      if (dto.agentId === null) {
        twilioNumber.agent = null;
        twilioNumber.agentId = null;
      } else {
        const agent = await this.agentRepository.findOne({
          where: { id: dto.agentId },
        });
        if (!agent) {
          throw new NotFoundException('Agent not found');
        }
        twilioNumber.agent = agent;
        twilioNumber.agentId = dto.agentId;
      }
    }

    const saved = await this.twilioNumberRepository.save(twilioNumber);
    this.logger.log(`Updated Twilio number: ${saved.phoneNumber}`);

    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const twilioNumber = await this.findOneEntity(id);
    await this.twilioNumberRepository.remove(twilioNumber);
    this.logger.log(`Removed Twilio number: ${twilioNumber.phoneNumber}`);
  }

  /**
   * Verify Twilio credentials by making a test API call
   */
  async verifyCredentials(
    id: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const twilioNumber = await this.findOneEntity(id);
    const authToken = this.encryptionService.decrypt(
      twilioNumber.authTokenEncrypted,
    );

    try {
      // Dynamic import of Twilio SDK
      const twilio = await import('twilio');
      const client = twilio.default(twilioNumber.accountSid, authToken);

      // Test by fetching account info
      await client.api.accounts(twilioNumber.accountSid).fetch();

      this.logger.log(
        `Verified Twilio credentials for: ${twilioNumber.phoneNumber}`,
      );
      return { valid: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to verify Twilio credentials for ${twilioNumber.phoneNumber}: ${errorMessage}`,
      );
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Get decrypted auth token for a Twilio number (internal use only)
   */
  getDecryptedAuthToken(twilioNumber: TwilioNumber): string {
    return this.encryptionService.decrypt(twilioNumber.authTokenEncrypted);
  }

  private toResponse(entity: TwilioNumber): TwilioNumberResponse {
    return {
      id: entity.id,
      phoneNumber: entity.phoneNumber,
      label: entity.label,
      accountSid: entity.accountSid,
      // Never expose auth token
      smsEnabled: entity.smsEnabled,
      callsEnabled: entity.callsEnabled,
      recordingEnabled: entity.recordingEnabled,
      denoiseEnabled: entity.denoiseEnabled,
      agent: entity.agent
        ? { id: entity.agent.id, name: entity.agent.name }
        : null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
