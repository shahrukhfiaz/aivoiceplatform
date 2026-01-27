import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Agent } from '../agents/agent.entity';

export type TrunkDirection = 'inbound' | 'outbound';
export type TrunkTransport = 'udp' | 'tcp' | 'tls' | 'wss';

@Entity()
export class Trunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', default: 'inbound' })
  direction: TrunkDirection;

  // SIP Provider Host (e.g., sip.telnyx.com, sip.twilio.com)
  @Column({ nullable: true })
  host?: string;

  // Port (default 5060 for UDP, 5061 for TLS)
  @Column({ type: 'integer', default: 5060 })
  port: number;

  // Username for authentication with provider
  @Column({ nullable: true })
  username?: string;

  // Password for authentication with provider
  @Column()
  password: string;

  @Column({ default: 'udp' })
  transport: TrunkTransport;

  @Column({ default: 'ulaw,alaw' })
  codecs: string;

  // For inbound trunks: DID number that receives calls
  @Column({ nullable: true })
  didNumber?: string;

  // For inbound trunks: Agent to route calls to
  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: 'agent_id' })
  agent?: Agent | null;

  @Column({ nullable: true })
  agentId?: string | null;

  // IP ACL for inbound security (comma-separated IPs)
  @Column({ nullable: true })
  allowedIps?: string;

  // Enable SIP registration for outbound trunks
  @Column({ type: 'boolean', default: false })
  registerEnabled: boolean;

  // Registration interval in seconds
  @Column({ type: 'integer', default: 120 })
  registerInterval: number;

  // Caller ID for outbound calls
  @Column({ nullable: true })
  outboundCallerId?: string;

  // Recording enabled for calls through this trunk
  @Column({ type: 'boolean', default: false })
  recordingEnabled: boolean;

  // Denoise enabled for calls through this trunk
  @Column({ type: 'boolean', default: true })
  denoiseEnabled: boolean;
}
