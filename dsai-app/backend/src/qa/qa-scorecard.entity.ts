import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QaEvaluation } from './qa-evaluation.entity';

export interface ScorecardCriterion {
  id: string;
  question: string;
  type: 'yes_no' | 'scale_1_5' | 'scale_1_10';
  points: number;
  required: boolean;
}

export interface ScorecardCategory {
  id: string;
  name: string;
  weight: number; // Percentage weight (all categories should sum to 100)
  criteria: ScorecardCriterion[];
}

@Entity()
export class QaScorecard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'simple-json' })
  categories: ScorecardCategory[];

  @Column({ type: 'integer', default: 100 })
  maxScore: number;

  @Column({ type: 'integer', default: 70 })
  passingScore: number; // Minimum score to pass QA

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @OneToMany(() => QaEvaluation, (evaluation) => evaluation.scorecard)
  evaluations: QaEvaluation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
