import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { CrmConnection } from './crm-connection.entity';

export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
export type SyncOperation = 'create' | 'update' | 'delete' | 'upsert';

@Entity()
@Index(['connectionId', 'createdAt'])
export class CrmSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  connectionId: string;

  @ManyToOne(() => CrmConnection, (connection) => connection.syncLogs, { onDelete: 'CASCADE' })
  connection: CrmConnection;

  // Sync session ID for grouping related logs
  @Column({ nullable: true })
  sessionId?: string;

  // Entity being synced
  @Column()
  entityType: string;

  // Operation type
  @Column({ type: 'text' })
  operation: SyncOperation;

  // Direction
  @Column({ type: 'text' })
  direction: 'to_crm' | 'from_crm';

  // Local record ID
  @Column({ nullable: true })
  localId?: string;

  // CRM record ID
  @Column({ nullable: true })
  crmId?: string;

  // Status
  @Column({ type: 'text', default: 'pending' })
  status: SyncStatus;

  // Counts
  @Column({ type: 'integer', default: 0 })
  recordsProcessed: number;

  @Column({ type: 'integer', default: 0 })
  recordsSuccess: number;

  @Column({ type: 'integer', default: 0 })
  recordsFailed: number;

  // Error details
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'simple-json', nullable: true })
  errorDetails?: Record<string, unknown>;

  // Request/response for debugging
  @Column({ type: 'simple-json', nullable: true })
  requestPayload?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  responsePayload?: Record<string, unknown>;

  // Timing
  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'integer', nullable: true })
  durationMs?: number;

  @CreateDateColumn()
  createdAt: Date;
}
