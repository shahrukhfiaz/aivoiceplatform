import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { ReportSchedule } from './report-schedule.entity';
import { ReportExecution } from './report-execution.entity';
import { User } from '../users/user.entity';

export type ReportType = 'campaign' | 'agent' | 'lead' | 'call' | 'disposition' | 'custom';
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'table' | 'metric' | 'heatmap';
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'between';

export interface ReportColumn {
  id: string;
  field: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  aggregation?: AggregationType;
  format?: string;
  visible: boolean;
  sortable: boolean;
  sortOrder?: 'asc' | 'desc';
  sortPriority?: number;
  width?: number;
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
  label?: string;
}

export interface ReportGrouping {
  field: string;
  label: string;
  order?: 'asc' | 'desc';
}

export interface ReportVisualization {
  type: ChartType;
  title?: string;
  xAxis?: string;
  yAxis?: string;
  series?: string[];
  colors?: string[];
  options?: Record<string, unknown>;
}

@Entity()
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  type: ReportType;

  // Data source configuration
  @Column({ type: 'text', default: 'call' })
  primaryEntity: string;

  @Column({ type: 'simple-array', nullable: true })
  joinEntities?: string[];

  // Columns/fields to include
  @Column({ type: 'simple-json' })
  columns: ReportColumn[];

  // Filters
  @Column({ type: 'simple-json', nullable: true })
  filters?: ReportFilter[];

  // Grouping
  @Column({ type: 'simple-json', nullable: true })
  groupBy?: ReportGrouping[];

  // Date range configuration
  @Column({ type: 'text', nullable: true })
  dateField?: string; // Field to use for date filtering

  @Column({ type: 'text', default: 'last_7_days' })
  defaultDateRange: string; // 'today', 'yesterday', 'last_7_days', 'this_month', 'custom'

  // Visualization settings
  @Column({ type: 'simple-json', nullable: true })
  visualizations?: ReportVisualization[];

  // Access control
  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean; // Built-in report

  @Column({ nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true })
  createdBy?: User;

  // Organization (for multi-tenant)
  @Column({ nullable: true })
  organizationId?: string;

  // Related entities
  @OneToMany(() => ReportSchedule, (schedule) => schedule.report)
  schedules: ReportSchedule[];

  @OneToMany(() => ReportExecution, (execution) => execution.report)
  executions: ReportExecution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
