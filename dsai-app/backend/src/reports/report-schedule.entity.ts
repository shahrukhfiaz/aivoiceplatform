import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Report } from './report.entity';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type DeliveryMethod = 'email' | 'webhook' | 'sftp' | 'storage';
export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

@Entity()
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reportId: string;

  @ManyToOne(() => Report, (report) => report.schedules, { onDelete: 'CASCADE' })
  report: Report;

  @Column()
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Schedule configuration
  @Column({ type: 'text' })
  frequency: ScheduleFrequency;

  // For daily: time of day (e.g., "08:00")
  @Column({ type: 'text', nullable: true })
  time?: string;

  // For weekly: day of week (0-6, Sunday = 0)
  @Column({ type: 'integer', nullable: true })
  dayOfWeek?: number;

  // For monthly: day of month (1-31)
  @Column({ type: 'integer', nullable: true })
  dayOfMonth?: number;

  // Timezone for scheduling
  @Column({ type: 'text', default: 'America/New_York' })
  timezone: string;

  // Delivery configuration
  @Column({ type: 'text' })
  deliveryMethod: DeliveryMethod;

  @Column({ type: 'text' })
  format: ExportFormat;

  // Email delivery options
  @Column({ type: 'simple-array', nullable: true })
  emailRecipients?: string[];

  @Column({ type: 'text', nullable: true })
  emailSubject?: string;

  @Column({ type: 'text', nullable: true })
  emailBody?: string;

  // Webhook delivery options
  @Column({ type: 'text', nullable: true })
  webhookUrl?: string;

  @Column({ type: 'simple-json', nullable: true })
  webhookHeaders?: Record<string, string>;

  // SFTP delivery options
  @Column({ type: 'text', nullable: true })
  sftpHost?: string;

  @Column({ type: 'integer', nullable: true })
  sftpPort?: number;

  @Column({ type: 'text', nullable: true })
  sftpUsername?: string;

  @Column({ type: 'text', nullable: true })
  sftpPassword?: string;

  @Column({ type: 'text', nullable: true })
  sftpPath?: string;

  // Storage options (for internal storage)
  @Column({ type: 'text', nullable: true })
  storagePath?: string;

  @Column({ type: 'integer', default: 30 })
  retentionDays: number;

  // Date range override for scheduled runs
  @Column({ type: 'text', nullable: true })
  dateRangeOverride?: string; // 'previous_day', 'previous_week', 'previous_month'

  // Execution tracking
  @Column({ type: 'datetime', nullable: true })
  lastRunAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastRunStatus?: 'success' | 'failed';

  @Column({ type: 'text', nullable: true })
  lastRunError?: string;

  @Column({ type: 'integer', default: 0 })
  totalRuns: number;

  @Column({ type: 'integer', default: 0 })
  failedRuns: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
