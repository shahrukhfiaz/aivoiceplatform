import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AsteriskService } from '../asterisk/asterisk.service';
import { Agent } from '../agents/agent.entity';
import { CreateTrunkDto } from './dto/create-trunk.dto';
import { UpdateTrunkDto } from './dto/update-trunk.dto';
import { Trunk, TrunkDirection } from './trunk.entity';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';

@Injectable()
export class TrunksService {
  constructor(
    @InjectRepository(Trunk)
    private readonly trunksRepository: Repository<Trunk>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly asteriskService: AsteriskService,
  ) {}

  async create(dto: CreateTrunkDto): Promise<Trunk> {
    const name = dto.name.trim();

    const existing = await this.trunksRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException('Trunk name already exists');
    }

    // Generate password if not provided
    const password = dto.password || randomBytes(12).toString('base64url');

    const transport = dto.transport ?? 'udp';
    const codecs = this.normalizeCodecs(dto.codecs);
    const direction = dto.direction;

    // Validate direction-specific requirements
    if (direction === 'outbound' && !dto.host) {
      throw new BadRequestException('Host is required for outbound trunks');
    }

    // Resolve agent for inbound trunks
    let agent: Agent | null = null;
    if (dto.agentId) {
      agent = await this.agentRepository.findOne({
        where: { id: dto.agentId },
      });
      if (!agent) {
        throw new NotFoundException('Agent not found');
      }
    }

    const trunk = this.trunksRepository.create({
      name,
      direction,
      providerType: dto.providerType ?? 'generic',
      host: dto.host,
      port: dto.port ?? 5060,
      username: dto.username,
      password,
      transport,
      codecs,
      didNumber: dto.didNumber,
      agent,
      agentId: dto.agentId,
      allowedIps: dto.allowedIps,
      registerEnabled: dto.registerEnabled ?? false,
      registerInterval: dto.registerInterval ?? 120,
      outboundCallerId: dto.outboundCallerId,
      recordingEnabled: dto.recordingEnabled ?? false,
      denoiseEnabled: dto.denoiseEnabled ?? true,
    });

    const saved = await this.trunksRepository.save(trunk);

    try {
      await this.asteriskService.provisionTrunk(saved);
    } catch (error) {
      await this.trunksRepository.delete(saved.id);
      throw error;
    }

    return saved;
  }

  async findAll(query: PaginationQuery): Promise<PaginatedResult<Trunk>> {
    const { skip, take, page, limit } = getPagination(query);
    const [data, total] = await this.trunksRepository.findAndCount({
      order: { name: 'ASC' },
      skip,
      take,
      relations: ['agent'],
    });
    return buildPaginatedResult(data, total, page, limit);
  }

  async findByDirection(direction: TrunkDirection): Promise<Trunk[]> {
    return this.trunksRepository.find({
      where: { direction },
      relations: ['agent'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Trunk | null> {
    return this.trunksRepository.findOne({
      where: { id },
      relations: ['agent'],
    });
  }

  async update(id: string, dto: UpdateTrunkDto): Promise<Trunk> {
    const trunk = await this.trunksRepository.findOne({
      where: { id },
      relations: ['agent'],
    });

    if (!trunk) {
      throw new NotFoundException('Trunk not found');
    }

    if (dto.name && dto.name.trim() !== trunk.name) {
      const newName = dto.name.trim();
      const existing = await this.trunksRepository.findOne({
        where: { name: newName },
      });
      if (existing) {
        throw new ConflictException('Trunk name already exists');
      }
      trunk.name = newName;
    }

    if (dto.direction !== undefined) {
      trunk.direction = dto.direction;
    }

    if (dto.providerType !== undefined) {
      trunk.providerType = dto.providerType;
    }

    // Validate direction-specific requirements
    const effectiveDirection = dto.direction ?? trunk.direction;
    const effectiveHost = dto.host !== undefined ? dto.host : trunk.host;
    if (effectiveDirection === 'outbound' && !effectiveHost) {
      throw new BadRequestException('Host is required for outbound trunks');
    }

    if (dto.host !== undefined) {
      trunk.host = dto.host;
    }

    if (dto.port !== undefined) {
      trunk.port = dto.port;
    }

    if (dto.username !== undefined) {
      trunk.username = dto.username;
    }

    if (dto.password !== undefined && dto.password) {
      trunk.password = dto.password;
    }

    if (dto.transport !== undefined) {
      trunk.transport = dto.transport;
    }

    if (dto.codecs !== undefined) {
      trunk.codecs = this.normalizeCodecs(dto.codecs);
    }

    if (dto.didNumber !== undefined) {
      trunk.didNumber = dto.didNumber;
    }

    // Handle agent assignment
    if (dto.agentId !== undefined) {
      if (dto.agentId === null) {
        trunk.agent = null;
        trunk.agentId = null;
      } else {
        const agent = await this.agentRepository.findOne({
          where: { id: dto.agentId },
        });
        if (!agent) {
          throw new NotFoundException('Agent not found');
        }
        trunk.agent = agent;
        trunk.agentId = dto.agentId;
      }
    }

    if (dto.allowedIps !== undefined) {
      trunk.allowedIps = dto.allowedIps;
    }

    if (dto.registerEnabled !== undefined) {
      trunk.registerEnabled = dto.registerEnabled;
    }

    if (dto.registerInterval !== undefined) {
      trunk.registerInterval = dto.registerInterval;
    }

    if (dto.outboundCallerId !== undefined) {
      trunk.outboundCallerId = dto.outboundCallerId;
    }

    if (dto.recordingEnabled !== undefined) {
      trunk.recordingEnabled = dto.recordingEnabled;
    }

    if (dto.denoiseEnabled !== undefined) {
      trunk.denoiseEnabled = dto.denoiseEnabled;
    }

    const saved = await this.trunksRepository.save(trunk);
    await this.asteriskService.provisionTrunk(saved);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const trunk = await this.trunksRepository.findOne({ where: { id } });
    if (!trunk) {
      throw new NotFoundException('Trunk not found');
    }

    const direction = trunk.direction;
    await this.trunksRepository.remove(trunk);
    await this.asteriskService.removeTrunk(id, direction);
  }

  private normalizeCodecs(input?: string): string {
    const fallback = 'ulaw,alaw';
    if (!input) {
      return fallback;
    }
    const codecs = input
      .split(',')
      .map((codec) => codec.trim())
      .filter(Boolean);

    if (codecs.length === 0) {
      return fallback;
    }

    return codecs.join(',');
  }
}
