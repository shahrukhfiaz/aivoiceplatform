import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  CallSentiment,
  SentimentLabel,
  Emotion,
} from './call-sentiment.entity';

@Entity('utterance_sentiments')
@Index(['callSentimentId'])
@Index(['speaker'])
@Index(['sentimentLabel'])
export class UtteranceSentiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  callSentimentId: string;

  @ManyToOne(() => CallSentiment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callSentimentId' })
  callSentiment: CallSentiment;

  @Column({ type: 'integer', nullable: true })
  timestampMs?: number;

  @Column({ type: 'integer', nullable: true })
  sequenceNumber?: number; // Order in conversation

  @Column({ type: 'text' })
  speaker: 'agent' | 'customer';

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'real' })
  sentiment: number; // -1 to 1

  @Column({ type: 'text' })
  sentimentLabel: SentimentLabel;

  @Column({ type: 'text', nullable: true })
  emotion?: Emotion;

  @Column({ type: 'real', nullable: true })
  emotionIntensity?: number; // 0-1

  @Column({ type: 'simple-json', nullable: true })
  keywords?: string[]; // Sentiment-bearing keywords detected

  @CreateDateColumn()
  createdAt: Date;
}
