import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AiFeatureType =
  | 'speech_analytics'
  | 'lead_scoring'
  | 'coaching'
  | 'sentiment';

export type AiProvider = 'openai' | 'gemini' | 'claude';

@Entity('ai_usage_logs')
@Index(['featureType', 'createdAt'])
@Index(['provider', 'createdAt'])
@Index(['campaignId', 'createdAt'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  featureType: AiFeatureType;

  @Column({ type: 'text' })
  provider: AiProvider;

  @Column({ type: 'text' })
  model: string;

  @Column({ nullable: true })
  callId?: string;

  @Column({ nullable: true })
  leadId?: string;

  @Column({ nullable: true })
  agentId?: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({ type: 'integer', default: 0 })
  inputTokens: number;

  @Column({ type: 'integer', default: 0 })
  outputTokens: number;

  @Column({ type: 'real', default: 0 })
  cost: number;

  @Column({ type: 'integer', default: 0 })
  latencyMs: number;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  requestId?: string;

  @CreateDateColumn()
  createdAt: Date;
}
