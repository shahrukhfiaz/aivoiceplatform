import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CallAnalytics } from './call-analytics.entity';

export type KeywordCategory =
  | 'compliance'
  | 'objection'
  | 'positive'
  | 'negative'
  | 'competitor'
  | 'custom';

export type Speaker = 'agent' | 'customer';

@Entity('keyword_matches')
@Index(['callAnalyticsId'])
@Index(['keyword'])
@Index(['category'])
export class KeywordMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  callAnalyticsId: string;

  @ManyToOne(() => CallAnalytics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callAnalyticsId' })
  callAnalytics: CallAnalytics;

  @Column()
  keyword: string;

  @Column({ type: 'text' })
  category: KeywordCategory;

  @Column({ type: 'text' })
  speaker: Speaker;

  @Column({ type: 'text' })
  matchedText: string;

  @Column({ type: 'integer', nullable: true })
  timestampMs?: number;

  @Column({ type: 'real', default: 1.0 })
  confidence: number;

  @CreateDateColumn()
  createdAt: Date;
}

// Keyword configuration entity for storing monitored keywords
@Entity('keyword_configs')
@Index(['category'])
@Index(['organizationId'])
export class KeywordConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  keyword: string;

  @Column({ type: 'text' })
  category: KeywordCategory;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  campaignId?: string;

  @Column({ type: 'boolean', default: false })
  isCaseSensitive: boolean;

  @Column({ type: 'boolean', default: false })
  isRegex: boolean;

  @Column({ type: 'integer', default: 0 })
  alertThreshold: number; // Alert if matches exceed this per call

  @CreateDateColumn()
  createdAt: Date;
}
