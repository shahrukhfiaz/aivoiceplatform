import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { CallerIdPool, RotationStrategy } from './caller-id-pool.entity';
import { CallerIdNumber, CallerIdStatus, ReputationLevel } from './caller-id-number.entity';
import { CallerIdUsageLog, CallResult } from './caller-id-usage-log.entity';
import { CallerIdReputationEvent, ReputationEventType } from './caller-id-reputation-event.entity';
import { CreateCallerIdPoolDto } from './dto/create-pool.dto';
import { UpdateCallerIdPoolDto } from './dto/update-pool.dto';
import { AddCallerIdNumberDto, UpdateCallerIdNumberDto, FlagNumberDto } from './dto/add-number.dto';

export interface PoolStats {
  totalNumbers: number;
  activeNumbers: number;
  coolingDownNumbers: number;
  flaggedNumbers: number;
  blockedNumbers: number;
  averageReputationScore: number;
  totalCallsToday: number;
  areaCodes: { areaCode: string; count: number }[];
}

export interface NumberStats {
  totalCalls: number;
  answeredCalls: number;
  answerRate: number;
  callsToday: number;
  reputationScore: number;
  reputationLevel: ReputationLevel;
  lastUsedAt: Date | null;
  recentEvents: CallerIdReputationEvent[];
}

@Injectable()
export class CallerIdService {
  private readonly logger = new Logger(CallerIdService.name);

  constructor(
    @InjectRepository(CallerIdPool)
    private readonly poolRepository: Repository<CallerIdPool>,
    @InjectRepository(CallerIdNumber)
    private readonly numberRepository: Repository<CallerIdNumber>,
    @InjectRepository(CallerIdUsageLog)
    private readonly usageLogRepository: Repository<CallerIdUsageLog>,
    @InjectRepository(CallerIdReputationEvent)
    private readonly reputationEventRepository: Repository<CallerIdReputationEvent>,
  ) {}

  // ==================== Pool Management ====================

