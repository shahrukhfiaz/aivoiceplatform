import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CallEvent } from './call-event.entity';
import { Agent } from '../agents/agent.entity';

export type CallType = 'inbound' | 'outbound';

@Entity()
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  uuid: string;

  @Column({ nullable: true })
  agentId?: string | null;

  @ManyToOne(() => Agent, { nullable: true, eager: true })
  @JoinColumn({ name: 'agentId', referencedColumnName: 'id' })
  agent?: Agent | null;

  @Column({ type: 'text', nullable: true })
  callType?: CallType | null;

  @Column({ type: 'text', nullable: true })
  fromNumber?: string | null;

  @Column({ type: 'text', nullable: true })
  toNumber?: string | null;

  @Column({ type: 'text', nullable: true })
  providerId?: string | null;

  @Column({ type: 'text', nullable: true })
  providerName?: string | null;

  @Column({ type: 'text', nullable: true })
  endReason?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cost?: number | null;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  endedAt?: Date | null;

  @OneToMany(() => CallEvent, (event) => event.call, { cascade: true })
  events: CallEvent[];
}
