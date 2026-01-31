import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  CallSentiment,
  SentimentStatus,
  SentimentLabel,
  Emotion,
} from './entities/call-sentiment.entity';
import { UtteranceSentiment } from './entities/utterance-sentiment.entity';
import {
  LlmSentimentAnalyzer,
  TranscriptForSentiment,
} from './analyzers/llm-sentiment.analyzer';

export interface AnalyzeCallSentimentOptions {
  callId: string;
  transcript: string | TranscriptForSentiment[];
  campaignId?: string;
  agentId?: string;
  organizationId?: string;
}

export interface SentimentSummary {
  totalCalls: number;
  avgSentiment: number;
  sentimentDistribution: Record<SentimentLabel, number>;
  emotionDistribution: Record<Emotion, number>;
  satisfactionRate: number;
  avgSentimentDelta: number;
}

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);

  constructor(
    @InjectRepository(CallSentiment)
    private readonly sentimentRepo: Repository<CallSentiment>,
    @InjectRepository(UtteranceSentiment)
    private readonly utteranceRepo: Repository<UtteranceSentiment>,
    private readonly llmAnalyzer: LlmSentimentAnalyzer,
  ) {}

  // ==================== Analysis ====================

  /**
   * Analyze sentiment of a call
   */
  async analyzeCall(
    options: AnalyzeCallSentimentOptions,
  ): Promise<CallSentiment> {
    const { callId, transcript, campaignId, agentId, organizationId } = options;

    // Check if already analyzed
    let sentiment = await this.sentimentRepo.findOne({ where: { callId } });

    if (!sentiment) {
      sentiment = this.sentimentRepo.create({
        callId,
        campaignId,
        agentId,
        organizationId,
        status: 'processing',
      });
      sentiment = await this.sentimentRepo.save(sentiment);
    } else {
      sentiment.status = 'processing';
      await this.sentimentRepo.save(sentiment);
    }

    try {
      // Normalize transcript
      const segments = this.normalizeTranscript(transcript);

      // Analyze using LLM
      const result = await this.llmAnalyzer.analyzeTranscript(segments, {
        callId,
        campaignId,
        organizationId,
      });

      // Update sentiment entity
      Object.assign(sentiment, {
        overallSentiment: result.overallSentiment,
        overallLabel: result.overallLabel,
        customerStartSentiment: result.customerStartSentiment,
        customerEndSentiment: result.customerEndSentiment,
        customerSentimentDelta: result.customerSentimentDelta,
        emotionsDetected: result.emotionsDetected,
        dominantEmotion: result.dominantEmotion,
        sentimentTrajectory: result.sentimentTrajectory,
        customerSatisfied: result.customerSatisfied,
        satisfactionConfidence: result.satisfactionConfidence,
        satisfactionIndicators: result.satisfactionIndicators,
        llmProvider: result.provider,
        processingCost: result.cost,
        status: 'completed' as SentimentStatus,
      });

      sentiment = await this.sentimentRepo.save(sentiment);

      // Save utterance sentiments
      if (result.utterances.length > 0) {
        const utteranceEntities = result.utterances.map((u, i) =>
          this.utteranceRepo.create({
            callSentimentId: sentiment!.id,
            sequenceNumber: i + 1,
            speaker: u.speaker,
            text: u.text,
            timestampMs: u.timestampMs,
            sentiment: u.sentiment,
            sentimentLabel: u.sentimentLabel,
            emotion: u.emotion,
            emotionIntensity: u.emotionIntensity,
            keywords: u.keywords,
          }),
        );

        await this.utteranceRepo.save(utteranceEntities);
      }

      return sentiment;
    } catch (error) {
      sentiment.status = 'failed';
      sentiment.errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.sentimentRepo.save(sentiment);

      throw error;
    }
  }

  /**
   * Normalize transcript to array format
   */
  private normalizeTranscript(
    transcript: string | TranscriptForSentiment[],
  ): TranscriptForSentiment[] {
    if (Array.isArray(transcript)) {
      return transcript;
    }

    // Parse text transcript
    const segments: TranscriptForSentiment[] = [];
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

  // ==================== Retrieval ====================

  /**
   * Get sentiment for a call
   */
  async getCallSentiment(callId: string): Promise<CallSentiment | null> {
    return this.sentimentRepo.findOne({ where: { callId } });
  }

  /**
   * Get sentiment by ID
   */
  async findById(id: string): Promise<CallSentiment> {
    const sentiment = await this.sentimentRepo.findOne({ where: { id } });
    if (!sentiment) throw new NotFoundException('Sentiment not found');
    return sentiment;
  }

  /**
   * List sentiments with filters
   */
  async findAll(params: {
    campaignId?: string;
    agentId?: string;
    organizationId?: string;
    status?: SentimentStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CallSentiment[]; total: number }> {
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

    const [data, total] = await this.sentimentRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  /**
   * Get utterance sentiments for a call
   */
  async getUtterances(callSentimentId: string): Promise<UtteranceSentiment[]> {
    return this.utteranceRepo.find({
      where: { callSentimentId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  // ==================== Aggregations ====================

  /**
   * Get sentiment summary
   */
  async getSummary(params: {
    campaignId?: string;
    agentId?: string;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<SentimentSummary> {
    const { campaignId, agentId, organizationId, startDate, endDate } = params;

    const where: Record<string, unknown> = { status: 'completed' };
    if (campaignId) where.campaignId = campaignId;
    if (agentId) where.agentId = agentId;
    if (organizationId) where.organizationId = organizationId;
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const sentiments = await this.sentimentRepo.find({ where });

    if (sentiments.length === 0) {
      return {
        totalCalls: 0,
        avgSentiment: 0,
        sentimentDistribution: {
          very_negative: 0,
          negative: 0,
          neutral: 0,
          positive: 0,
          very_positive: 0,
        },
        emotionDistribution: {
          angry: 0,
          frustrated: 0,
          confused: 0,
          neutral: 0,
          satisfied: 0,
          happy: 0,
          excited: 0,
        },
        satisfactionRate: 0,
        avgSentimentDelta: 0,
      };
    }

    // Calculate averages
    const avgSentiment =
      sentiments.reduce((sum, s) => sum + (s.overallSentiment || 0), 0) /
      sentiments.length;

    const avgSentimentDelta =
      sentiments.reduce((sum, s) => sum + (s.customerSentimentDelta || 0), 0) /
      sentiments.length;

    const satisfiedCount = sentiments.filter((s) => s.customerSatisfied).length;
    const satisfactionRate = (satisfiedCount / sentiments.length) * 100;

    // Sentiment distribution
    const sentimentDistribution: Record<SentimentLabel, number> = {
      very_negative: 0,
      negative: 0,
      neutral: 0,
      positive: 0,
      very_positive: 0,
    };

    for (const s of sentiments) {
      if (s.overallLabel) {
        sentimentDistribution[s.overallLabel]++;
      }
    }

    // Emotion distribution
    const emotionDistribution: Record<Emotion, number> = {
      angry: 0,
      frustrated: 0,
      confused: 0,
      neutral: 0,
      satisfied: 0,
      happy: 0,
      excited: 0,
    };

    for (const s of sentiments) {
      if (s.emotionsDetected) {
        for (const ed of s.emotionsDetected) {
          if (emotionDistribution[ed.emotion] !== undefined) {
            emotionDistribution[ed.emotion] += ed.count;
          }
        }
      }
    }

    return {
      totalCalls: sentiments.length,
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      sentimentDistribution,
      emotionDistribution,
      satisfactionRate: Math.round(satisfactionRate * 10) / 10,
      avgSentimentDelta: Math.round(avgSentimentDelta * 100) / 100,
    };
  }

  /**
   * Get sentiment trends over time
   */
  async getSentimentTrends(params: {
    campaignId?: string;
    agentId?: string;
    days?: number;
  }): Promise<
    Array<{
      date: string;
      avgSentiment: number;
      satisfactionRate: number;
      count: number;
    }>
  > {
    const { campaignId, agentId, days = 30 } = params;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const qb = this.sentimentRepo
      .createQueryBuilder('s')
      .select("DATE(s.createdAt)", 'date')
      .addSelect('AVG(s.overallSentiment)', 'avgSentiment')
      .addSelect(
        "SUM(CASE WHEN s.customerSatisfied = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*)",
        'satisfactionRate',
      )
      .addSelect('COUNT(*)', 'count')
      .where('s.status = :status', { status: 'completed' })
      .andWhere('s.createdAt >= :startDate', { startDate })
      .groupBy('date')
      .orderBy('date', 'ASC');

    if (campaignId) {
      qb.andWhere('s.campaignId = :campaignId', { campaignId });
    }
    if (agentId) {
      qb.andWhere('s.agentId = :agentId', { agentId });
    }

    const results = await qb.getRawMany();

    return results.map((r) => ({
      date: r.date,
      avgSentiment: parseFloat(r.avgSentiment) || 0,
      satisfactionRate: parseFloat(r.satisfactionRate) || 0,
      count: parseInt(r.count) || 0,
    }));
  }

  /**
   * Get calls with negative sentiment (for alerting)
   */
  async getNegativeSentimentCalls(params: {
    campaignId?: string;
    organizationId?: string;
    threshold?: number;
    limit?: number;
  }): Promise<CallSentiment[]> {
    const { campaignId, organizationId, threshold = -0.3, limit = 20 } = params;

    const qb = this.sentimentRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: 'completed' })
      .andWhere('s.overallSentiment <= :threshold', { threshold })
      .orderBy('s.overallSentiment', 'ASC')
      .take(limit);

    if (campaignId) {
      qb.andWhere('s.campaignId = :campaignId', { campaignId });
    }
    if (organizationId) {
      qb.andWhere('s.organizationId = :organizationId', { organizationId });
    }

    return qb.getMany();
  }
}
