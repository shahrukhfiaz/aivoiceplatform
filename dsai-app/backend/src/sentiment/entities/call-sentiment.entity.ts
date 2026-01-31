import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SentimentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type SentimentLabel =
  | 'very_negative'
  | 'negative'
  | 'neutral'
  | 'positive'
  | 'very_positive';

export type Emotion =
  | 'angry'
  | 'frustrated'
  | 'confused'
  | 'neutral'
  | 'satisfied'
  | 'happy'
  | 'excited';

export interface EmotionDetection {
  emotion: Emotion;
  count: number;
  avgIntensity: number; // 0-1
}

export interface SentimentTrajectoryPoint {
  timestampPercent: number; // 0-100
  sentiment: number; // -1 to 1
  speaker: 'agent' | 'customer';
}

export interface SatisfactionIndicator {
  indicator: string;
  present: boolean;
  quote?: string;
}

@Entity('call_sentiments')
@Index(['callId'], { unique: true })
@Index(['campaignId', 'createdAt'])
@Index(['agentId', 'createdAt'])
@Index(['status'])
export class CallSentiment {
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

  // ==================== Overall Sentiment ====================

  @Column({ type: 'real', nullable: true })
  overallSentiment?: number; // -1 to 1

  @Column({ type: 'text', nullable: true })
  overallLabel?: SentimentLabel;

  // ==================== Customer Journey ====================

  @Column({ type: 'real', nullable: true })
  customerStartSentiment?: number; // Beginning of call

  @Column({ type: 'real', nullable: true })
  customerEndSentiment?: number; // End of call

  @Column({ type: 'real', nullable: true })
  customerSentimentDelta?: number; // Change during call

  // ==================== Emotions ====================

  @Column({ type: 'simple-json', nullable: true })
  emotionsDetected?: EmotionDetection[];

  @Column({ type: 'text', nullable: true })
  dominantEmotion?: Emotion;

  // ==================== Trajectory ====================

  @Column({ type: 'simple-json', nullable: true })
  sentimentTrajectory?: SentimentTrajectoryPoint[];

  // ==================== Satisfaction ====================

  @Column({ type: 'boolean', nullable: true })
  customerSatisfied?: boolean;

  @Column({ type: 'real', nullable: true })
  satisfactionConfidence?: number; // 0-1

  @Column({ type: 'simple-json', nullable: true })
  satisfactionIndicators?: SatisfactionIndicator[];

  // ==================== Processing Info ====================

  @Column({ type: 'text', nullable: true })
  llmProvider?: string;

  @Column({ type: 'real', default: 0 })
  processingCost: number;

  @Column({ type: 'text', default: 'pending' })
  status: SentimentStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Helper function to convert numeric sentiment to label
export function sentimentToLabel(sentiment: number): SentimentLabel {
  if (sentiment < -0.6) return 'very_negative';
  if (sentiment < -0.2) return 'negative';
  if (sentiment < 0.2) return 'neutral';
  if (sentiment < 0.6) return 'positive';
  return 'very_positive';
}
