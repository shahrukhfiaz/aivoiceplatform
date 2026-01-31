import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type WebhookEventType =
  | 'call.started'
  | 'call.ended'
  | 'lead.created'
  | 'lead.dispositioned'
  | 'campaign.started'
  | 'campaign.paused'
  | 'campaign.completed';

@Entity('outgoing_webhook')
export class OutgoingWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  url: string;

  @Column({ type: 'simple-array' })
  events: WebhookEventType[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  secret?: string; // For HMAC signature verification

  @Column({ type: 'simple-json', nullable: true })
  headers?: Record<string, string>;

  // Multi-tenant support
  @Index()
  @Column({ nullable: true })
  organizationId?: string;

  // Retry configuration
  @Column({ type: 'integer', default: 3 })
  maxRetries: number;

  @Column({ type: 'integer', default: 5000 })
  timeoutMs: number;

  // Stats
  @Column({ type: 'integer', default: 0 })
  totalDelivered: number;

  @Column({ type: 'integer', default: 0 })
  totalFailed: number;

  @Column({ type: 'datetime', nullable: true })
  lastDeliveredAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  lastFailedAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('webhook_delivery_log')
@Index(['webhookId', 'createdAt'])
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  webhookId: string;

  @Column({ type: 'text' })
  event: WebhookEventType;

  @Column({ type: 'text' })
  status: 'pending' | 'delivered' | 'failed';

  @Column({ type: 'simple-json' })
  payload: Record<string, unknown>;

  @Column({ type: 'integer', nullable: true })
  statusCode?: number;

  @Column({ type: 'text', nullable: true })
  responseBody?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'integer', default: 0 })
  attemptNumber: number;

  @Column({ type: 'integer', nullable: true })
  durationMs?: number;

  @CreateDateColumn()
  createdAt: Date;
}
