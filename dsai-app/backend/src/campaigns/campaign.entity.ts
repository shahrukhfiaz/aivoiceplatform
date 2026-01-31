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

export interface CampaignSchedule {
  days: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string; // e.g., 'America/New_York'
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
