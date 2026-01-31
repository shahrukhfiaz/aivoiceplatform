import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from '../agents/agent.entity';
import { Trunk } from '../trunks/trunk.entity';
import { CampaignList } from './campaign-list.entity';

export type CampaignStatus = 'active' | 'paused' | 'completed' | 'archived';
export type DialingMode = 'predictive' | 'progressive' | 'preview' | 'power';
export type AmdMode = 'fast' | 'balanced' | 'accurate';

export interface CampaignSchedule {
  days: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string; // e.g., 'America/New_York'
}

export interface CallingHours {
  timezone: string; // e.g., 'America/New_York'
  weekday: { start: string; end: string }; // e.g., "08:00", "21:00"
  saturday: { start: string; end: string } | null;
  sunday: { start: string; end: string } | null;
}

export interface AmdSettings {
  initialSilence: number; // ms, default 2500
  greeting: number; // ms, default 1500
  afterGreetingSilence: number; // ms, default 800
  totalAnalysisTime: number; // ms, default 5000
  minWordLength: number; // ms, default 100
  betweenWordsSilence: number; // ms, default 50
  maximumWordLength: number; // ms, default 5000
  silenceThreshold: number; // 0-32767, default 256
}

@Entity()
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', default: 'paused' })
  status: CampaignStatus;

  @Column({ type: 'text', default: 'predictive' })
  dialingMode: DialingMode;

  @ManyToOne(() => Agent, { nullable: true, eager: true })
  @JoinColumn({ name: 'aiAgentId' })
  aiAgent?: Agent | null;

  @Column({ nullable: true })
  aiAgentId?: string | null;

  @ManyToOne(() => Trunk, { nullable: true, eager: true })
  @JoinColumn({ name: 'outboundTrunkId' })
  outboundTrunk?: Trunk | null;

  @Column({ nullable: true })
  outboundTrunkId?: string | null;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 1.5 })
  callsPerAgent: number;

  @Column({ type: 'integer', default: 3 })
  maxAbandonRate: number;

  @Column({ type: 'integer', default: 30 })
  ringTimeout: number;

  @Column({ type: 'integer', default: 30 })
  wrapUpTime: number;

  @Column({ type: 'integer', default: 3 })
  maxAttemptsPerLead: number;

  @Column({ type: 'text', nullable: true })
  defaultCallerId?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  schedule?: CampaignSchedule | null;

  @Column({ type: 'text', nullable: true })
  script?: string | null;

  // Time-of-day calling hours (TCPA compliance)
  @Column({ type: 'simple-json', nullable: true })
  callingHours?: CallingHours | null;

  @Column({ type: 'boolean', default: true })
  respectStateRules: boolean;

  // AMD (Answering Machine Detection) settings
  @Column({ type: 'boolean', default: false })
  amdEnabled: boolean;

  @Column({ type: 'text', default: 'balanced' })
  amdMode: AmdMode;

  @Column({ type: 'simple-json', nullable: true })
  amdSettings?: AmdSettings | null;

  @Column({ type: 'boolean', default: true })
  voicemailDropEnabled: boolean;

  @Column({ nullable: true })
  voicemailDropRecordingId?: string | null;

  @OneToMany(() => CampaignList, (list) => list.campaign)
  lists?: CampaignList[];

  // Stats (computed, not persisted - could be separate view)
  totalLeads?: number;
  dialedLeads?: number;
  contactedLeads?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
