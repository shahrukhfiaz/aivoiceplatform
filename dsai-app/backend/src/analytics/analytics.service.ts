import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  CallAnalytics,
  AnalyticsStatus,
} from './entities/call-analytics.entity';
import {
  KeywordMatch,
  KeywordConfig,
  KeywordCategory,
} from './entities/keyword-match.entity';
import {
  SpeechMetricsProcessor,
  TranscriptSegment,
} from './processors/speech-metrics.processor';
import {
  KeywordDetectorProcessor,
  KeywordRule,
} from './processors/keyword-detector.processor';
import {
  ScriptAdherenceProcessor,
  ScriptElement,
} from './processors/script-adherence.processor';

export interface AnalyzeCallOptions {
  callId: string;
  transcript: string | TranscriptSegment[];
  totalDurationMs?: number;
  campaignId?: string;
  agentId?: string;
  organizationId?: string;
  script?: string;
  scriptElements?: ScriptElement[];
  skipScriptAnalysis?: boolean;
}

export interface AnalyticsSummary {
  totalCalls: number;
  avgTalkRatio: number;
  avgListenRatio: number;
  avgSilenceSeconds: number;
  avgScriptAdherence: number;
  avgInterruptions: number;
  avgAgentWpm: number;
  keywordStats: {
    totalMatches: number;
    byCategory: Record<KeywordCategory, number>;
  };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(CallAnalytics)
    private readonly analyticsRepo: Repository<CallAnalytics>,
    @InjectRepository(KeywordMatch)
    private readonly keywordMatchRepo: Repository<KeywordMatch>,
    @InjectRepository(KeywordConfig)
    private readonly keywordConfigRepo: Repository<KeywordConfig>,
    private readonly speechMetrics: SpeechMetricsProcessor,
    private readonly keywordDetector: KeywordDetectorProcessor,
    private readonly scriptAdherence: ScriptAdherenceProcessor,
  ) {}

  // ==================== Analysis ====================

  /**
   * Analyze a call transcript
   */
  async analyzeCall(options: AnalyzeCallOptions): Promise<CallAnalytics> {
    const {
      callId,
      transcript,
      totalDurationMs,
      campaignId,
      agentId,
      organizationId,
      script,
      scriptElements,
      skipScriptAnalysis = false,
    } = options;

    // Check if already analyzed
    let analytics = await this.analyticsRepo.findOne({ where: { callId } });

    if (!analytics) {
      analytics = this.analyticsRepo.create({
        callId,
        campaignId,
        agentId,
        organizationId,
        status: 'processing',
      });
      analytics = await this.analyticsRepo.save(analytics);
    } else {
      analytics.status = 'processing';
      await this.analyticsRepo.save(analytics);
    }

    try {
      // Convert transcript to segments if needed
      const segments = this.normalizeTranscript(transcript);
      const transcriptText = this.segmentsToText(segments);

      // Process speech metrics (no LLM)
      const metrics = this.speechMetrics.processTranscript(segments, totalDurationMs);

      // Update analytics with speech metrics
      Object.assign(analytics, {
        talkRatio: metrics.talkRatio,
        listenRatio: metrics.listenRatio,
        agentTalkTimeSeconds: metrics.agentTalkTimeSeconds,
        customerTalkTimeSeconds: metrics.customerTalkTimeSeconds,
        totalCallDurationSeconds: metrics.totalCallDurationSeconds,
        totalSilenceSeconds: metrics.totalSilenceSeconds,
        silenceCount: metrics.silenceCount,
        avgSilenceDuration: metrics.avgSilenceDuration,
        longestSilenceSeconds: metrics.longestSilenceSeconds,
        agentWordsPerMinute: metrics.agentWordsPerMinute,
        customerWordsPerMinute: metrics.customerWordsPerMinute,
        agentWordCount: metrics.agentWordCount,
        customerWordCount: metrics.customerWordCount,
        agentInterruptions: metrics.agentInterruptions,
        customerInterruptions: metrics.customerInterruptions,
      });

      // Detect keywords
      const customKeywords = await this.getKeywordRules(organizationId, campaignId);
      const keywordResults = this.keywordDetector.detectKeywords(
        segments.map((s) => ({
          speaker: s.speaker,
          text: s.text,
          startMs: s.startMs,
        })),
        customKeywords,
      );

      // Save keyword matches
      if (keywordResults.length > 0) {
        const keywordEntities = keywordResults.map((kr) =>
          this.keywordMatchRepo.create({
            callAnalyticsId: analytics!.id,
            keyword: kr.keyword,
            category: kr.category,
            speaker: kr.speaker,
            matchedText: kr.matchedText,
            timestampMs: kr.timestampMs,
            confidence: kr.confidence,
          }),
        );
        await this.keywordMatchRepo.save(keywordEntities);
      }

      // Script adherence analysis (uses LLM if script provided)
      let processingCost = 0;

      if (!skipScriptAnalysis && (script || scriptElements)) {
        const elements =
          scriptElements ||
          (script ? this.scriptAdherence.parseScriptText(script) : []);

        if (elements.length > 0) {
          const adherenceResult = await this.scriptAdherence.analyzeScriptAdherence(
            transcriptText,
            elements,
            { callId, campaignId, organizationId },
          );

          analytics.scriptAdherenceScore = adherenceResult.score;
          analytics.scriptMatches = adherenceResult.matches;
          analytics.missedScriptElements = adherenceResult.missedElements;
          processingCost += adherenceResult.cost;
        }
      }

      // Finalize
      analytics.status = 'completed';
      analytics.processingCost = processingCost;
      analytics.analyzedAt = new Date();

      return this.analyticsRepo.save(analytics);
    } catch (error) {
      this.logger.error(`Analysis failed for call ${callId}: ${error}`);

      analytics.status = 'failed';
      analytics.errorMessage = error instanceof Error ? error.message : String(error);
      await this.analyticsRepo.save(analytics);

      throw error;
    }
  }

  /**
   * Normalize transcript to segments array
   */
  private normalizeTranscript(
    transcript: string | TranscriptSegment[],
  ): TranscriptSegment[] {
    if (Array.isArray(transcript)) {
      return transcript;
    }

    // Parse text transcript
    const segments: TranscriptSegment[] = [];
    const lines = transcript.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const agentMatch = trimmedLine.match(
        /^(agent|ai|assistant|rep|representative):\s*(.+)/i,
      );
      const customerMatch = trimmedLine.match(
        /^(customer|user|caller|client):\s*(.+)/i,
      );

      if (agentMatch) {
        segments.push({ speaker: 'agent', text: agentMatch[2] });
      } else if (customerMatch) {
        segments.push({ speaker: 'customer', text: customerMatch[2] });
      }
    }

    return segments;
  }

  /**
   * Convert segments to plain text
   */
  private segmentsToText(segments: TranscriptSegment[]): string {
    return segments
      .map((s) => `${s.speaker === 'agent' ? 'Agent' : 'Customer'}: ${s.text}`)
      .join('\n');
  }

  // ==================== Keywords ====================

  /**
   * Get keyword rules for detection
   */
  private async getKeywordRules(
    organizationId?: string,
    campaignId?: string,
  ): Promise<KeywordRule[]> {
    const where: Record<string, unknown>[] = [
      { isActive: true, organizationId: null, campaignId: null }, // Global
    ];

    if (organizationId) {
      where.push({ isActive: true, organizationId, campaignId: null });
    }

    if (campaignId) {
      where.push({ isActive: true, campaignId });
    }

    const configs = await this.keywordConfigRepo.find({ where });

    return configs.map((c) => ({
      keyword: c.keyword,
      category: c.category,
      isCaseSensitive: c.isCaseSensitive,
      isRegex: c.isRegex,
    }));
  }

  /**
   * Add a keyword configuration
   */
  async addKeyword(params: {
    keyword: string;
    category: KeywordCategory;
    organizationId?: string;
    campaignId?: string;
    isCaseSensitive?: boolean;
    isRegex?: boolean;
    alertThreshold?: number;
  }): Promise<KeywordConfig> {
    const config = this.keywordConfigRepo.create(params);
    return this.keywordConfigRepo.save(config);
  }

  /**
   * Get keyword configurations
   */
  async getKeywords(
    organizationId?: string,
    campaignId?: string,
  ): Promise<KeywordConfig[]> {
    const where: Record<string, unknown> = {};
    if (organizationId !== undefined) where.organizationId = organizationId;
    if (campaignId !== undefined) where.campaignId = campaignId;

    return this.keywordConfigRepo.find({
      where,
      order: { category: 'ASC', keyword: 'ASC' },
    });
  }

  /**
   * Delete keyword configuration
   */
  async deleteKeyword(id: string): Promise<void> {
    await this.keywordConfigRepo.delete(id);
  }

  // ==================== Retrieval ====================

  /**
   * Get analytics for a call
   */
  async getCallAnalytics(callId: string): Promise<CallAnalytics | null> {
    return this.analyticsRepo.findOne({ where: { callId } });
  }

  /**
   * Get analytics by ID
   */
  async findById(id: string): Promise<CallAnalytics> {
    const analytics = await this.analyticsRepo.findOne({ where: { id } });
    if (!analytics) throw new NotFoundException('Analytics not found');
    return analytics;
  }

  /**
   * List analytics with filters
   */
  async findAll(params: {
    campaignId?: string;
    agentId?: string;
    organizationId?: string;
    status?: AnalyticsStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CallAnalytics[]; total: number }> {
    const {
      campaignId,
      agentId,
      organizationId,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    const where: Record<string, unknown> = {};
    if (campaignId) where.campaignId = campaignId;
    if (agentId) where.agentId = agentId;
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [data, total] = await this.analyticsRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  /**
   * Get keyword matches for a call
   */
  async getKeywordMatches(callAnalyticsId: string): Promise<KeywordMatch[]> {
    return this.keywordMatchRepo.find({
      where: { callAnalyticsId },
      order: { timestampMs: 'ASC' },
    });
  }

  // ==================== Aggregations ====================

  /**
   * Get summary statistics
   */
  async getSummary(params: {
    campaignId?: string;
    agentId?: string;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AnalyticsSummary> {
    const { campaignId, agentId, organizationId, startDate, endDate } = params;

    const qb = this.analyticsRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: 'completed' });

    if (campaignId) qb.andWhere('a.campaignId = :campaignId', { campaignId });
    if (agentId) qb.andWhere('a.agentId = :agentId', { agentId });
    if (organizationId)
      qb.andWhere('a.organizationId = :organizationId', { organizationId });
    if (startDate && endDate) {
      qb.andWhere('a.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const analytics = await qb.getMany();

    if (analytics.length === 0) {
      return {
        totalCalls: 0,
        avgTalkRatio: 0,
        avgListenRatio: 0,
        avgSilenceSeconds: 0,
        avgScriptAdherence: 0,
        avgInterruptions: 0,
        avgAgentWpm: 0,
        keywordStats: {
          totalMatches: 0,
          byCategory: {
            compliance: 0,
            objection: 0,
            positive: 0,
            negative: 0,
            competitor: 0,
            custom: 0,
          },
        },
      };
    }

    // Calculate averages
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => (arr.length > 0 ? sum(arr) / arr.length : 0);

    const scriptScores = analytics
      .filter((a) => a.scriptAdherenceScore !== null)
      .map((a) => a.scriptAdherenceScore!);

    // Get keyword stats
    const analyticsIds = analytics.map((a) => a.id);
    const keywordMatches = await this.keywordMatchRepo.find({
      where: { callAnalyticsId: In(analyticsIds) },
    });

    const byCategory: Record<KeywordCategory, number> = {
      compliance: 0,
      objection: 0,
      positive: 0,
      negative: 0,
      competitor: 0,
      custom: 0,
    };

    for (const match of keywordMatches) {
      byCategory[match.category]++;
    }

    return {
      totalCalls: analytics.length,
      avgTalkRatio: avg(analytics.map((a) => a.talkRatio)),
      avgListenRatio: avg(analytics.map((a) => a.listenRatio)),
      avgSilenceSeconds: avg(analytics.map((a) => a.totalSilenceSeconds)),
      avgScriptAdherence: scriptScores.length > 0 ? avg(scriptScores) : 0,
      avgInterruptions: avg(
        analytics.map((a) => a.agentInterruptions + a.customerInterruptions),
      ),
      avgAgentWpm: avg(analytics.map((a) => a.agentWordsPerMinute)),
      keywordStats: {
        totalMatches: keywordMatches.length,
        byCategory,
      },
    };
  }

  /**
   * Get script adherence trends by agent
   */
  async getScriptAdherenceTrend(params: {
    campaignId: string;
    agentId?: string;
    days?: number;
  }): Promise<Array<{ date: string; avgScore: number; count: number }>> {
    const { campaignId, agentId, days = 30 } = params;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const qb = this.analyticsRepo
      .createQueryBuilder('a')
      .select("DATE(a.createdAt)", 'date')
      .addSelect('AVG(a.scriptAdherenceScore)', 'avgScore')
      .addSelect('COUNT(*)', 'count')
      .where('a.campaignId = :campaignId', { campaignId })
      .andWhere('a.status = :status', { status: 'completed' })
      .andWhere('a.scriptAdherenceScore IS NOT NULL')
      .andWhere('a.createdAt >= :startDate', { startDate })
      .groupBy('date')
      .orderBy('date', 'ASC');

    if (agentId) {
      qb.andWhere('a.agentId = :agentId', { agentId });
    }

    const results = await qb.getRawMany();

    return results.map((r) => ({
      date: r.date,
      avgScore: parseFloat(r.avgScore) || 0,
      count: parseInt(r.count) || 0,
    }));
  }
}
