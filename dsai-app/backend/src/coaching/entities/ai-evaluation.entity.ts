import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EvaluationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CategoryScore {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  reasoning: string;
  criteria?: Array<{
    question: string;
    score: number;
    notes?: string;
  }>;
}

export interface SpecificFeedback {
  timestamp?: string;
  utterance: string;
  feedback: string;
  severity: 'info' | 'warning' | 'critical';
  category?: string;
}

@Entity('ai_evaluations')
@Index(['callId'], { unique: true })
@Index(['agentId', 'createdAt'])
@Index(['campaignId', 'createdAt'])
@Index(['status'])
export class AiEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  callId: string;

  @Column({ nullable: true })
  agentId?: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  scorecardId?: string; // Reference to QA scorecard used

  // ==================== Scores ====================

  @Column({ type: 'simple-json', nullable: true })
  categoryScores?: CategoryScore[];

  @Column({ type: 'integer', nullable: true })
  totalScore?: number; // 0-100

  @Column({ type: 'boolean', nullable: true })
  passed?: boolean; // Met minimum threshold

  // ==================== Analysis ====================

  @Column({ type: 'text', nullable: true })
  overallSummary?: string;

  @Column({ type: 'simple-json', nullable: true })
  strengths?: string[];

  @Column({ type: 'simple-json', nullable: true })
  areasForImprovement?: string[];

  @Column({ type: 'simple-json', nullable: true })
  specificFeedback?: SpecificFeedback[];

  // ==================== Processing Info ====================

  @Column({ type: 'text', nullable: true })
  llmProvider?: string;

  @Column({ type: 'text', nullable: true })
  llmModel?: string;

  @Column({ type: 'integer', default: 0 })
  inputTokens: number;

  @Column({ type: 'integer', default: 0 })
  outputTokens: number;

  @Column({ type: 'real', default: 0 })
  processingCost: number;

  @Column({ type: 'integer', default: 0 })
  processingTimeMs: number;

  @Column({ type: 'text', default: 'pending' })
  status: EvaluationStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
