import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AnalyticsStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ScriptMatch {
  element: string;
  matched: boolean;
  matchedText?: string;
  timestampMs?: number;
}

@Entity('call_analytics')
@Index(['callId'], { unique: true })
@Index(['campaignId', 'createdAt'])
@Index(['agentId', 'createdAt'])
@Index(['status'])
export class CallAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  callId: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column({ nullable: true })
  agentId?: string;

  @Column({ nullable: true })
  organizationId?: string;

  // ==================== Talk Metrics ====================

  @Column({ type: 'real', default: 0 })
  talkRatio: number; // Agent talk time / total talk time (0-1)

  @Column({ type: 'real', default: 0 })
  listenRatio: number; // Agent listen time / total talk time (0-1)

  @Column({ type: 'integer', default: 0 })
  agentTalkTimeSeconds: number;

  @Column({ type: 'integer', default: 0 })
  customerTalkTimeSeconds: number;

  @Column({ type: 'integer', default: 0 })
  totalCallDurationSeconds: number;

  // ==================== Silence Metrics ====================

  @Column({ type: 'integer', default: 0 })
  totalSilenceSeconds: number;

  @Column({ type: 'integer', default: 0 })
  silenceCount: number;

  @Column({ type: 'real', default: 0 })
  avgSilenceDuration: number;

  @Column({ type: 'integer', default: 0 })
  longestSilenceSeconds: number;

  // ==================== Pace Metrics ====================

  @Column({ type: 'integer', default: 0 })
  agentWordsPerMinute: number;

  @Column({ type: 'integer', default: 0 })
  customerWordsPerMinute: number;

  @Column({ type: 'integer', default: 0 })
  agentWordCount: number;

  @Column({ type: 'integer', default: 0 })
  customerWordCount: number;

  // ==================== Script Adherence ====================

  @Column({ type: 'integer', nullable: true })
  scriptAdherenceScore?: number; // 0-100

  @Column({ type: 'simple-json', nullable: true })
  scriptMatches?: ScriptMatch[];

  @Column({ type: 'simple-json', nullable: true })
  missedScriptElements?: string[];

  // ==================== Interruptions ====================

  @Column({ type: 'integer', default: 0 })
  agentInterruptions: number;

  @Column({ type: 'integer', default: 0 })
  customerInterruptions: number;

  // ==================== Processing Info ====================

  @Column({ type: 'text', default: 'pending' })
  status: AnalyticsStatus;

  @Column({ type: 'real', default: 0 })
  processingCost: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'datetime', nullable: true })
  analyzedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
