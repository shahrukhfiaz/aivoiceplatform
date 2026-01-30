import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentsService } from '../agents/agents.service';
import { Call } from '../webhooks/call.entity';
import { CreateCallDto } from './dto/create-call.dto';
import {
  CallResponseDto,
  CallListResponseDto,
  CallStatus,
  CallEndedReason,
} from './dto/call-response.dto';
import {
  buildPaginatedResult,
  getPagination,
  PaginationQuery,
} from '../common/pagination';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly agentsService: AgentsService,
    @InjectRepository(Call)
    private readonly callRepository: Repository<Call>,
  ) {}

  /**
   * Create a new outbound call (VAPI-style API)
   * POST /calls
   */
  async createCall(dto: CreateCallDto): Promise<CallResponseDto> {
    this.logger.log(`Creating outbound call to ${dto.customer.number} via agent ${dto.agentId}`);

    // Convert VAPI-style DTO to internal dial format
    const dialResult = await this.agentsService.dialOutbound(dto.agentId, {
      toNumber: dto.customer.number,
      fromNumber: dto.phoneNumber?.number,
      metadata: dto.metadata,
      timeout: dto.maxDuration,
    });

    // Return VAPI-style response
    return {
      id: dialResult.id,
      type: 'outbound',
      status: dialResult.status as CallStatus,
      agentId: dto.agentId,
      customer: {
        number: dto.customer.number,
        name: dto.customer.name,
      },
      phoneNumber: {
        number: dialResult.fromNumber,
        trunkId: dialResult.trunkId,
        trunkName: dialResult.trunkName,
      },
      metadata: dto.metadata,
      name: dto.name,
      createdAt: dialResult.createdAt,
    };
  }

  /**
   * Get a call by ID
   * GET /calls/:id
   */
  async getCall(id: string): Promise<CallResponseDto | null> {
    const call = await this.callRepository.findOne({
      where: { id },
      relations: ['agent'],
    });

    if (!call) {
      return null;
    }

    return this.mapCallToResponse(call);
  }

  /**
   * Get a call by UUID
   * GET /calls/uuid/:uuid
   */
  async getCallByUuid(uuid: string): Promise<CallResponseDto | null> {
    const call = await this.callRepository.findOne({
      where: { uuid },
      relations: ['agent'],
    });

    if (!call) {
      return null;
    }

    return this.mapCallToResponse(call);
  }

  /**
   * List all calls with pagination
   * GET /calls
   */
  async listCalls(
    query: PaginationQuery & {
      agentId?: string;
      status?: string;
      type?: string;
    },
  ): Promise<CallListResponseDto> {
    const qb = this.callRepository
      .createQueryBuilder('call')
      .leftJoinAndSelect('call.agent', 'agent');

    if (query.agentId) {
      qb.andWhere('call.agentId = :agentId', { agentId: query.agentId });
    }

    if (query.type) {
      qb.andWhere('call.callType = :callType', { callType: query.type });
    }

    if (query.status) {
      if (query.status === 'in-progress') {
        qb.andWhere('call.startedAt IS NOT NULL');
        qb.andWhere('call.endedAt IS NULL');
      } else if (query.status === 'ended') {
        qb.andWhere('call.endedAt IS NOT NULL');
      } else if (query.status === 'queued') {
        qb.andWhere('call.startedAt IS NULL');
        qb.andWhere('call.endedAt IS NULL');
      }
    }

    qb.orderBy('call.startedAt', 'DESC').addOrderBy('call.id', 'DESC');

    const { skip, take, page, limit } = getPagination(query);
    qb.skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();
    const paginated = buildPaginatedResult(data, total, page, limit);

    return {
      data: data.map((call) => this.mapCallToResponse(call)),
      page: paginated.page,
      limit: paginated.limit,
      total: paginated.total,
      hasNextPage: paginated.hasNextPage,
      hasPreviousPage: paginated.hasPreviousPage,
    };
  }

  /**
   * Map internal Call entity to VAPI-style CallResponseDto
   */
  private mapCallToResponse(call: Call): CallResponseDto {
    // Determine call status
    let status: CallStatus;
    if (!call.startedAt && !call.endedAt) {
      status = 'queued';
    } else if (call.startedAt && !call.endedAt) {
      status = 'in-progress';
    } else {
      status = 'ended';
    }

    // Map end reason
    let endedReason: CallEndedReason | undefined;
    if (call.endReason) {
      const reasonMap: Record<string, CallEndedReason> = {
        completed: 'completed',
        busy: 'busy',
        'no-answer': 'no-answer',
        no_answer: 'no-answer',
        canceled: 'canceled',
        cancelled: 'canceled',
        failed: 'failed',
        rejected: 'rejected',
      };
      endedReason = reasonMap[call.endReason] || 'completed';
    }

    // Calculate duration in seconds
    let duration: number | undefined;
    if (call.startedAt && call.endedAt) {
      const start = new Date(call.startedAt).getTime();
      const end = new Date(call.endedAt).getTime();
      duration = Math.round((end - start) / 1000);
    }

    return {
      id: call.id,
      orgId: undefined, // Multi-tenant support placeholder
      type: (call.callType as 'inbound' | 'outbound') || 'outbound',
      status,
      endedReason,
      agentId: call.agentId || '',
      customer: {
        number: call.toNumber || call.fromNumber || '',
        name: undefined,
      },
      phoneNumber: {
        number: call.callType === 'outbound' ? call.fromNumber || undefined : call.toNumber || undefined,
      },
      metadata: undefined,
      name: undefined,
      createdAt: call.startedAt?.toISOString() || new Date().toISOString(),
      startedAt: call.startedAt?.toISOString(),
      endedAt: call.endedAt?.toISOString(),
      duration,
      cost: call.cost ?? undefined,
    };
  }
}
