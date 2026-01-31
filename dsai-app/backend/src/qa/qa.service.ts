import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { QaScorecard, ScorecardCategory } from './qa-scorecard.entity';
import { QaEvaluation, CriterionScore } from './qa-evaluation.entity';
import { CreateScorecardDto, UpdateScorecardDto } from './dto/create-scorecard.dto';
import { CreateEvaluationDto, UpdateEvaluationDto } from './dto/create-evaluation.dto';

export interface QaStats {
  totalEvaluations: number;
  averageScore: number;
  passRate: number;
  evaluationsByStatus: Record<string, number>;
}

export interface AgentQaStats {
  agentId: string;
  totalEvaluations: number;
  averageScore: number;
  passRate: number;
  trend: 'improving' | 'declining' | 'stable';
  recentScores: number[];
}

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    @InjectRepository(QaScorecard)
    private readonly scorecardRepository: Repository<QaScorecard>,
    @InjectRepository(QaEvaluation)
    private readonly evaluationRepository: Repository<QaEvaluation>,
  ) {}

  // ==================== Scorecard Methods ====================

  async createScorecard(dto: CreateScorecardDto): Promise<QaScorecard> {
    // Validate that category weights sum to 100
    const totalWeight = dto.categories.reduce((sum, cat) => sum + cat.weight, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException(`Category weights must sum to 100, got ${totalWeight}`);
    }

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.scorecardRepository.update({}, { isDefault: false });
    }

    // Calculate maxScore from criteria
    const maxScore = dto.categories.reduce((sum, cat) => {
      return sum + cat.criteria.reduce((catSum, crit) => catSum + crit.points, 0);
    }, 0);

    const scorecard = this.scorecardRepository.create({
      ...dto,
      maxScore: dto.maxScore || maxScore,
    });

    return this.scorecardRepository.save(scorecard);
  }

  async findAllScorecards(activeOnly = false): Promise<QaScorecard[]> {
    const where = activeOnly ? { isActive: true } : {};
    return this.scorecardRepository.find({
      where,
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findScorecardById(id: string): Promise<QaScorecard> {
    const scorecard = await this.scorecardRepository.findOne({ where: { id } });
    if (!scorecard) {
      throw new NotFoundException('Scorecard not found');
    }
    return scorecard;
  }

  async getDefaultScorecard(): Promise<QaScorecard | null> {
    return this.scorecardRepository.findOne({ where: { isDefault: true, isActive: true } });
  }

  async updateScorecard(id: string, dto: UpdateScorecardDto): Promise<QaScorecard> {
    const scorecard = await this.findScorecardById(id);

    if (dto.categories) {
      const totalWeight = dto.categories.reduce((sum, cat) => sum + cat.weight, 0);
      if (totalWeight !== 100) {
        throw new BadRequestException(`Category weights must sum to 100, got ${totalWeight}`);
      }
    }

    if (dto.isDefault && !scorecard.isDefault) {
      await this.scorecardRepository.update({}, { isDefault: false });
    }

    Object.assign(scorecard, dto);
    return this.scorecardRepository.save(scorecard);
  }

  async deleteScorecard(id: string): Promise<void> {
    const scorecard = await this.findScorecardById(id);

    // Check if scorecard has evaluations
    const evaluationCount = await this.evaluationRepository.count({
      where: { scorecardId: id },
    });

    if (evaluationCount > 0) {
      throw new BadRequestException(
        `Cannot delete scorecard with ${evaluationCount} evaluations. Deactivate it instead.`,
      );
    }

    await this.scorecardRepository.remove(scorecard);
  }

  // ==================== Evaluation Methods ====================

  async createEvaluation(dto: CreateEvaluationDto, evaluatorId: string): Promise<QaEvaluation> {
    const scorecard = await this.findScorecardById(dto.scorecardId);

    // Calculate scores
    const { rawScore, maxPossibleScore, totalScore, passed } = this.calculateScores(
      dto.scores,
      scorecard,
    );

    const evaluation = this.evaluationRepository.create({
      ...dto,
      evaluatorId,
      rawScore,
      maxPossibleScore,
      totalScore,
      passed,
      status: dto.status || 'completed',
    });

    const saved = await this.evaluationRepository.save(evaluation);
    this.logger.log(`Created QA evaluation ${saved.id} for call ${dto.callId}, score: ${totalScore}%`);

    return saved;
  }

  private calculateScores(
    scores: CriterionScore[],
    scorecard: QaScorecard,
  ): {
    rawScore: number;
    maxPossibleScore: number;
    totalScore: number;
    passed: boolean;
  } {
    let rawScore = 0;
    let maxPossibleScore = 0;

    for (const score of scores) {
      rawScore += score.score;
      maxPossibleScore += score.maxScore;
    }

    // Calculate weighted score based on categories
    const totalScore = maxPossibleScore > 0 ? (rawScore / maxPossibleScore) * 100 : 0;
    const passed = totalScore >= scorecard.passingScore;

    return {
      rawScore,
      maxPossibleScore,
      totalScore: Math.round(totalScore * 100) / 100,
      passed,
    };
  }

  async findAllEvaluations(options?: {
    agentId?: string;
    campaignId?: string;
    evaluatorId?: string;
    startDate?: Date;
    endDate?: Date;
    passed?: boolean;
  }): Promise<QaEvaluation[]> {
    const query = this.evaluationRepository.createQueryBuilder('evaluation')
      .leftJoinAndSelect('evaluation.scorecard', 'scorecard')
      .leftJoinAndSelect('evaluation.evaluator', 'evaluator')
      .orderBy('evaluation.createdAt', 'DESC');

    if (options?.agentId) {
      query.andWhere('evaluation.agentId = :agentId', { agentId: options.agentId });
    }

    if (options?.campaignId) {
      query.andWhere('evaluation.campaignId = :campaignId', { campaignId: options.campaignId });
    }

    if (options?.evaluatorId) {
      query.andWhere('evaluation.evaluatorId = :evaluatorId', { evaluatorId: options.evaluatorId });
    }

    if (options?.startDate && options?.endDate) {
      query.andWhere('evaluation.createdAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    }

    if (options?.passed !== undefined) {
      query.andWhere('evaluation.passed = :passed', { passed: options.passed });
    }

    return query.getMany();
  }

  async findEvaluationById(id: string): Promise<QaEvaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id },
      relations: ['scorecard', 'evaluator'],
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    return evaluation;
  }

  async findEvaluationsByCallId(callId: string): Promise<QaEvaluation[]> {
    return this.evaluationRepository.find({
      where: { callId },
      relations: ['scorecard', 'evaluator'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateEvaluation(id: string, dto: UpdateEvaluationDto): Promise<QaEvaluation> {
    const evaluation = await this.findEvaluationById(id);

    if (dto.scores) {
      const { rawScore, maxPossibleScore, totalScore, passed } = this.calculateScores(
        dto.scores,
        evaluation.scorecard,
      );
      evaluation.scores = dto.scores;
      evaluation.rawScore = rawScore;
      evaluation.maxPossibleScore = maxPossibleScore;
      evaluation.totalScore = totalScore;
      evaluation.passed = passed;
    }

    if (dto.evaluatorComments !== undefined) {
      evaluation.evaluatorComments = dto.evaluatorComments;
    }

    if (dto.status) {
      evaluation.status = dto.status;
    }

    return this.evaluationRepository.save(evaluation);
  }

  async acknowledgeEvaluation(id: string, agentFeedback?: string): Promise<QaEvaluation> {
    const evaluation = await this.findEvaluationById(id);

    evaluation.status = 'acknowledged';
    evaluation.acknowledgedAt = new Date();
    if (agentFeedback) {
      evaluation.agentFeedback = agentFeedback;
    }

    return this.evaluationRepository.save(evaluation);
  }

  async disputeEvaluation(id: string, feedback: string): Promise<QaEvaluation> {
    const evaluation = await this.findEvaluationById(id);

    evaluation.status = 'disputed';
    evaluation.agentFeedback = feedback;

    return this.evaluationRepository.save(evaluation);
  }

  async deleteEvaluation(id: string): Promise<void> {
    const evaluation = await this.findEvaluationById(id);
    await this.evaluationRepository.remove(evaluation);
  }

  // ==================== Statistics Methods ====================

  async getQaStats(options?: {
    campaignId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<QaStats> {
    const query = this.evaluationRepository.createQueryBuilder('evaluation');

    if (options?.campaignId) {
      query.andWhere('evaluation.campaignId = :campaignId', { campaignId: options.campaignId });
    }

    if (options?.startDate && options?.endDate) {
      query.andWhere('evaluation.createdAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    }

    const evaluations = await query.getMany();

    const totalEvaluations = evaluations.length;
    const averageScore = totalEvaluations > 0
      ? evaluations.reduce((sum, e) => sum + e.totalScore, 0) / totalEvaluations
      : 0;
    const passedCount = evaluations.filter(e => e.passed).length;
    const passRate = totalEvaluations > 0 ? (passedCount / totalEvaluations) * 100 : 0;

    const evaluationsByStatus = evaluations.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvaluations,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      evaluationsByStatus,
    };
  }

  async getAgentQaStats(agentId: string, limit = 10): Promise<AgentQaStats> {
    const evaluations = await this.evaluationRepository.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const totalEvaluations = evaluations.length;
    const averageScore = totalEvaluations > 0
      ? evaluations.reduce((sum, e) => sum + e.totalScore, 0) / totalEvaluations
      : 0;
    const passedCount = evaluations.filter(e => e.passed).length;
    const passRate = totalEvaluations > 0 ? (passedCount / totalEvaluations) * 100 : 0;

    const recentScores = evaluations.map(e => e.totalScore);

    // Determine trend based on recent scores
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentScores.length >= 3) {
      const recentAvg = (recentScores[0] + recentScores[1]) / 2;
      const olderAvg = (recentScores[recentScores.length - 2] + recentScores[recentScores.length - 1]) / 2;
      if (recentAvg > olderAvg + 5) {
        trend = 'improving';
      } else if (recentAvg < olderAvg - 5) {
        trend = 'declining';
      }
    }

    return {
      agentId,
      totalEvaluations,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      trend,
      recentScores,
    };
  }

  // ==================== Seeding Default Scorecard ====================

  async seedDefaultScorecard(): Promise<void> {
    const existing = await this.scorecardRepository.count();
    if (existing > 0) {
      return;
    }

    const defaultCategories: ScorecardCategory[] = [
      {
        id: 'greeting',
        name: 'Opening & Greeting',
        weight: 15,
        criteria: [
          { id: 'greeting-1', question: 'Agent greeted the customer professionally', type: 'yes_no', points: 5, required: true },
          { id: 'greeting-2', question: 'Agent verified customer identity/account', type: 'yes_no', points: 5, required: true },
          { id: 'greeting-3', question: 'Agent stated purpose of call clearly', type: 'yes_no', points: 5, required: true },
        ],
      },
      {
        id: 'communication',
        name: 'Communication Skills',
        weight: 25,
        criteria: [
          { id: 'comm-1', question: 'Agent spoke clearly and at appropriate pace', type: 'scale_1_5', points: 5, required: true },
          { id: 'comm-2', question: 'Agent used professional language', type: 'scale_1_5', points: 5, required: true },
          { id: 'comm-3', question: 'Agent showed active listening skills', type: 'scale_1_5', points: 5, required: true },
          { id: 'comm-4', question: 'Agent handled objections appropriately', type: 'scale_1_5', points: 5, required: false },
        ],
      },
      {
        id: 'product',
        name: 'Product Knowledge',
        weight: 25,
        criteria: [
          { id: 'prod-1', question: 'Agent demonstrated product knowledge', type: 'scale_1_5', points: 5, required: true },
          { id: 'prod-2', question: 'Agent provided accurate information', type: 'yes_no', points: 10, required: true },
          { id: 'prod-3', question: 'Agent addressed customer questions effectively', type: 'scale_1_5', points: 5, required: true },
        ],
      },
      {
        id: 'compliance',
        name: 'Compliance & Script Adherence',
        weight: 20,
        criteria: [
          { id: 'comp-1', question: 'Agent followed required disclosures', type: 'yes_no', points: 10, required: true },
          { id: 'comp-2', question: 'Agent followed company script guidelines', type: 'scale_1_5', points: 5, required: true },
          { id: 'comp-3', question: 'Agent requested consent where required', type: 'yes_no', points: 5, required: true },
        ],
      },
      {
        id: 'closing',
        name: 'Closing & Wrap-up',
        weight: 15,
        criteria: [
          { id: 'close-1', question: 'Agent summarized key points', type: 'yes_no', points: 5, required: false },
          { id: 'close-2', question: 'Agent set clear next steps/callback', type: 'yes_no', points: 5, required: false },
          { id: 'close-3', question: 'Agent closed the call professionally', type: 'yes_no', points: 5, required: true },
        ],
      },
    ];

    const scorecard = this.scorecardRepository.create({
      name: 'Standard Outbound Sales Scorecard',
      description: 'Default scorecard for evaluating outbound sales calls',
      categories: defaultCategories,
      maxScore: 100,
      passingScore: 70,
      isActive: true,
      isDefault: true,
    });

    await this.scorecardRepository.save(scorecard);
    this.logger.log('Seeded default QA scorecard');
  }
}
