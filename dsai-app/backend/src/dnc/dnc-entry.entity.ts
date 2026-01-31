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
import { Campaign } from '../campaigns/campaign.entity';
import { User } from '../users/user.entity';

export type DncSource = 'internal' | 'national' | 'state' | 'disposition' | 'customer_request' | 'import';

@Entity()
export class DncEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  phoneNumber: string;

  @Column({ type: 'text', default: 'internal' })
  source: DncSource;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  // Campaign-specific DNC (null = global)
  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign?: Campaign | null;

  @Column({ nullable: true })
  campaignId?: string | null;

  // Who added this entry
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'addedByUserId' })
  addedByUser?: User | null;

  @Column({ nullable: true })
  addedByUserId?: string | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
