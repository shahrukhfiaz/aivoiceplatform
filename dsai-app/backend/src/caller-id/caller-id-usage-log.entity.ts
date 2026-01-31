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

export type CallResult = 'answered' | 'no_answer' | 'busy' | 'failed' | 'voicemail';

@Entity()
export class CallerIdUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CallerIdNumber, (number) => number.usageLogs, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'callerIdNumberId' })
  callerIdNumber?: CallerIdNumber | null;

  @Index()
  @Column({ nullable: true })
  callerIdNumberId?: string | null;

  @Column()
  callerIdPhoneNumber: string;

  @Index()
  @Column({ nullable: true })
  campaignId?: string | null;

  @Index()
  @Column({ nullable: true })
  leadId?: string | null;

  @Column()
  destinationNumber: string;

  @Column({ length: 3, nullable: true })
  destinationAreaCode?: string | null;

  @Column({ type: 'boolean', default: false })
  wasAnswered: boolean;

  @Column({ type: 'integer', nullable: true })
  callDuration?: number | null;

  @Column({ type: 'text', nullable: true })
  callResult?: CallResult | null;

  @Column({ type: 'text', nullable: true })
  callUuid?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
