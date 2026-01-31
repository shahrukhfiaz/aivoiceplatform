import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Report } from './report.entity';
import { ReportSchedule } from './report-schedule.entity';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ExecutionTrigger = 'manual' | 'scheduled' | 'api';

@Entity()
@Index(['reportId', 'createdAt'])
export class ReportExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reportId: string;

  @ManyToOne(() => Report, (report) => report.executions, { onDelete: 'CASCADE' })
  report: Report;

  @Column({ nullable: true })
  scheduleId?: string;

  @ManyToOne(() => ReportSchedule, { nullable: true, onDelete: 'SET NULL' })
  schedule?: ReportSchedule;

  @Column({ type: 'text' })
  status: ExecutionStatus;

  @Column({ type: 'text' })
  trigger: ExecutionTrigger;

  // Execution parameters
  @Column({ type: 'simple-json', nullable: true })
  parameters?: {
    dateRange?: {
      start: string;
      end: string;
    };
    filters?: Record<string, unknown>;
    format?: string;
  };

  // Results
  @Column({ type: 'integer', nullable: true })
  rowCount?: number;

  @Column({ type: 'text', nullable: true })
  filePath?: string;

  @Column({ type: 'integer', nullable: true })
  fileSizeBytes?: number;

  @Column({ type: 'text', nullable: true })
  downloadUrl?: string;

  // For inline results (small reports)
  @Column({ type: 'simple-json', nullable: true })
  resultSummary?: {
    columns: string[];
    previewRows: unknown[][];
    totalRows: number;
    aggregates?: Record<string, unknown>;
  };

  // Timing
  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'integer', nullable: true })
  durationMs?: number;

  // Error handling
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'simple-json', nullable: true })
  errorDetails?: Record<string, unknown>;

  // User tracking
  @Column({ nullable: true })
  triggeredById?: string;

  @CreateDateColumn()
  createdAt: Date;
}
