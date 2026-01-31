import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface BestTimeSlot {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hour: number; // 0-23
  probability: number; // 0-1
}

export interface ScoreFeatures {
  dialAttempts: number;
  recencyDays: number;
  previousOutcomes: Record<string, number>; // disposition code -> count
  lastCallDuration?: number;
  timezone: string;
  daysSinceLastContact?: number;
  totalContacts?: number;
  positiveOutcomes?: number;
  negativeOutcomes?: number;
}

@Entity('lead_scores')
@Index(['leadId'], { unique: true })
@Index(['campaignId', 'overallScore'])
@Index(['scoredAt'])
export class LeadScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  leadId: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column({ nullable: true })
  organizationId?: string;

  // ==================== Scores ====================

  @Column({ type: 'integer', default: 50 })
  overallScore: number; // 0-100

  @Column({ type: 'real', default: 0.5 })
  contactProbability: number; // 0-1, likelihood of reaching someone

  @Column({ type: 'real', nullable: true })
  conversionProbability?: number; // 0-1, likelihood of positive outcome

  // ==================== Best Time ====================

  @Column({ type: 'simple-json', nullable: true })
  bestTimeSlots?: BestTimeSlot[];

  @Column({ nullable: true })
  preferredTimezone?: string;

  // ==================== Features ====================

  @Column({ type: 'simple-json', nullable: true })
  features?: ScoreFeatures;

  // ==================== Model Info ====================

  @Column({ nullable: true })
  modelVersion?: string;

  @Column()
  scoredAt: Date;

  @Column({ nullable: true })
  expiresAt?: Date; // Score validity (default 24h)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
