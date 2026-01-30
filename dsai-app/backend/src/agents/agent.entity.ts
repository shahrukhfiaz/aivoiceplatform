import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Provider } from '../providers/provider.entity';
import { PhoneNumber } from '../numbers/number.entity';
import { Trunk } from '../trunks/trunk.entity';

export enum AgentStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
}

export enum AgentMode {
  PIPELINE = 'pipeline',
  STS = 'sts',
}

export enum AgentCallType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

@Entity()
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: AgentStatus.STOPPED })
  status: AgentStatus;

  @Column({ type: 'integer', nullable: true })
  port: number;

  @Column({ type: 'integer', nullable: true })
  httpPort: number;

  @Column({ type: 'text', default: AgentMode.PIPELINE })
  mode: AgentMode;

  @Column({ type: 'text', unique: true, nullable: true })
  sipExtension: string | null;

  @Column({ type: 'text', default: AgentCallType.INBOUND })
  defaultCallType: AgentCallType;

  @ManyToOne(() => Provider, { nullable: true, eager: true })
  @JoinColumn({ name: 'provider_asr_id' })
  providerAsr?: Provider | null;

  @ManyToOne(() => Provider, { nullable: true, eager: true })
  @JoinColumn({ name: 'provider_llm_id' })
  providerLlm?: Provider | null;

  @ManyToOne(() => Provider, { nullable: true, eager: true })
  @JoinColumn({ name: 'provider_tts_id' })
  providerTts?: Provider | null;

  @ManyToOne(() => Provider, { nullable: true, eager: true })
  @JoinColumn({ name: 'provider_sts_id' })
  providerSts?: Provider | null;

  @ManyToOne(() => Trunk, { nullable: true, eager: true })
  @JoinColumn({ name: 'outbound_trunk_id' })
  outboundTrunk?: Trunk | null;

  @Column({ nullable: true })
  outboundTrunkId?: string | null;

  @OneToMany(() => PhoneNumber, (number) => number.agent)
  numbers?: PhoneNumber[];
}