  async createPool(dto: CreateCallerIdPoolDto): Promise<CallerIdPool> {
    const existing = await this.poolRepository.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Pool with name "${dto.name}" already exists`);
    }

    const pool = this.poolRepository.create(dto);
    return this.poolRepository.save(pool);
  }

  async findAllPools(): Promise<CallerIdPool[]> {
    const pools = await this.poolRepository.find({
      order: { name: 'ASC' },
    });

    // Add stats to each pool
    for (const pool of pools) {
      const stats = await this.getPoolStats(pool.id);
      pool.totalNumbers = stats.totalNumbers;
      pool.activeNumbers = stats.activeNumbers;
      pool.flaggedNumbers = stats.flaggedNumbers;
    }

    return pools;
  }

  async findPool(id: string): Promise<CallerIdPool> {
    const pool = await this.poolRepository.findOne({
      where: { id },
      relations: ['numbers'],
    });
    if (!pool) {
      throw new NotFoundException(`Pool with ID "${id}" not found`);
    }
    return pool;
  }

  async updatePool(id: string, dto: UpdateCallerIdPoolDto): Promise<CallerIdPool> {
    const pool = await this.findPool(id);
    Object.assign(pool, dto);
    return this.poolRepository.save(pool);
  }

  async deletePool(id: string): Promise<void> {
    const pool = await this.findPool(id);
    await this.poolRepository.remove(pool);
  }

  async getPoolStats(poolId: string): Promise<PoolStats> {
    const numbers = await this.numberRepository.find({
      where: { poolId },
    });

    const statusCounts = {
      active: 0,
      cooling_down: 0,
      flagged: 0,
      blocked: 0,
      inactive: 0,
    };

    let totalScore = 0;
    let totalCallsToday = 0;
    const areaCodeCounts: Record<string, number> = {};

    for (const num of numbers) {
      statusCounts[num.status]++;
      totalScore += num.reputationScore;
      totalCallsToday += num.callsToday;
      areaCodeCounts[num.areaCode] = (areaCodeCounts[num.areaCode] || 0) + 1;
    }

    return {
      totalNumbers: numbers.length,
      activeNumbers: statusCounts.active,
      coolingDownNumbers: statusCounts.cooling_down,
      flaggedNumbers: statusCounts.flagged,
      blockedNumbers: statusCounts.blocked,
      averageReputationScore: numbers.length > 0 ? Math.round(totalScore / numbers.length) : 0,
      totalCallsToday,
      areaCodes: Object.entries(areaCodeCounts)
        .map(([areaCode, count]) => ({ areaCode, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // ==================== Number Management ====================

  async addNumber(poolId: string, dto: AddCallerIdNumberDto): Promise<CallerIdNumber> {
    await this.findPool(poolId); // Validate pool exists

    // Extract area code from phone number
    const areaCode = this.extractAreaCode(dto.phoneNumber);
    if (!areaCode) {
      throw new ConflictException('Could not extract area code from phone number');
    }

    // Check if number already exists in this pool
    const existing = await this.numberRepository.findOne({
      where: { poolId, phoneNumber: dto.phoneNumber },
    });
    if (existing) {
      throw new ConflictException(`Number "${dto.phoneNumber}" already exists in this pool`);
    }

    const number = this.numberRepository.create({
      ...dto,
      poolId,
      areaCode,
      status: dto.status || 'active',
    });

    return this.numberRepository.save(number);
  }

  async importNumbers(poolId: string, numbers: AddCallerIdNumberDto[]): Promise<{ success: number; failed: number; errors: string[] }> {
    await this.findPool(poolId);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const dto of numbers) {
      try {
        await this.addNumber(poolId, dto);
        success++;
      } catch (error) {
        failed++;
        errors.push(`${dto.phoneNumber}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  async findNumbers(poolId: string, options?: {
    status?: CallerIdStatus;
    areaCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ numbers: CallerIdNumber[]; total: number }> {
    const where: Record<string, unknown> = { poolId };
    if (options?.status) where.status = options.status;
    if (options?.areaCode) where.areaCode = options.areaCode;

    const [numbers, total] = await this.numberRepository.findAndCount({
      where,
      order: { areaCode: 'ASC', phoneNumber: 'ASC' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return { numbers, total };
  }

  async findNumber(id: string): Promise<CallerIdNumber> {
    const number = await this.numberRepository.findOne({
      where: { id },
      relations: ['pool'],
    });
    if (!number) {
      throw new NotFoundException(`Number with ID "${id}" not found`);
    }
    return number;
  }

  async updateNumber(id: string, dto: UpdateCallerIdNumberDto): Promise<CallerIdNumber> {
    const number = await this.findNumber(id);
    Object.assign(number, dto);
    return this.numberRepository.save(number);
  }

  async deleteNumber(id: string): Promise<void> {
    const number = await this.findNumber(id);
    await this.numberRepository.remove(number);
  }

  async getNumberStats(id: string): Promise<NumberStats> {
    const number = await this.findNumber(id);
    const recentEvents = await this.reputationEventRepository.find({
      where: { callerIdNumberId: id },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      totalCalls: number.totalCalls,
      answeredCalls: number.answeredCalls,
      answerRate: number.totalCalls > 0 ? (number.answeredCalls / number.totalCalls) * 100 : 0,
      callsToday: number.callsToday,
      reputationScore: number.reputationScore,
      reputationLevel: number.reputationLevel,
      lastUsedAt: number.lastUsedAt || null,
      recentEvents,
    };
  }

  // ==================== Caller ID Selection (Local Presence) ====================

  async selectCallerIdForLead(
    poolId: string,
    leadPhone: string,
    campaignId: string,
  ): Promise<CallerIdNumber | null> {
    const pool = await this.findPool(poolId);
    if (!pool.isActive) {
      return null;
    }

    const destinationAreaCode = this.extractAreaCode(leadPhone);
    const now = new Date();

    // Get available numbers (not blocked, not cooling down)
    const availableNumbers = await this.numberRepository.find({
      where: {
        poolId,
        status: In(['active', 'cooling_down']),
      },
    });

    // Filter out numbers still in cooldown
    const readyNumbers = availableNumbers.filter(
      (n) => n.status === 'active' || (n.cooldownUntil && n.cooldownUntil <= now),
    );

    if (readyNumbers.length === 0) {
      this.logger.warn(`No available numbers in pool ${poolId}`);
      return null;
    }

    // Try to find matching area code first (local presence)
    let candidates = readyNumbers;
    if (pool.localPresenceEnabled && destinationAreaCode) {
      const exactMatch = readyNumbers.filter((n) => n.areaCode === destinationAreaCode);
      if (exactMatch.length > 0) {
        candidates = exactMatch;
      }
    }

    // Apply rotation strategy
    const selected = this.applyRotationStrategy(candidates, pool.rotationStrategy);
    if (!selected) {
      return null;
    }

    // Check max calls per number
    if (selected.callsToday >= pool.maxCallsPerNumber) {
      // Try to find another number
      const alternatives = candidates.filter((n) => n.id !== selected.id && n.callsToday < pool.maxCallsPerNumber);
      if (alternatives.length > 0) {
        return this.applyRotationStrategy(alternatives, pool.rotationStrategy);
      }
      // All numbers at max, use the one with least calls
      return candidates.reduce((prev, curr) => (prev.callsToday < curr.callsToday ? prev : curr));
    }

    return selected;
  }

  private applyRotationStrategy(
    numbers: CallerIdNumber[],
    strategy: RotationStrategy,
  ): CallerIdNumber | null {
    if (numbers.length === 0) return null;

    switch (strategy) {
      case 'round_robin':
      case 'least_recently_used':
        // Sort by last used, pick the one used longest ago
        return numbers.sort((a, b) => {
          const aTime = a.lastUsedAt?.getTime() || 0;
          const bTime = b.lastUsedAt?.getTime() || 0;
          return aTime - bTime;
        })[0];

      case 'random':
        return numbers[Math.floor(Math.random() * numbers.length)];

      case 'weighted':
        // Weight by reputation score
        const totalWeight = numbers.reduce((sum, n) => sum + n.reputationScore, 0);
        let random = Math.random() * totalWeight;
        for (const number of numbers) {
          random -= number.reputationScore;
          if (random <= 0) return number;
        }
        return numbers[0];

      default:
        return numbers[0];
    }
  }

  // ==================== Usage Tracking ====================

  async recordCallStart(
    numberId: string,
    leadId: string,
    campaignId: string,
    destinationNumber: string,
    callUuid?: string,
  ): Promise<CallerIdUsageLog> {
    const number = await this.findNumber(numberId);
    const destinationAreaCode = this.extractAreaCode(destinationNumber);

    // Update number stats
    number.callsToday++;
    number.totalCalls++;
    number.lastUsedAt = new Date();
    await this.numberRepository.save(number);

    // Create usage log
    const log = this.usageLogRepository.create({
      callerIdNumberId: numberId,
      callerIdPhoneNumber: number.phoneNumber,
      campaignId,
      leadId,
      destinationNumber,
      destinationAreaCode,
      callUuid,
    });

    return this.usageLogRepository.save(log);
  }

  async recordCallResult(
    usageLogId: string,
    result: CallResult,
    duration?: number,
  ): Promise<void> {
    const log = await this.usageLogRepository.findOne({
      where: { id: usageLogId },
      relations: ['callerIdNumber'],
    });

    if (!log) return;

    log.callResult = result;
    log.callDuration = duration;
    log.wasAnswered = result === 'answered';
    await this.usageLogRepository.save(log);

    // Update number stats
    if (log.callerIdNumber && result === 'answered') {
      log.callerIdNumber.answeredCalls++;
      await this.numberRepository.save(log.callerIdNumber);

      // Small reputation boost for answered calls
      await this.updateReputation(log.callerIdNumberId!, 'call_answered', 1, 'system');
    }
  }

  // ==================== Reputation Management ====================

  async updateReputation(
    numberId: string,
    eventType: ReputationEventType,
    scoreChange: number,
    source?: string,
    notes?: string,
  ): Promise<CallerIdNumber> {
    const number = await this.findNumber(numberId);
    const previousScore = number.reputationScore;
    const newScore = Math.max(0, Math.min(100, previousScore + scoreChange));

    number.reputationScore = newScore;
    number.reputationLevel = this.calculateReputationLevel(newScore);

    // Create reputation event
    const event = this.reputationEventRepository.create({
      callerIdNumberId: numberId,
      eventType,
      scoreChange,
      previousScore,
      newScore,
      source,
      notes,
    });
    await this.reputationEventRepository.save(event);

    return this.numberRepository.save(number);
  }

  private calculateReputationLevel(score: number): ReputationLevel {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }

  async flagNumber(id: string, dto: FlagNumberDto): Promise<CallerIdNumber> {
    const number = await this.findNumber(id);
    number.status = 'flagged';
    number.flaggedCount++;
    number.lastFlaggedAt = new Date();
    await this.numberRepository.save(number);

    await this.updateReputation(id, 'manual_flag', -20, dto.source, dto.reason);

    return this.findNumber(id);
  }

  async unblockNumber(id: string): Promise<CallerIdNumber> {
    const number = await this.findNumber(id);
    number.status = 'active';
    await this.numberRepository.save(number);

    await this.updateReputation(id, 'recovery', 10, 'admin', 'Manually unblocked');

    return this.findNumber(id);
  }

  async getReputationHistory(numberId: string): Promise<CallerIdReputationEvent[]> {
    return this.reputationEventRepository.find({
      where: { callerIdNumberId: numberId },
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== Scheduled Tasks ====================

  async resetDailyCounters(): Promise<void> {
    await this.numberRepository.update({}, { callsToday: 0 });
    this.logger.log('Daily caller ID counters reset');
  }

  async processCooldowns(): Promise<void> {
    const now = new Date();
    await this.numberRepository.update(
      {
        status: 'cooling_down',
        cooldownUntil: LessThanOrEqual(now),
      },
      { status: 'active', cooldownUntil: null },
    );
  }

  // ==================== Utilities ====================

  extractAreaCode(phoneNumber: string): string | null {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');

    // Handle various formats
    if (digits.length === 11 && digits.startsWith('1')) {
      // US number with country code: 1XXXXXXXXXX
      return digits.substring(1, 4);
    } else if (digits.length === 10) {
      // US number without country code: XXXXXXXXXX
      return digits.substring(0, 3);
    } else if (digits.length > 10) {
      // International, try to extract after country code
      // This is simplified; real implementation would use libphonenumber
      return digits.substring(digits.length - 10, digits.length - 7);
    }

    return null;
  }
}
