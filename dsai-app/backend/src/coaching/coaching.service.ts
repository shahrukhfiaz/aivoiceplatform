import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, MoreThanOrEqual } from 'typeorm';
import {
  AiEvaluation,
  EvaluationStatus,
} from './entities/ai-evaluation.entity';
import {
  CoachingInsight,
  TrainingRecommendation,
  InsightType,
} from './entities/coaching-insight.entity';
import { LlmEvaluator, QaScorecard } from './evaluators/llm-evaluator';

export interface EvaluateCallOptions {
  callId: string;
  transcript: string;
  agentId?: string;
  campaignId?: string;
  organizationId?: string;
  scorecard?: QaScorecard;
  scorecardId?: string;
}

export interface AgentPerformanceSummary {
  agentId: string;
  evaluationCount: number;
  avgScore: number;
  passRate: number;
  trend: 'improving' | 'declining' | 'stable';
  categoryAverages: Record<string, number>;
  recentInsights: CoachingInsight[];
  pendingRecommendations: number;
}

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  constructor(
    @InjectRepository(AiEvaluation)
    private readonly evaluationRepo: Repository<AiEvaluation>,
    @InjectRepository(CoachingInsight)
    private readonly insightRepo: Repository<CoachingInsight>,
    @InjectRepository(TrainingRecommendation)
    private readonly recommendationRepo: Repository<TrainingRecommendation>,
    private readonly llmEvaluator: LlmEvaluator,
  ) {}

  // ==================== Evaluation ====================

  /**
   * Evaluate a call using AI
   */
  async evaluateCall(options: EvaluateCallOptions): Promise<AiEvaluation> {
    const {
      callId,
      transcript,
      agentId,
      campaignId,
      organizationId,
      scorecard,
      scorecardId,
    } = options;

    // Check if already evaluated
    let evaluation = await this.evaluationRepo.findOne({ where: { callId } });

    if (!evaluation) {
      evaluation = this.evaluationRepo.create({
        callId,
        agentId,
        campaignId,
        organizationId,
        scorecardId,
        status: 'processing',
      });
      evaluation = await this.evaluationRepo.save(evaluation);
    } else {
      evaluation.status = 'processing';
      await this.evaluationRepo.save(evaluation);
    }

    const startTime = Date.now();

    try {
      // Use provided scorecard or default
      const usedScorecard = scorecard || this.llmEvaluator.getDefaultScorecard();

      const result = await this.llmEvaluator.evaluateCall(
        transcript,
        usedScorecard,
        { callId, agentId, campaignId, organizationId },
      );

      // Update evaluation with results
      Object.assign(evaluation, {
        categoryScores: result.categoryScores,
        totalScore: result.totalScore,
        passed: result.passed,
        overallSummary: result.overallSummary,
        strengths: result.strengths,
        areasForImprovement: result.areasForImprovement,
        specificFeedback: result.specificFeedback,
        llmProvider: result.provider,
        llmModel: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        processingCost: result.cost,
        processingTimeMs: Date.now() - startTime,
        status: 'completed' as EvaluationStatus,
      });

      return this.evaluationRepo.save(evaluation);
    } catch (error) {
      evaluation.status = 'failed';
      evaluation.errorMessage = error instanceof Error ? error.message : String(error);
      evaluation.processingTimeMs = Date.now() - startTime;
      await this.evaluationRepo.save(evaluation);

      throw error;
    }
  }

  /**
   * Get evaluation by call ID
   */
  async getEvaluationByCallId(callId: string): Promise<AiEvaluation | null> {
    return this.evaluationRepo.findOne({ where: { callId } });
  }

  /**
   * Get evaluation by ID
   */
  async findById(id: string): Promise<AiEvaluation> {
    const evaluation = await this.evaluationRepo.findOne({ where: { id } });
    if (!evaluation) throw new NotFoundException('Evaluation not found');
    return evaluation;
  }

  /**
   * List evaluations
   */
  async findAllEvaluations(params: {
    agentId?: string;
    campaignId?: string;
    organizationId?: string;
    status?: EvaluationStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AiEvaluation[]; total: number }> {
    const {
      agentId,
      campaignId,
      organizationId,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    const where: Record<string, unknown> = {};
    if (agentId) where.agentId = agentId;
    if (campaignId) where.campaignId = campaignId;
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [data, total] = await this.evaluationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  // ==================== Insights ====================

  /**
   * Generate insights for an agent based on recent evaluations
   */
  async generateAgentInsights(
    agentId: string,
    campaignId?: string,
    organizationId?: string,
  ): Promise<CoachingInsight[]> {
    // Get recent completed evaluations
    const evaluations = await this.evaluationRepo.find({
      where: {
        agentId,
        status: 'completed',
        ...(campaignId && { campaignId }),
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    if (evaluations.length < 3) {
      this.logger.debug(
        `Not enough evaluations for insights (${evaluations.length}/3)`,
      );
      return [];
    }

    // Generate insights using LLM
    const { insights, cost } = await this.llmEvaluator.generateInsights(
      agentId,
      evaluations.map((e) => ({
        callId: e.callId,
        totalScore: e.totalScore || 0,
        categoryScores: e.categoryScores || [],
        areasForImprovement: e.areasForImprovement || [],
        strengths: e.strengths || [],
      })),
      { campaignId, organizationId },
    );

    // Save insights
    const savedInsights: CoachingInsight[] = [];
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7); // Valid for 7 days

    for (const insight of insights) {
      const existing = await this.insightRepo.findOne({
        where: {
          agentId,
          category: insight.category,
          title: insight.title,
          isActive: true,
        },
      });

      if (existing) {
        // Update existing insight
        existing.description = insight.description;
        existing.severity = insight.severity;
        existing.actionItems = insight.actionItems;
        existing.validUntil = validUntil;
        savedInsights.push(await this.insightRepo.save(existing));
      } else {
        // Create new insight
        const newInsight = this.insightRepo.create({
          agentId,
          campaignId,
          organizationId,
          insightType: insight.type,
          category: insight.category,
          title: insight.title,
          description: insight.description,
          severity: insight.severity,
          actionItems: insight.actionItems,
          supportingData: {
            sampleCount: evaluations.length,
          },
          validUntil,
        });
        savedInsights.push(await this.insightRepo.save(newInsight));
      }
    }

    return savedInsights;
  }

  /**
   * Get insights for an agent
   */
  async getAgentInsights(
    agentId: string,
    params?: {
      campaignId?: string;
      insightType?: InsightType;
      acknowledged?: boolean;
      limit?: number;
    },
  ): Promise<CoachingInsight[]> {
    const { campaignId, insightType, acknowledged, limit = 20 } = params || {};

    const where: Record<string, unknown> = {
      agentId,
      isActive: true,
    };
    if (campaignId) where.campaignId = campaignId;
    if (insightType) where.insightType = insightType;
    if (acknowledged !== undefined) where.isAcknowledged = acknowledged;

    return this.insightRepo.find({
      where,
      order: { severity: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Acknowledge an insight
   */
  async acknowledgeInsight(
    id: string,
    userId: string,
    notes?: string,
  ): Promise<CoachingInsight> {
    const insight = await this.insightRepo.findOne({ where: { id } });
    if (!insight) throw new NotFoundException('Insight not found');

    insight.isAcknowledged = true;
    insight.acknowledgedAt = new Date();
    insight.acknowledgedByUserId = userId;
    if (notes) insight.managerNotes = notes;

    return this.insightRepo.save(insight);
  }

  // ==================== Training Recommendations ====================

  /**
   * Create a training recommendation
   */
  async createRecommendation(params: {
    agentId: string;
    campaignId?: string;
    organizationId?: string;
    insightId?: string;
    title: string;
    description: string;
    category: string;
    priority?: number;
    resources?: Array<{
      type: 'video' | 'document' | 'exercise' | 'call_review';
      title: string;
      url?: string;
      callId?: string;
    }>;
  }): Promise<TrainingRecommendation> {
    const recommendation = this.recommendationRepo.create({
      ...params,
      priority: params.priority || 5,
      status: 'pending',
    });

    return this.recommendationRepo.save(recommendation);
  }

  /**
   * Get training recommendations for an agent
   */
  async getAgentRecommendations(
    agentId: string,
    status?: 'pending' | 'in_progress' | 'completed' | 'dismissed',
  ): Promise<TrainingRecommendation[]> {
    const where: Record<string, unknown> = { agentId };
    if (status) where.status = status;

    return this.recommendationRepo.find({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(
    id: string,
    status: 'in_progress' | 'completed' | 'dismissed',
    notes?: string,
  ): Promise<TrainingRecommendation> {
    const recommendation = await this.recommendationRepo.findOne({
      where: { id },
    });
    if (!recommendation)
      throw new NotFoundException('Recommendation not found');

    recommendation.status = status;

    if (status === 'in_progress' && !recommendation.startedAt) {
      recommendation.startedAt = new Date();
    } else if (status === 'completed') {
      recommendation.completedAt = new Date();
      if (notes) recommendation.completionNotes = notes;
    }

    return this.recommendationRepo.save(recommendation);
  }

  // ==================== Agent Performance Summary ====================

  /**
   * Get performance summary for an agent
   */
  async getAgentPerformanceSummary(
    agentId: string,
    params?: {
      campaignId?: string;
      days?: number;
    },
  ): Promise<AgentPerformanceSummary> {
    const { campaignId, days = 30 } = params || {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get evaluations
    const where: Record<string, unknown> = {
      agentId,
      status: 'completed',
      createdAt: MoreThanOrEqual(startDate),
    };
    if (campaignId) where.campaignId = campaignId;

    const evaluations = await this.evaluationRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });

    // Calculate metrics
    const evaluationCount = evaluations.length;
    const avgScore =
      evaluationCount > 0
        ? evaluations.reduce((sum, e) => sum + (e.totalScore || 0), 0) /
          evaluationCount
        : 0;
    const passCount = evaluations.filter((e) => e.passed).length;
    const passRate = evaluationCount > 0 ? (passCount / evaluationCount) * 100 : 0;

    // Calculate trend (compare first half to second half)
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (evaluationCount >= 6) {
      const mid = Math.floor(evaluationCount / 2);
      const firstHalf = evaluations.slice(0, mid);
      const secondHalf = evaluations.slice(mid);

      const firstAvg =
        firstHalf.reduce((sum, e) => sum + (e.totalScore || 0), 0) /
        firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, e) => sum + (e.totalScore || 0), 0) /
        secondHalf.length;

      const diff = secondAvg - firstAvg;
      if (diff > 5) trend = 'improving';
      else if (diff < -5) trend = 'declining';
    }

    // Calculate category averages
    const categoryAverages: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    for (const eval of evaluations) {
      if (!eval.categoryScores) continue;
      for (const cat of eval.categoryScores) {
        if (!categoryAverages[cat.name]) {
          categoryAverages[cat.name] = 0;
          categoryCounts[cat.name] = 0;
        }
        categoryAverages[cat.name] += cat.score;
        categoryCounts[cat.name]++;
      }
    }

    for (const name of Object.keys(categoryAverages)) {
      categoryAverages[name] = categoryAverages[name] / categoryCounts[name];
    }

    // Get recent insights
    const recentInsights = await this.getAgentInsights(agentId, {
      campaignId,
      limit: 5,
    });

    // Get pending recommendations count
    const pendingRecommendations = await this.recommendationRepo.count({
      where: { agentId, status: 'pending' },
    });

    return {
      agentId,
      evaluationCount,
      avgScore: Math.round(avgScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      trend,
      categoryAverages,
      recentInsights,
      pendingRecommendations,
    };
  }

  /**
   * Compare AI evaluation with human evaluation
   */
  async compareWithHumanEvaluation(
    callId: string,
    humanScore: number,
    humanCategoryScores?: Record<string, number>,
  ): Promise<{
    aiScore: number;
    humanScore: number;
    scoreDifference: number;
    categoryDifferences?: Record<string, number>;
    alignment: 'good' | 'moderate' | 'poor';
  }> {
    const aiEvaluation = await this.getEvaluationByCallId(callId);

    if (!aiEvaluation || aiEvaluation.status !== 'completed') {
      throw new NotFoundException('No completed AI evaluation found for this call');
    }

    const aiScore = aiEvaluation.totalScore || 0;
    const scoreDifference = Math.abs(aiScore - humanScore);

    // Calculate category differences if provided
    let categoryDifferences: Record<string, number> | undefined;
    if (humanCategoryScores && aiEvaluation.categoryScores) {
      categoryDifferences = {};
      for (const aiCat of aiEvaluation.categoryScores) {
        const humanCatScore = humanCategoryScores[aiCat.name];
        if (humanCatScore !== undefined) {
          categoryDifferences[aiCat.name] = Math.abs(aiCat.score - humanCatScore);
        }
      }
    }

    // Determine alignment
    let alignment: 'good' | 'moderate' | 'poor';
    if (scoreDifference <= 10) alignment = 'good';
    else if (scoreDifference <= 20) alignment = 'moderate';
    else alignment = 'poor';

    return {
      aiScore,
      humanScore,
      scoreDifference,
      categoryDifferences,
      alignment,
    };
  }
}
