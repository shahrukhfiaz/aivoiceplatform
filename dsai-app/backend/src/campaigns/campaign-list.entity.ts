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
import { Campaign } from './campaign.entity';
import { Lead } from '../leads/lead.entity';

export type ListStatus = 'active' | 'inactive' | 'completed';

@Entity()
export class CampaignList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Campaign, (campaign) => campaign.lists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column()
  campaignId: string;

  @Column({ type: 'text', default: 'active' })
  status: ListStatus;

  @Column({ type: 'integer', default: 0 })
  totalLeads: number;

  @Column({ type: 'integer', default: 0 })
  contactedLeads: number;

  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @OneToMany(() => Lead, (lead) => lead.list)
  leads?: Lead[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
