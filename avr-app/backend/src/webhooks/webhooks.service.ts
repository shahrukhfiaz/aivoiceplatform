import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call, CallType } from './call.entity';
import { CallEvent, WebhookEventType } from './call-event.entity';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { Agent } from '../agents/agent.entity';
import { CostsService } from '../costs/costs.service';
import {
  buildPaginatedResult,
  getPagination,
  PaginatedResult,
  PaginationQuery,
} from '../common/pagination';

export interface EnhancedCallsFilters {
  agentId?: string | null;
  providerId?: string | null;
  callType?: CallType | null;
  status?: 'in_progress' | 'completed' | 'failed' | null;
  phoneNumber?: string | null;
  uuid?: string;
  since?: Date;
  startedFrom?: string;
  startedTo?: string;
  sortField?: 'startedAt' | 'endedAt';
  sortDirection?: 'asc' | 'desc';
}

export interface EnhancedSummary {
  totalCalls: number;
  activeCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  successRate: number;
  callsByAgent: { agentId: string; agentName: string; count: number }[];
}

export interface TranscriptMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'agent';
  text: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Call)
    private readonly callRepository: Repository<Call>,
    @InjectRepository(CallEvent)
    private readonly eventRepository: Repository<CallEvent>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly costsService: CostsService,
  ) {}

  verifySecret(provided: string | undefined) {
    const expected = process.env.WEBHOOK_SECRET;
    // If no secret is configured, allow all webhooks (for development)
    if (!expected) {
      return;
    }
    // If secret is configured, verify it matches
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  async handleEvent(
    event: WebhookEventDto,
    agentId?: string | null,
  ): Promise<void> {
    const existingCall = await this.callRepository.findOne({
      where: { uuid: event.uuid },
      relations: ['events'],
    });

    let call = existingCall;
    let needsSave = false;

    if (!call) {
      call = this.callRepository.create({
        uuid: event.uuid,
        startedAt: undefined,
        endedAt: undefined,
        agentId: agentId ?? null,
        events: [],
      });
      call = await this.callRepository.save(call);
    } else if (agentId && !call.agentId) {
      call.agentId = agentId;
      needsSave = true;
    }

    // Always populate provider info and call type if not already set
    if (agentId && (!call.providerId || !call.callType)) {
      const agent = await this.agentRepository.findOne({
        where: { id: agentId },
        relations: ['providerSts', 'providerLlm'],
      });
      if (agent) {
        // Use STS provider for STS mode, or LLM provider for pipeline mode
        const provider = agent.providerSts || agent.providerLlm;
        if (provider && !call.providerId) {
          call.providerId = provider.id;
          call.providerName = provider.name;
          needsSave = true;
        }
        // Use agent's default call type if not set
        if (!call.callType) {
          call.callType = agent.defaultCallType || 'inbound';
          needsSave = true;
        }
      }
    }

    if (needsSave) {
      await this.callRepository.save(call);
    }

    const timestamp = new Date(event.timestamp);

    // Extract additional fields from call_initiated event
    if (event.type === 'call_initiated' && event.payload) {
      const payload = event.payload as Record<string, unknown>;
      call.fromNumber = payload.from ? String(payload.from) : null;
      call.toNumber = payload.to ? String(payload.to) : null;

      // Store Twilio call SID if present (for status callback lookups)
      if (payload.twilioCallSid) {
        call.twilioCallSid = String(payload.twilioCallSid);
      }

      // Store Twilio number ID if present (for fetching cost later)
      if (payload.twilioNumberId) {
        call.twilioNumberId = String(payload.twilioNumberId);
      }

      // Determine call type based on direction or channel pattern
      const direction = payload.direction as string | undefined;
      if (direction === 'outbound' || direction === 'out') {
        call.callType = 'outbound';
      } else if (direction === 'inbound' || direction === 'in') {
        call.callType = 'inbound';
      }

      await this.callRepository.save(call);
    }

    if (event.type === 'call_started') {
      call.startedAt = timestamp;
      await this.callRepository.save(call);
    }

    if (event.type === 'call_ended') {
      call.endedAt = timestamp;

      // Extract end reason from payload
      if (event.payload) {
        const payload = event.payload as Record<string, unknown>;
        const reason = payload.reason as string | undefined;
        call.endReason = reason || 'completed';
      } else {
        call.endReason = 'completed';
      }

      // Calculate immediate cost estimate from duration
      if (call.startedAt) {
        call.cost = this.costsService.calculateCostFromDuration(
          new Date(call.startedAt),
          new Date(call.endedAt),
        );
        this.logger.debug(
          `Calculated cost for call ${call.uuid}: $${call.cost}`,
        );
      }

      await this.callRepository.save(call);

      // Async: Fetch actual cost from Deepgram (non-blocking)
      this.updateCostFromDeepgram(call).catch((err) =>
        this.logger.error(`Failed to update Deepgram cost: ${err}`),
      );
    }

    const relevantTypes: WebhookEventType[] = [
      'call_initiated',
      'call_started',
      'call_ended',
      'transcription',
      'interruption',
      'dtmf_digit',
    ];

    if (relevantTypes.includes(event.type as WebhookEventType)) {
      const callEvent = this.eventRepository.create({
        call,
        type: event.type as WebhookEventType,
        timestamp,
        payload: event.payload ?? null,
      });
      await this.eventRepository.save(callEvent);
    }
  }

  async listCalls(
    filters: {
      agentId?: string | null;
      since?: Date;
      uuid?: string;
      startedFrom?: string;
      startedTo?: string;
      sortField?: 'startedAt' | 'endedAt';
      sortDirection?: 'asc' | 'desc';
    },
    paginationQuery: PaginationQuery = {},
  ): Promise<PaginatedResult<Call>> {
    const qb = this.callRepository.createQueryBuilder('call');

    if (filters.agentId) {
      qb.andWhere('call.agentId = :agentId', { agentId: filters.agentId });
    }

    if (filters.uuid) {
      qb.andWhere('call.uuid LIKE :uuid', { uuid: `%${filters.uuid}%` });
    }

    if (filters.since) {
      qb.andWhere('call.startedAt >= :since', {
        since: filters.since.toISOString(),
      });
    }

    const startedFrom = this.parseDate(filters.startedFrom);
    if (startedFrom) {
      qb.andWhere('call.startedAt >= :startedFrom', {
        startedFrom: startedFrom.toISOString(),
      });
    }

    const startedTo = this.parseDate(filters.startedTo, true);
    if (startedTo) {
      qb.andWhere('call.startedAt <= :startedTo', {
        startedTo: startedTo.toISOString(),
      });
    }

    const sortField = filters.sortField === 'endedAt' ? 'call.endedAt' : 'call.startedAt';
    const sortDirection = filters.sortDirection === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(sortField, sortDirection).addOrderBy('call.id', 'DESC');

    const { skip, take, page, limit } = getPagination(paginationQuery);
    qb.skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();

    return buildPaginatedResult(data, total, page, limit);
  }

  private parseDate(value?: string, endOfDay = false): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date;
  }

  async getCallWithEvents(callId: string): Promise<Call | null> {
    const qb = this.callRepository
      .createQueryBuilder('call')
      .leftJoinAndSelect('call.events', 'event')
      .where('call.id = :id', { id: callId })
      .orderBy('event.timestamp', 'ASC');

    return qb.getOne();
  }

  async getSummary(agentId?: string | null, since?: Date) {
    const totalQb = this.callRepository.createQueryBuilder('call');
    if (agentId) {
      totalQb.andWhere('call.agentId = :agentId', { agentId });
    }
    if (since) {
      totalQb.andWhere('call.startedAt >= :since', {
        since: since.toISOString(),
      });
    }
    const totalResult = await totalQb
      .select('COUNT(call.id)', 'total')
      .getRawOne<{ total: string }>();

    const avgQb = this.callRepository
      .createQueryBuilder('call')
      .where('call.startedAt IS NOT NULL')
      .andWhere('call.endedAt IS NOT NULL');

    if (agentId) {
      avgQb.andWhere('call.agentId = :agentId', { agentId });
    }
    if (since) {
      avgQb.andWhere('call.startedAt >= :since', {
        since: since.toISOString(),
      });
    }

    const avgResult = await avgQb
      .select(
        'AVG((julianday(call.endedAt) - julianday(call.startedAt)) * 86400)',
        'avgSeconds',
      )
      .getRawOne<{ avgSeconds: string | null }>();

    const total = Number(totalResult?.total ?? 0);
    const averageDurationSeconds = Number(avgResult?.avgSeconds ?? 0);

    return {
      totalCalls: total,
      averageDurationSeconds: Number.isFinite(averageDurationSeconds)
        ? averageDurationSeconds
        : 0,
    };
  }

  async getEnhancedSummary(
    agentId?: string | null,
    since?: Date,
  ): Promise<EnhancedSummary> {
    const baseQb = () => {
      const qb = this.callRepository.createQueryBuilder('call');
      if (agentId) {
        qb.andWhere('call.agentId = :agentId', { agentId });
      }
      if (since) {
        qb.andWhere('call.startedAt >= :since', {
          since: since.toISOString(),
        });
      }
      return qb;
    };

    // Total calls
    const totalResult = await baseQb()
      .select('COUNT(call.id)', 'total')
      .getRawOne<{ total: string }>();
    const totalCalls = Number(totalResult?.total ?? 0);

    // Active calls (started but not ended)
    const activeResult = await baseQb()
      .andWhere('call.startedAt IS NOT NULL')
      .andWhere('call.endedAt IS NULL')
      .select('COUNT(call.id)', 'total')
      .getRawOne<{ total: string }>();
    const activeCalls = Number(activeResult?.total ?? 0);

    // Inbound calls
    const inboundResult = await baseQb()
      .andWhere('call.callType = :callType', { callType: 'inbound' })
      .select('COUNT(call.id)', 'total')
      .getRawOne<{ total: string }>();
    const inboundCalls = Number(inboundResult?.total ?? 0);

    // Outbound calls
    const outboundResult = await baseQb()
      .andWhere('call.callType = :callType', { callType: 'outbound' })
      .select('COUNT(call.id)', 'total')
      .getRawOne<{ total: string }>();
    const outboundCalls = Number(outboundResult?.total ?? 0);

    // Total and average duration
    const durationQb = baseQb()
      .andWhere('call.startedAt IS NOT NULL')
      .andWhere('call.endedAt IS NOT NULL');

    const durationResult = await durationQb
      .select(
        'SUM((julianday(call.endedAt) - julianday(call.startedAt)) * 86400)',
        'totalSeconds',
      )
      .addSelect(
        'AVG((julianday(call.endedAt) - julianday(call.startedAt)) * 86400)',
        'avgSeconds',
      )
      .getRawOne<{ totalSeconds: string | null; avgSeconds: string | null }>();

    const totalDurationSeconds = Number(durationResult?.totalSeconds ?? 0);
    const averageDurationSeconds = Number(durationResult?.avgSeconds ?? 0);

    // Success rate (completed / total ended * 100)
    const completedQb = baseQb()
      .andWhere('call.endedAt IS NOT NULL')
      .andWhere('call.endReason = :reason', { reason: 'completed' });

    const completedResult = await completedQb
      .select('COUNT(call.id)', 'total')
      .getRawOne<{ total: string }>();
    const completedCalls = Number(completedResult?.total ?? 0);

    const endedQb = baseQb().andWhere('call.endedAt IS NOT NULL');
    const endedResult = await endedQb
      .select('COUNT(call.id)', 'total')
      .getRawOne<{ total: string }>();
    const endedCalls = Number(endedResult?.total ?? 0);

    const successRate =
      endedCalls > 0 ? (completedCalls / endedCalls) * 100 : 0;

    // Calls by agent (top 10)
    const callsByAgentQb = this.callRepository
      .createQueryBuilder('call')
      .leftJoin('call.agent', 'agent')
      .select('call.agentId', 'agentId')
      .addSelect('agent.name', 'agentName')
      .addSelect('COUNT(call.id)', 'count')
      .groupBy('call.agentId')
      .addGroupBy('agent.name')
      .orderBy('count', 'DESC')
      .limit(10);

    if (since) {
      callsByAgentQb.andWhere('call.startedAt >= :since', {
        since: since.toISOString(),
      });
    }

    const callsByAgentRaw = await callsByAgentQb.getRawMany<{
      agentId: string;
      agentName: string | null;
      count: string;
    }>();

    const callsByAgent = callsByAgentRaw
      .filter((row) => row.agentId)
      .map((row) => ({
        agentId: row.agentId,
        agentName: row.agentName || row.agentId,
        count: Number(row.count),
      }));

    return {
      totalCalls,
      activeCalls,
      inboundCalls,
      outboundCalls,
      totalDurationSeconds: Number.isFinite(totalDurationSeconds)
        ? totalDurationSeconds
        : 0,
      averageDurationSeconds: Number.isFinite(averageDurationSeconds)
        ? averageDurationSeconds
        : 0,
      successRate: Number.isFinite(successRate) ? successRate : 0,
      callsByAgent,
    };
  }

  async listCallsEnhanced(
    filters: EnhancedCallsFilters,
    paginationQuery: PaginationQuery = {},
  ): Promise<PaginatedResult<Call>> {
    const qb = this.callRepository
      .createQueryBuilder('call')
      .leftJoinAndSelect('call.agent', 'agent');

    if (filters.agentId) {
      qb.andWhere('call.agentId = :agentId', { agentId: filters.agentId });
    }

    if (filters.providerId) {
      qb.andWhere('call.providerId = :providerId', {
        providerId: filters.providerId,
      });
    }

    if (filters.callType) {
      qb.andWhere('call.callType = :callType', { callType: filters.callType });
    }

    if (filters.status === 'in_progress') {
      qb.andWhere('call.startedAt IS NOT NULL');
      qb.andWhere('call.endedAt IS NULL');
    } else if (filters.status === 'completed') {
      qb.andWhere('call.endedAt IS NOT NULL');
      qb.andWhere('call.endReason = :reason', { reason: 'completed' });
    } else if (filters.status === 'failed') {
      qb.andWhere('call.endedAt IS NOT NULL');
      qb.andWhere('call.endReason != :reason', { reason: 'completed' });
    }

    if (filters.phoneNumber) {
      qb.andWhere(
        '(call.fromNumber LIKE :phone OR call.toNumber LIKE :phone)',
        { phone: `%${filters.phoneNumber}%` },
      );
    }

    if (filters.uuid) {
      qb.andWhere('call.uuid LIKE :uuid', { uuid: `%${filters.uuid}%` });
    }

    if (filters.since) {
      qb.andWhere('call.startedAt >= :since', {
        since: filters.since.toISOString(),
      });
    }

    const startedFrom = this.parseDate(filters.startedFrom);
    if (startedFrom) {
      qb.andWhere('call.startedAt >= :startedFrom', {
        startedFrom: startedFrom.toISOString(),
      });
    }

    const startedTo = this.parseDate(filters.startedTo, true);
    if (startedTo) {
      qb.andWhere('call.startedAt <= :startedTo', {
        startedTo: startedTo.toISOString(),
      });
    }

    const sortField =
      filters.sortField === 'endedAt' ? 'call.endedAt' : 'call.startedAt';
    const sortDirection = filters.sortDirection === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(sortField, sortDirection).addOrderBy('call.id', 'DESC');

    const { skip, take, page, limit } = getPagination(paginationQuery);
    qb.skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();

    // Backfill missing provider info and call type for existing calls
    const callsToUpdate = data.filter(
      (call) => call.agentId && (!call.providerId || !call.callType),
    );

    if (callsToUpdate.length > 0) {
      // Get all agents for calls that need updating
      const agentIds = [...new Set(callsToUpdate.map((c) => c.agentId).filter(Boolean) as string[])];
      const agents = await this.agentRepository.find({
        where: agentIds.map((id) => ({ id })),
        relations: ['providerSts', 'providerLlm'],
      });
      const agentMap = new Map(agents.map((a) => [a.id, a]));

      // Update calls with missing info
      for (const call of callsToUpdate) {
        if (!call.agentId) continue;
        const agent = agentMap.get(call.agentId);
        if (!agent) continue;

        let needsSave = false;
        const provider = agent.providerSts || agent.providerLlm;

        if (provider && !call.providerId) {
          call.providerId = provider.id;
          call.providerName = provider.name;
          needsSave = true;
        }

        if (!call.callType) {
          call.callType = agent.defaultCallType || 'inbound';
          needsSave = true;
        }

        if (needsSave) {
          await this.callRepository.save(call);
        }
      }
    }

    return buildPaginatedResult(data, total, page, limit);
  }

  async getCallTranscript(callId: string): Promise<TranscriptMessage[]> {
    const call = await this.callRepository.findOne({
      where: { id: callId },
      relations: ['events'],
    });

    if (!call) {
      return [];
    }

    const transcriptEvents = call.events
      .filter((event) => event.type === 'transcription')
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    return transcriptEvents.map((event) => {
      const payload = event.payload as Record<string, unknown> | null;
      const roleRaw = String(payload?.role ?? 'user').toLowerCase();
      const role: 'user' | 'agent' =
        roleRaw === 'agent' || roleRaw === 'assistant' || roleRaw === 'bot'
          ? 'agent'
          : 'user';

      return {
        id: event.id,
        timestamp: event.timestamp.toISOString(),
        role,
        text: String(payload?.text ?? ''),
      };
    });
  }

  /**
   * Async method to fetch actual cost from Deepgram Management API
   * Updates the call record if actual cost is retrieved
   */
  private async updateCostFromDeepgram(call: Call): Promise<void> {
    if (!call.agentId || !call.startedAt || !call.endedAt) {
      return;
    }

    const agent = await this.agentRepository.findOne({
      where: { id: call.agentId },
      relations: ['providerSts'],
    });

    if (!agent?.providerSts?.config) {
      this.logger.debug(
        `No STS provider found for agent ${call.agentId}, skipping Deepgram cost lookup`,
      );
      return;
    }

    const config = agent.providerSts.config as Record<string, unknown>;
    const env = config.env as Record<string, string> | undefined;

    if (!env) {
      return;
    }

    const apiKey = env.DEEPGRAM_API_KEY;
    const projectId = env.DEEPGRAM_PROJECT_ID;

    if (!apiKey || !projectId) {
      this.logger.debug(
        `Missing DEEPGRAM_API_KEY or DEEPGRAM_PROJECT_ID for provider ${agent.providerSts.name}`,
      );
      return;
    }

    this.logger.debug(
      `Fetching actual cost from Deepgram for call ${call.uuid}`,
    );

    const actualCost = await this.costsService.fetchCostFromDeepgram(
      apiKey,
      projectId,
      new Date(call.startedAt),
      new Date(call.endedAt),
    );

    if (actualCost !== null) {
      this.logger.log(
        `Updated Deepgram cost for call ${call.uuid}: $${actualCost}`,
      );
      call.deepgramCost = actualCost;
      // Recalculate total cost (Deepgram cost + Twilio cost)
      const twilioCost = call.twilioCost ? Number(call.twilioCost) : 0;
      call.cost = actualCost + twilioCost;
      await this.callRepository.save(call);
    }
  }

  /**
   * Create an outbound call record for API-initiated calls
   */
  async createOutboundCall(params: {
    uuid: string;
    agentId: string;
    callType: 'outbound';
    toNumber: string;
    fromNumber: string;
    metadata?: Record<string, unknown>;
  }): Promise<Call> {
    const call = this.callRepository.create({
      uuid: params.uuid,
      agentId: params.agentId,
      callType: params.callType,
      toNumber: params.toNumber,
      fromNumber: params.fromNumber,
    });

    const savedCall = await this.callRepository.save(call);

    // Create initial event
    const event = this.eventRepository.create({
      call: savedCall,
      type: 'call_initiated' as WebhookEventType,
      timestamp: new Date(),
      payload: {
        direction: 'outbound',
        from: params.fromNumber,
        to: params.toNumber,
        metadata: params.metadata,
      },
    });
    await this.eventRepository.save(event);

    this.logger.log(`Created outbound call record: ${savedCall.uuid}`);
    return savedCall;
  }

  /**
   * Update call status for API-initiated calls
   */
  async updateCallStatus(
    uuid: string,
    status: string,
    reason?: string,
  ): Promise<void> {
    const call = await this.callRepository.findOne({ where: { uuid } });
    if (!call) {
      this.logger.warn(`Call ${uuid} not found for status update`);
      return;
    }

    if (status === 'failed') {
      call.endedAt = new Date();
      call.endReason = reason || 'failed';
      await this.callRepository.save(call);
      this.logger.log(`Updated call ${uuid} status to failed: ${reason}`);
    }
  }

  /**
   * Find a call by Twilio Call SID
   */
  async findByTwilioCallSid(twilioCallSid: string): Promise<Call | null> {
    return this.callRepository.findOne({
      where: { twilioCallSid },
      relations: ['events'],
    });
  }

  /**
   * Handle Twilio status callback events
   */
  async handleTwilioStatusCallback(
    twilioCallSid: string,
    status: string,
    duration?: number,
  ): Promise<void> {
    const call = await this.findByTwilioCallSid(twilioCallSid);
    if (!call) {
      this.logger.warn(`Call not found for Twilio SID: ${twilioCallSid}`);
      return;
    }

    const timestamp = new Date();

    // Map Twilio status to our event types and update call
    if (status === 'in-progress') {
      call.startedAt = timestamp;
      await this.callRepository.save(call);

      // Create call_started event
      const event = this.eventRepository.create({
        call,
        type: 'call_started',
        timestamp,
        payload: { twilioCallSid, status },
      });
      await this.eventRepository.save(event);
      this.logger.log(`Twilio call started: ${call.uuid}`);
    } else if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status)) {
      call.endedAt = timestamp;
      call.endReason = status;

      // Calculate cost from duration if available
      if (call.startedAt) {
        call.cost = this.costsService.calculateCostFromDuration(
          new Date(call.startedAt),
          timestamp,
        );
      }

      await this.callRepository.save(call);

      // Create call_ended event
      const event = this.eventRepository.create({
        call,
        type: 'call_ended',
        timestamp,
        payload: { twilioCallSid, status, duration },
      });
      await this.eventRepository.save(event);
      this.logger.log(`Twilio call ended: ${call.uuid} with status: ${status}`);

      // Async: Fetch actual cost from Deepgram (non-blocking)
      this.updateCostFromDeepgram(call).catch((err) =>
        this.logger.error(`Failed to update Deepgram cost: ${err}`),
      );
    }
  }

  /**
   * Update Twilio cost for a call
   */
  async updateTwilioCost(twilioCallSid: string, cost: number): Promise<void> {
    const call = await this.findByTwilioCallSid(twilioCallSid);
    if (!call) {
      this.logger.warn(`Call not found for Twilio cost update: ${twilioCallSid}`);
      return;
    }

    call.twilioCost = cost;

    // Recalculate total cost (Deepgram cost + Twilio cost)
    const deepgramCost = call.deepgramCost ? Number(call.deepgramCost) : 0;
    call.cost = deepgramCost + cost;

    await this.callRepository.save(call);
    this.logger.log(`Updated Twilio cost for call ${call.uuid}: $${cost}`);
  }
}
