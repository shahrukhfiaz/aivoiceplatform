import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { AiUsageLog, AiFeatureType, AiProvider } from '../entities/ai-usage-log.entity';
import { PROVIDER_PRICING } from '../interfaces/ai-provider.interface';

export interface UsageSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  successRate: number;
  byFeature: Record<AiFeatureType, {
    calls: number;
    cost: number;
    tokens: number;
  }>;
  byProvider: Record<AiProvider, {
    calls: number;
    cost: number;
    tokens: number;
  }>;
}

@Injectable()
export class AiCostTrackerService {
  private readonly logger = new Logger(AiCostTrackerService.name);

  constructor(
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
  ) {}

  /**
   * Calculate the cost for a completion based on token usage
   */
  calculateCost(
    provider: AiProvider,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const providerPricing = PROVIDER_PRICING[provider];
    if (!providerPricing) {
      this.logger.warn(`Unknown provider: ${provider}, using zero cost`);
      return 0;
    }

    const modelPricing = providerPricing[model];
    if (!modelPricing) {
      this.logger.warn(`Unknown model: ${model} for provider ${provider}, using zero cost`);
      return 0;
    }

    const inputCost = (inputTokens / 1000) * modelPricing.inputCostPer1k;
    const outputCost = (outputTokens / 1000) * modelPricing.outputCostPer1k;

    return inputCost + outputCost;
  }

  /**
   * Log a successful AI API call
   */
  async logUsage(params: {
    featureType: AiFeatureType;
    provider: AiProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    callId?: string;
    leadId?: string;
    agentId?: string;
    campaignId?: string;
    organizationId?: string;
    requestId?: string;
  }): Promise<AiUsageLog> {
    const cost = this.calculateCost(
      params.provider,
      params.model,
      params.inputTokens,
      params.outputTokens,
    );

    const log = this.usageRepo.create({
      ...params,
      cost,
      success: true,
    });

    return this.usageRepo.save(log);
  }

  /**
   * Log a failed AI API call
   */
  async logError(params: {
    featureType: AiFeatureType;
    provider: AiProvider;
    model: string;
    errorMessage: string;
    latencyMs: number;
    callId?: string;
    leadId?: string;
    agentId?: string;
    campaignId?: string;
    organizationId?: string;
  }): Promise<AiUsageLog> {
    const log = this.usageRepo.create({
      ...params,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      success: false,
    });

    return this.usageRepo.save(log);
  }

  /**
   * Get usage summary for a time period
   */
  async getUsageSummary(params: {
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
    campaignId?: string;
  }): Promise<UsageSummary> {
    const { startDate, endDate, organizationId, campaignId } = params;

    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(startDate);
    }
    if (organizationId) where.organizationId = organizationId;
    if (campaignId) where.campaignId = campaignId;

    const logs = await this.usageRepo.find({ where });

    const summary: UsageSummary = {
      totalCalls: logs.length,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      successRate: 0,
      byFeature: {
        speech_analytics: { calls: 0, cost: 0, tokens: 0 },
        lead_scoring: { calls: 0, cost: 0, tokens: 0 },
        coaching: { calls: 0, cost: 0, tokens: 0 },
        sentiment: { calls: 0, cost: 0, tokens: 0 },
      },
      byProvider: {
        openai: { calls: 0, cost: 0, tokens: 0 },
        gemini: { calls: 0, cost: 0, tokens: 0 },
        claude: { calls: 0, cost: 0, tokens: 0 },
      },
    };

    let totalLatency = 0;
    let successCount = 0;

    for (const log of logs) {
      summary.totalInputTokens += log.inputTokens;
      summary.totalOutputTokens += log.outputTokens;
      summary.totalCost += log.cost;
      totalLatency += log.latencyMs;

      if (log.success) successCount++;

      // By feature
      const feature = summary.byFeature[log.featureType];
      if (feature) {
        feature.calls++;
        feature.cost += log.cost;
        feature.tokens += log.inputTokens + log.outputTokens;
      }

      // By provider
      const provider = summary.byProvider[log.provider];
      if (provider) {
        provider.calls++;
        provider.cost += log.cost;
        provider.tokens += log.inputTokens + log.outputTokens;
      }
    }

    summary.avgLatencyMs = logs.length > 0 ? Math.round(totalLatency / logs.length) : 0;
    summary.successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 100;

    return summary;
  }

  /**
   * Get daily cost breakdown
   */
  async getDailyCosts(params: {
    startDate: Date;
    endDate: Date;
    organizationId?: string;
  }): Promise<Array<{ date: string; cost: number; calls: number }>> {
    const qb = this.usageRepo
      .createQueryBuilder('log')
      .select("DATE(log.createdAt)", 'date')
      .addSelect('SUM(log.cost)', 'cost')
      .addSelect('COUNT(*)', 'calls')
      .where('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: params.startDate,
        endDate: params.endDate,
      })
      .groupBy('date')
      .orderBy('date', 'ASC');

    if (params.organizationId) {
      qb.andWhere('log.organizationId = :organizationId', {
        organizationId: params.organizationId,
      });
    }

    const results = await qb.getRawMany();

    return results.map((r) => ({
      date: r.date,
      cost: parseFloat(r.cost) || 0,
      calls: parseInt(r.calls) || 0,
    }));
  }

  /**
   * Get cost estimate for a feature based on historical usage
   */
  async getEstimatedCostPerCall(
    featureType: AiFeatureType,
    organizationId?: string,
  ): Promise<number> {
    const qb = this.usageRepo
      .createQueryBuilder('log')
      .select('AVG(log.cost)', 'avgCost')
      .where('log.featureType = :featureType', { featureType })
      .andWhere('log.success = :success', { success: true });

    if (organizationId) {
      qb.andWhere('log.organizationId = :organizationId', { organizationId });
    }

    const result = await qb.getRawOne();
    return parseFloat(result?.avgCost) || 0;
  }

  /**
   * Get recent logs with pagination
   */
  async getRecentLogs(params: {
    limit?: number;
    offset?: number;
    featureType?: AiFeatureType;
    organizationId?: string;
    campaignId?: string;
    success?: boolean;
  }): Promise<{ logs: AiUsageLog[]; total: number }> {
    const { limit = 50, offset = 0, featureType, organizationId, campaignId, success } = params;

    const where: Record<string, unknown> = {};
    if (featureType) where.featureType = featureType;
    if (organizationId) where.organizationId = organizationId;
    if (campaignId) where.campaignId = campaignId;
    if (success !== undefined) where.success = success;

    const [logs, total] = await this.usageRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { logs, total };
  }
}
