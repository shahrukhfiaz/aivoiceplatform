import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CampaignList } from '../campaigns/campaign-list.entity';
import { Disposition } from '../dispositions/disposition.entity';

export type LeadStatus = 'new' | 'dialing' | 'contacted' | 'callback' | 'dnc' | 'completed';

@Entity()
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CampaignList, (list) => list.leads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: CampaignList;

  @Column()
  listId: string;

  @Index()
  @Column()
  phoneNumber: string;

  @Column({ nullable: true })
  altPhone1?: string | null;

  @Column({ nullable: true })
  altPhone2?: string | null;

  @Column({ nullable: true })
  firstName?: string | null;

  @Column({ nullable: true })
  lastName?: string | null;

  @Column({ nullable: true })
  email?: string | null;

  @Column({ nullable: true })
  address?: string | null;

  @Column({ nullable: true })
  city?: string | null;

  @Column({ nullable: true })
  state?: string | null;

  @Column({ nullable: true })
  zipCode?: string | null;

  @Column({ nullable: true })
  timezone?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  customFields?: Record<string, unknown> | null;

  @Column({ type: 'text', default: 'new' })
  status: LeadStatus;

  @Column({ type: 'integer', default: 0 })
  dialAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  lastDialedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  nextDialAt?: Date | null;

  @ManyToOne(() => Disposition, { nullable: true, eager: true })
  @JoinColumn({ name: 'dispositionId' })
  disposition?: Disposition | null;

  @Column({ nullable: true })
  dispositionId?: string | null;

  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
