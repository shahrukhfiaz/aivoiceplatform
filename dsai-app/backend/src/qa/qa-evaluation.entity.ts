import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QaScorecard } from './qa-scorecard.entity';
import { User } from '../users/user.entity';

export interface CriterionScore {
  criterionId: string;
  categoryId: string;
  score: number; // Actual score given
  maxScore: number; // Maximum possible for this criterion
  notes?: string;
}

export type EvaluationStatus = 'draft' | 'completed' | 'disputed' | 'acknowledged';

@Entity()
export class QaEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  callId: string; // Reference to Call entity

  @ManyToOne(() => QaScorecard, (scorecard) => scorecard.evaluations, { eager: true })
  @JoinColumn({ name: 'scorecardId' })
  scorecard: QaScorecard;

  @Column()
  scorecardId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'evaluatorId' })
  evaluator: User;

  @Column()
  evaluatorId: string;

  @Column({ nullable: true })
  agentId?: string; // The agent being evaluated (from the call)

  @Column({ nullable: true })
  campaignId?: string; // Campaign reference for filtering

  @Column({ type: 'simple-json' })
  scores: CriterionScore[];

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  totalScore: number; // Calculated percentage score

  @Column({ type: 'integer' })
  rawScore: number; // Sum of all criterion scores

  @Column({ type: 'integer' })
  maxPossibleScore: number; // Sum of all max scores

  @Column({ type: 'boolean' })
  passed: boolean; // Did the agent pass based on passingScore

  @Column({ type: 'text', default: 'completed' })
  status: EvaluationStatus;

  @Column({ type: 'text', nullable: true })
  evaluatorComments?: string | null;

  @Column({ type: 'text', nullable: true })
  agentFeedback?: string | null; // Agent can respond to evaluation

  @Column({ type: 'datetime', nullable: true })
  acknowledgedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
