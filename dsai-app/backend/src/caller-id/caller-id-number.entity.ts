import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CallerIdPool } from './caller-id-pool.entity';
import { CallerIdUsageLog } from './caller-id-usage-log.entity';
import { CallerIdReputationEvent } from './caller-id-reputation-event.entity';

export type CallerIdStatus = 'active' | 'cooling_down' | 'flagged' | 'blocked' | 'inactive';
export type ReputationLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

@Entity()
export class CallerIdNumber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phoneNumber: string;

  @Index()
  @Column({ length: 3 })
  areaCode: string;

  @Column({ nullable: true })
  state?: string | null;

  @Column({ nullable: true })
  city?: string | null;

  @ManyToOne(() => CallerIdPool, (pool) => pool.numbers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poolId' })
  pool: CallerIdPool;

  @Index()
  @Column()
  poolId: string;

  @Column({ type: 'text', default: 'active' })
  status: CallerIdStatus;

  @Column({ type: 'text', default: 'good' })
  reputationLevel: ReputationLevel;

  @Column({ type: 'integer', default: 100 })
  reputationScore: number;

  @Column({ type: 'integer', default: 0 })
  callsToday: number;

  @Column({ type: 'integer', default: 0 })
  totalCalls: number;

  @Column({ type: 'integer', default: 0 })
  answeredCalls: number;

  @Column({ type: 'integer', default: 0 })
  flaggedCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  cooldownUntil?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastFlaggedAt?: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @OneToMany(() => CallerIdUsageLog, (log) => log.callerIdNumber)
  usageLogs?: CallerIdUsageLog[];

  @OneToMany(() => CallerIdReputationEvent, (event) => event.callerIdNumber)
  reputationEvents?: CallerIdReputationEvent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
