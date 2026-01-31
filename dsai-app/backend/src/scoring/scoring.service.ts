import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThan } from 'typeorm';
import {
  LeadScore,
  ScoreFeatures,
  BestTimeSlot,
} from './entities/lead-score.entity';
import {
  ScoringModel,
  DEFAULT_FEATURE_WEIGHTS,
  DEFAULT_DISPOSITION_SCORES,
  DEFAULT_TIME_SLOT_MULTIPLIERS,
  DEFAULT_DAY_OF_WEEK_MULTIPLIERS,
} from './entities/scoring-model.entity';

export interface LeadData {
  id: string;
  phoneNumber: string;
  timezone?: string;
  state?: string;
  dialAttempts?: number;
  lastDialedAt?: Date;
  dispositions?: Array<{
    code: string;
    createdAt: Date;
    callDuration?: number;
  }>;
  campaignId?: string;
  organizationId?: string;
}

export interface ScoreResult {
  leadId: string;
  overallScore: number;
  contactProbability: number;
  conversionProbability?: number;
  bestTimeSlots: BestTimeSlot[];
  features: ScoreFeatures;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    @InjectRepository(LeadScore)
    private readonly scoreRepo: Repository<LeadScore>,
    @InjectRepository(ScoringModel)
    private readonly modelRepo: Repository<ScoringModel>,
  ) {}

  // ==================== Scoring ====================

  /**
   * Score a single lead
   */
  async scoreLead(lead: LeadData): Promise<LeadScore> {
    const model = await this.getActiveModel(lead.organizationId);
    const result = this.calculateScore(lead, model);

    // Save or update score
    let score = await this.scoreRepo.findOne({ where: { leadId: lead.id } });

    if (score) {
      Object.assign(score, {
        ...result,
        modelVersion: model.version,
        scoredAt: new Date(),
        expiresAt: this.getExpirationDate(),
      });
    } else {
      score = this.scoreRepo.create({
        leadId: lead.id,
        campaignId: lead.campaignId,
        organizationId: lead.organizationId,
        ...result,
        modelVersion: model.version,
        scoredAt: new Date(),
        expiresAt: this.getExpirationDate(),
      });
    }

    // Update model stats
    await this.modelRepo.update(model.id, {
      leadsScored: () => 'leadsScored + 1',
    });

    return this.scoreRepo.save(score);
  }

  /**
   * Score multiple leads in batch
   */
  async scoreLeadsBatch(leads: LeadData[]): Promise<LeadScore[]> {
    if (leads.length === 0) return [];

    const organizationId = leads[0].organizationId;
    const model = await this.getActiveModel(organizationId);

    const scores: LeadScore[] = [];

    for (const lead of leads) {
      const result = this.calculateScore(lead, model);

      let score = await this.scoreRepo.findOne({ where: { leadId: lead.id } });

      if (score) {
        Object.assign(score, {
          ...result,
          modelVersion: model.version,
          scoredAt: new Date(),
          expiresAt: this.getExpirationDate(),
        });
      } else {
        score = this.scoreRepo.create({
          leadId: lead.id,
          campaignId: lead.campaignId,
          organizationId: lead.organizationId,
          ...result,
          modelVersion: model.version,
          scoredAt: new Date(),
          expiresAt: this.getExpirationDate(),
        });
      }

      scores.push(score);
    }

    // Bulk save
    const savedScores = await this.scoreRepo.save(scores);

    // Update model stats
    await this.modelRepo.update(model.id, {
      leadsScored: () => `leadsScored + ${leads.length}`,
    });

    return savedScores;
  }

  /**
   * Calculate score for a lead using the model
   */
  private calculateScore(lead: LeadData, model: ScoringModel): ScoreResult {
    const weights = model.featureWeights;
    const dispositionScores = model.dispositionScores;
    const timeMultipliers = model.timeSlotMultipliers;
    const dayMultipliers = model.dayOfWeekMultipliers;

    // Extract features
    const features = this.extractFeatures(lead);

    let score = 50; // Base score

    // Apply dial attempts penalty
    score += features.dialAttempts * weights.dialAttempts;

    // Apply recency boost/penalty
    const recencyScore = Math.max(0, 30 - features.recencyDays) / 30; // 0-1
    score += recencyScore * weights.recencyDays * 10;

    // Apply disposition history
    let dispositionScore = 0;
    const totalOutcomes = Object.values(features.previousOutcomes).reduce(
      (a, b) => a + b,
      0,
    );

    for (const [code, count] of Object.entries(features.previousOutcomes)) {
      const dispScore = dispositionScores[code] || 0;
      dispositionScore += dispScore * count;
    }

    if (totalOutcomes > 0) {
      score += (dispositionScore / totalOutcomes) * (weights.previousOutcomes / 10);
    }

    // Apply timezone/time-of-day optimization
    const now = new Date();
    const leadHour = this.getLocalHour(now, features.timezone);
    const timeMultiplier = parseFloat(String(timeMultipliers[leadHour.toString()] ?? 1));
    const dayMultiplier = parseFloat(String(dayMultipliers[now.getDay().toString()] ?? 1));

    score *= timeMultiplier;
    score *= dayMultiplier;

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Calculate contact probability (0-1)
    const contactProbability = Math.min(
      1,
      Math.max(0, (score / 100) * timeMultiplier * dayMultiplier),
    );

    // Calculate conversion probability based on positive outcome history
    const positiveOutcomes = features.positiveOutcomes || 0;
    const negativeOutcomes = features.negativeOutcomes || 0;
    const totalOuts = positiveOutcomes + negativeOutcomes;
    const conversionProbability =
      totalOuts > 0 ? positiveOutcomes / totalOuts : 0.5;

    // Calculate best time slots
    const bestTimeSlots = this.calculateBestTimeSlots(
      timeMultipliers,
      dayMultipliers,
    );

    return {
      leadId: lead.id,
      overallScore: score,
      contactProbability,
      conversionProbability,
      bestTimeSlots,
      features,
    };
  }

  /**
   * Extract features from lead data
   */
  private extractFeatures(lead: LeadData): ScoreFeatures {
    const now = new Date();
    const dispositions = lead.dispositions || [];

    // Calculate recency
    let recencyDays = 0;
    if (lead.lastDialedAt) {
      recencyDays = Math.floor(
        (now.getTime() - new Date(lead.lastDialedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }

    // Count disposition outcomes
    const previousOutcomes: Record<string, number> = {};
    let positiveOutcomes = 0;
    let negativeOutcomes = 0;
    let totalCallDuration = 0;

    const positiveDispositions = ['SALE', 'APPOINTMENT', 'INTERESTED', 'CALLBACK'];
    const negativeDispositions = [
      'NOT_INTERESTED',
      'DO_NOT_CALL',
      'WRONG_NUMBER',
      'DISCONNECTED',
    ];

    for (const disp of dispositions) {
      previousOutcomes[disp.code] = (previousOutcomes[disp.code] || 0) + 1;

      if (positiveDispositions.includes(disp.code)) {
        positiveOutcomes++;
      } else if (negativeDispositions.includes(disp.code)) {
        negativeOutcomes++;
      }

      if (disp.callDuration) {
        totalCallDuration += disp.callDuration;
      }
    }

    return {
      dialAttempts: lead.dialAttempts || 0,
      recencyDays,
      previousOutcomes,
      lastCallDuration:
        dispositions.length > 0 ? totalCallDuration / dispositions.length : 0,
      timezone: lead.timezone || this.inferTimezone(lead.state),
      daysSinceLastContact: recencyDays,
      totalContacts: dispositions.length,
      positiveOutcomes,
      negativeOutcomes,
    };
  }

  /**
   * Calculate best time slots for contact
   */
  private calculateBestTimeSlots(
    timeMultipliers: Record<string, number>,
    dayMultipliers: Record<string, number>,
  ): BestTimeSlot[] {
    const slots: BestTimeSlot[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 8; hour <= 20; hour++) {
        // Business hours only
        const timeM = parseFloat(String(timeMultipliers[hour.toString()] ?? 1));
        const dayM = parseFloat(String(dayMultipliers[day.toString()] ?? 1));
        const probability = Math.min(1, (timeM * dayM) / 1.5);

        if (probability >= 0.7) {
          // Only include good slots
          slots.push({
            dayOfWeek: day,
            hour,
            probability: Math.round(probability * 100) / 100,
          });
        }
      }
    }

    // Sort by probability descending
    return slots.sort((a, b) => b.probability - a.probability).slice(0, 10);
  }

  /**
   * Infer timezone from state
   */
  private inferTimezone(state?: string): string {
    if (!state) return 'America/New_York';

    const stateTimezones: Record<string, string> = {
      CA: 'America/Los_Angeles',
      WA: 'America/Los_Angeles',
      OR: 'America/Los_Angeles',
      NV: 'America/Los_Angeles',
      AZ: 'America/Phoenix',
      MT: 'America/Denver',
      ID: 'America/Denver',
      WY: 'America/Denver',
      UT: 'America/Denver',
      CO: 'America/Denver',
      NM: 'America/Denver',
      TX: 'America/Chicago',
      OK: 'America/Chicago',
      KS: 'America/Chicago',
      NE: 'America/Chicago',
      SD: 'America/Chicago',
      ND: 'America/Chicago',
      MN: 'America/Chicago',
      WI: 'America/Chicago',
      IL: 'America/Chicago',
      IA: 'America/Chicago',
      MO: 'America/Chicago',
      AR: 'America/Chicago',
      LA: 'America/Chicago',
      MS: 'America/Chicago',
      AL: 'America/Chicago',
      TN: 'America/Chicago',
      // Eastern states
      NY: 'America/New_York',
      PA: 'America/New_York',
      NJ: 'America/New_York',
      MA: 'America/New_York',
      CT: 'America/New_York',
      RI: 'America/New_York',
      VT: 'America/New_York',
      NH: 'America/New_York',
      ME: 'America/New_York',
      FL: 'America/New_York',
      GA: 'America/New_York',
      SC: 'America/New_York',
      NC: 'America/New_York',
      VA: 'America/New_York',
      WV: 'America/New_York',
      MD: 'America/New_York',
      DE: 'America/New_York',
      DC: 'America/New_York',
      OH: 'America/New_York',
      MI: 'America/New_York',
      IN: 'America/New_York',
      KY: 'America/New_York',
      HI: 'Pacific/Honolulu',
      AK: 'America/Anchorage',
    };

    return stateTimezones[state.toUpperCase()] || 'America/New_York';
  }

  /**
   * Get local hour in a timezone
   */
  private getLocalHour(date: Date, timezone: string): number {
    try {
      const localTime = date.toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(localTime);
    } catch {
      return date.getHours();
    }
  }

  /**
   * Get score expiration date (24 hours)
   */
  private getExpirationDate(): Date {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry;
  }

  // ==================== Priority Queue ====================

  /**
   * Get priority queue of leads for dialing
   */
  async getPriorityQueue(params: {
    campaignId: string;
    leadIds?: string[];
    limit?: number;
    minScore?: number;
  }): Promise<LeadScore[]> {
    const { campaignId, leadIds, limit = 100, minScore = 0 } = params;

    const qb = this.scoreRepo
      .createQueryBuilder('s')
      .where('s.campaignId = :campaignId', { campaignId })
      .andWhere('s.overallScore >= :minScore', { minScore })
      .andWhere('(s.expiresAt IS NULL OR s.expiresAt > :now)', { now: new Date() })
      .orderBy('s.overallScore', 'DESC')
      .take(limit);

    if (leadIds && leadIds.length > 0) {
      qb.andWhere('s.leadId IN (:...leadIds)', { leadIds });
    }

    return qb.getMany();
  }

  /**
   * Get best time to call a lead
   */
  async getBestTimeToCall(leadId: string): Promise<{
    bestSlots: BestTimeSlot[];
    currentIsGood: boolean;
    nextGoodTime?: Date;
  }> {
    const score = await this.scoreRepo.findOne({ where: { leadId } });

    if (!score || !score.bestTimeSlots) {
      return {
        bestSlots: [],
        currentIsGood: true, // No data, assume ok
      };
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    // Check if current time is good
    const currentSlot = score.bestTimeSlots.find(
      (s) => s.dayOfWeek === currentDay && s.hour === currentHour,
    );
    const currentIsGood = currentSlot ? currentSlot.probability >= 0.7 : false;

    // Find next good time if current is not good
    let nextGoodTime: Date | undefined;

    if (!currentIsGood && score.bestTimeSlots.length > 0) {
      // Find the next upcoming good slot
      const sortedSlots = [...score.bestTimeSlots].sort((a, b) => {
        const aDays = (a.dayOfWeek - currentDay + 7) % 7;
        const bDays = (b.dayOfWeek - currentDay + 7) % 7;
        if (aDays !== bDays) return aDays - bDays;
        return a.hour - currentHour;
      });

      const nextSlot = sortedSlots.find(
        (s) =>
          s.dayOfWeek > currentDay ||
          (s.dayOfWeek === currentDay && s.hour > currentHour),
      );

      if (nextSlot) {
        nextGoodTime = new Date();
        nextGoodTime.setDate(
          nextGoodTime.getDate() +
            ((nextSlot.dayOfWeek - currentDay + 7) % 7),
        );
        nextGoodTime.setHours(nextSlot.hour, 0, 0, 0);
      }
    }

    return {
      bestSlots: score.bestTimeSlots,
      currentIsGood,
      nextGoodTime,
    };
  }

  // ==================== Retrieval ====================

  /**
   * Get score for a lead
   */
  async getLeadScore(leadId: string): Promise<LeadScore | null> {
    return this.scoreRepo.findOne({ where: { leadId } });
  }

  /**
   * Get scores for multiple leads
   */
  async getLeadScores(leadIds: string[]): Promise<LeadScore[]> {
    if (leadIds.length === 0) return [];
    return this.scoreRepo.find({ where: { leadId: In(leadIds) } });
  }

  /**
   * List scores with filters
   */
  async findAll(params: {
    campaignId?: string;
    organizationId?: string;
    minScore?: number;
    maxScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ data: LeadScore[]; total: number }> {
    const {
      campaignId,
      organizationId,
      minScore,
      maxScore,
      limit = 50,
      offset = 0,
    } = params;

    const qb = this.scoreRepo.createQueryBuilder('s');

    if (campaignId) qb.andWhere('s.campaignId = :campaignId', { campaignId });
    if (organizationId)
      qb.andWhere('s.organizationId = :organizationId', { organizationId });
    if (minScore !== undefined)
      qb.andWhere('s.overallScore >= :minScore', { minScore });
    if (maxScore !== undefined)
      qb.andWhere('s.overallScore <= :maxScore', { maxScore });

    qb.orderBy('s.overallScore', 'DESC').take(limit).skip(offset);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  // ==================== Models ====================

  /**
   * Get active scoring model
   */
  async getActiveModel(organizationId?: string): Promise<ScoringModel> {
    // Try to find organization-specific model
    if (organizationId) {
      const orgModel = await this.modelRepo.findOne({
        where: { organizationId, isActive: true },
      });
      if (orgModel) return orgModel;
    }

    // Fall back to default model
    let defaultModel = await this.modelRepo.findOne({
      where: { isDefault: true, isActive: true },
    });

    if (!defaultModel) {
      // Create default model if none exists
      defaultModel = await this.createDefaultModel();
    }

    return defaultModel;
  }

  /**
   * Create default scoring model
   */
  async createDefaultModel(): Promise<ScoringModel> {
    const model = this.modelRepo.create({
      name: 'Default Scoring Model',
      version: '1.0.0',
      description: 'Default lead scoring model with standard weights',
      featureWeights: DEFAULT_FEATURE_WEIGHTS,
      dispositionScores: DEFAULT_DISPOSITION_SCORES,
      timeSlotMultipliers: DEFAULT_TIME_SLOT_MULTIPLIERS,
      dayOfWeekMultipliers: DEFAULT_DAY_OF_WEEK_MULTIPLIERS,
      isActive: true,
      isDefault: true,
    });

    return this.modelRepo.save(model);
  }

  /**
   * Create a new scoring model
   */
  async createModel(params: Partial<ScoringModel>): Promise<ScoringModel> {
    const model = this.modelRepo.create({
      ...params,
      featureWeights: params.featureWeights || DEFAULT_FEATURE_WEIGHTS,
      dispositionScores: params.dispositionScores || DEFAULT_DISPOSITION_SCORES,
      timeSlotMultipliers:
        params.timeSlotMultipliers || DEFAULT_TIME_SLOT_MULTIPLIERS,
      dayOfWeekMultipliers:
        params.dayOfWeekMultipliers || DEFAULT_DAY_OF_WEEK_MULTIPLIERS,
    });

    return this.modelRepo.save(model);
  }

  /**
   * Get all scoring models
   */
  async getModels(organizationId?: string): Promise<ScoringModel[]> {
    const where: Record<string, unknown> = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.modelRepo.find({
      where,
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Activate a scoring model
   */
  async activateModel(id: string): Promise<ScoringModel> {
    const model = await this.modelRepo.findOne({ where: { id } });
    if (!model) throw new NotFoundException('Model not found');

    // Deactivate other models for same organization
    if (model.organizationId) {
      await this.modelRepo.update(
        { organizationId: model.organizationId, isActive: true },
        { isActive: false },
      );
    } else {
      // Deactivate default models
      await this.modelRepo.update({ isDefault: true, isActive: true }, { isActive: false });
    }

    model.isActive = true;
    return this.modelRepo.save(model);
  }
}
