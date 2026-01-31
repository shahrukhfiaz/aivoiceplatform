import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type InsightType =
  | 'strength'
  | 'weakness'
  | 'trend'
  | 'recommendation'
  | 'alert';

export interface SupportingData {
  callIds?: string[];
  avgScore?: number;
  trend?: 'improving' | 'declining' | 'stable';
  sampleCount?: number;
  percentOccurrence?: number;
  comparisonToTeam?: number; // Percentage above/below team average
}

@Entity('coaching_insights')
@Index(['agentId', 'createdAt'])
@Index(['campaignId', 'createdAt'])
@Index(['insightType'])
@Index(['isAcknowledged'])
export class CoachingInsight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  agentId: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column({ nullable: true })
  organizationId?: string;

  // ==================== Insight Details ====================

  @Column({ type: 'text' })
  insightType: InsightType;

  @Column()
  category: string; // e.g., "Opening", "Objection Handling", "Compliance"

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'integer', default: 5 })
  severity: number; // 0-10, higher = more important

  // ==================== Supporting Data ====================

  @Column({ type: 'simple-json', nullable: true })
  supportingData?: SupportingData;

  @Column({ type: 'simple-json', nullable: true })
  actionItems?: string[];

  // ==================== Manager Response ====================

  @Column({ type: 'boolean', default: false })
  isAcknowledged: boolean;

  @Column({ type: 'datetime', nullable: true })
  acknowledgedAt?: Date;

  @Column({ nullable: true })
  acknowledgedByUserId?: string;

  @Column({ type: 'text', nullable: true })
  managerNotes?: string;

  // ==================== Validity ====================

  @Column({ type: 'datetime', nullable: true })
  validUntil?: Date; // Insight expires after this date

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Training recommendation entity for specific coaching suggestions
@Entity('training_recommendations')
@Index(['agentId', 'createdAt'])
@Index(['status'])
export class TrainingRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  agentId: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  insightId?: string; // Link to originating insight

  // ==================== Recommendation Details ====================

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  category: string; // e.g., "Script Adherence", "Soft Skills", "Product Knowledge"

  @Column({ type: 'integer', default: 5 })
  priority: number; // 1-10

  @Column({ type: 'simple-json', nullable: true })
  resources?: Array<{
    type: 'video' | 'document' | 'exercise' | 'call_review';
    title: string;
    url?: string;
    callId?: string;
    duration?: string;
  }>;

  // ==================== Progress ====================

  @Column({ type: 'text', default: 'pending' })
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  completionNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
