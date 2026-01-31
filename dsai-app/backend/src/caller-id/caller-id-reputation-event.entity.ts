import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CallerIdNumber } from './caller-id-number.entity';

export type ReputationEventType =
  | 'spam_report'
  | 'carrier_block'
  | 'low_answer_rate'
  | 'manual_flag'
  | 'recovery'
  | 'verification_passed'
  | 'verification_failed'
  | 'call_answered'
  | 'daily_reset';

@Entity()
export class CallerIdReputationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CallerIdNumber, (number) => number.reputationEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callerIdNumberId' })
  callerIdNumber: CallerIdNumber;

  @Index()
  @Column()
  callerIdNumberId: string;

  @Column({ type: 'text' })
  eventType: ReputationEventType;

  @Column({ type: 'integer' })
  scoreChange: number;

  @Column({ type: 'integer' })
  previousScore: number;

  @Column({ type: 'integer' })
  newScore: number;

  @Column({ type: 'text', nullable: true })
  source?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
