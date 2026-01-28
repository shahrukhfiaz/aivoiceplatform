import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Agent } from '../agents/agent.entity';

@Entity('twilio_numbers')
export class TwilioNumber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // E.164 format phone number (e.g., +14156021922)
  @Column({ unique: true })
  phoneNumber: string;

  // Friendly label for the phone number
  @Column()
  label: string;

  // Twilio Account SID (format: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
  @Column()
  accountSid: string;

  // Twilio Auth Token (encrypted with AES-256-GCM)
  @Column()
  authTokenEncrypted: string;

  // Enable SMS messaging capability
  @Column({ type: 'boolean', default: false })
  smsEnabled: boolean;

  // Enable voice call capability
  @Column({ type: 'boolean', default: true })
  callsEnabled: boolean;

  // Enable call recording
  @Column({ type: 'boolean', default: false })
  recordingEnabled: boolean;

  // Enable audio denoise
  @Column({ type: 'boolean', default: true })
  denoiseEnabled: boolean;

  // Agent to route inbound calls to
  @ManyToOne(() => Agent, { nullable: true, eager: true })
  @JoinColumn({ name: 'agent_id' })
  agent?: Agent | null;

  @Column({ nullable: true })
  agentId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
