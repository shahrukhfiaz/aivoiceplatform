import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import {
  Report,
  ReportType,
  ReportColumn,
  ReportFilter,
  ReportGrouping,
  ReportVisualization,
} from './report.entity';
import { ReportSchedule, ScheduleFrequency, DeliveryMethod, ExportFormat } from './report-schedule.entity';
import { ReportExecution, ExecutionStatus, ExecutionTrigger } from './report-execution.entity';
import * as fs from 'fs';
import * as path from 'path';

export interface CreateReportDto {
  name: string;
  description?: string;
  type: ReportType;
  primaryEntity: string;
  joinEntities?: string[];
  columns: ReportColumn[];
  filters?: ReportFilter[];
  groupBy?: ReportGrouping[];
  dateField?: string;
  defaultDateRange?: string;
  visualizations?: ReportVisualization[];
  isPublic?: boolean;
  organizationId?: string;
}

export interface CreateScheduleDto {
  reportId: string;
  name: string;
  frequency: ScheduleFrequency;
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  deliveryMethod: DeliveryMethod;
  format: ExportFormat;
  emailRecipients?: string[];
  emailSubject?: string;
  emailBody?: string;
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  dateRangeOverride?: string;
}

export interface RunReportParams {
  dateRange?: { start: Date; end: Date };
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  format?: ExportFormat;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  aggregates?: Record<string, unknown>;
  executionId: string;
}

// Entity metadata for query building
const ENTITY_METADATA: Record<string, {
  table: string;
  primaryKey: string;
  fields: Record<string, { column: string; type: string }>;
  relations?: Record<string, { entity: string; foreignKey: string; targetKey: string }>;
}> = {
  call: {
    table: 'call',
    primaryKey: 'id',
    fields: {
      id: { column: 'id', type: 'string' },
      callId: { column: 'callId', type: 'string' },
      direction: { column: 'direction', type: 'string' },
      status: { column: 'status', type: 'string' },
      fromNumber: { column: 'fromNumber', type: 'string' },
      toNumber: { column: 'toNumber', type: 'string' },
      duration: { column: 'duration', type: 'number' },
      createdAt: { column: 'createdAt', type: 'date' },
      answeredAt: { column: 'answeredAt', type: 'date' },
      endedAt: { column: 'endedAt', type: 'date' },
      campaignId: { column: 'campaignId', type: 'string' },
      leadId: { column: 'leadId', type: 'string' },
      agentId: { column: 'agentId', type: 'string' },
    },
    relations: {
      campaign: { entity: 'campaign', foreignKey: 'campaignId', targetKey: 'id' },
      lead: { entity: 'lead', foreignKey: 'leadId', targetKey: 'id' },
      agent: { entity: 'agent', foreignKey: 'agentId', targetKey: 'id' },
    },
  },
  campaign: {
    table: 'campaign',
    primaryKey: 'id',
    fields: {
      id: { column: 'id', type: 'string' },
      name: { column: 'name', type: 'string' },
      status: { column: 'status', type: 'string' },
      dialingMode: { column: 'dialingMode', type: 'string' },
      createdAt: { column: 'createdAt', type: 'date' },
    },
  },
  lead: {
    table: 'lead',
    primaryKey: 'id',
    fields: {
      id: { column: 'id', type: 'string' },
      firstName: { column: 'firstName', type: 'string' },
      lastName: { column: 'lastName', type: 'string' },
      phoneNumber: { column: 'phoneNumber', type: 'string' },
      email: { column: 'email', type: 'string' },
      status: { column: 'status', type: 'string' },
      state: { column: 'state', type: 'string' },
      city: { column: 'city', type: 'string' },
      dialAttempts: { column: 'dialAttempts', type: 'number' },
      createdAt: { column: 'createdAt', type: 'date' },
      lastDialedAt: { column: 'lastDialedAt', type: 'date' },
    },
    relations: {
      list: { entity: 'campaign_list', foreignKey: 'listId', targetKey: 'id' },
      disposition: { entity: 'disposition', foreignKey: 'dispositionId', targetKey: 'id' },
    },
  },
  agent: {
    table: 'agent',
    primaryKey: 'id',
    fields: {
      id: { column: 'id', type: 'string' },
      name: { column: 'name', type: 'string' },
      status: { column: 'status', type: 'string' },
      createdAt: { column: 'createdAt', type: 'date' },
    },
  },
  disposition: {
    table: 'disposition',
    primaryKey: 'id',
    fields: {
      id: { column: 'id', type: 'string' },
      code: { column: 'code', type: 'string' },
      name: { column: 'name', type: 'string' },
      category: { column: 'category', type: 'string' },
    },
  },
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportsDir = process.env.REPORTS_DIR || '/app/data/reports';
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepo: Repository<ReportSchedule>,
    @InjectRepository(ReportExecution)
    private readonly executionRepo: Repository<ReportExecution>,
    private readonly dataSource: DataSource,
  ) {
    this.ensureReportsDir();
    this.initScheduler();
  }

  // ==================== Report CRUD ====================

  async createReport(dto: CreateReportDto, userId?: string): Promise<Report> {
    const report = this.reportRepo.create({
      ...dto,
      createdById: userId,
    });
    return this.reportRepo.save(report);
  }

  async getReports(organizationId?: string): Promise<Report[]> {
    const where: Record<string, unknown> = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.reportRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getReport(id: string): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: ['schedules'],
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async updateReport(id: string, dto: Partial<CreateReportDto>): Promise<Report> {
    const report = await this.getReport(id);
    Object.assign(report, dto);
    return this.reportRepo.save(report);
  }

  async deleteReport(id: string): Promise<void> {
    const result = await this.reportRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Report not found');
  }

  async duplicateReport(id: string, newName: string, userId?: string): Promise<Report> {
    const original = await this.getReport(id);
    const duplicate = this.reportRepo.create({
      ...original,
      id: undefined,
      name: newName,
      isSystem: false,
      createdById: userId,
      createdAt: undefined,
      updatedAt: undefined,
    });
    return this.reportRepo.save(duplicate);
  }

  // ==================== Report Execution ====================

  async runReport(
    id: string,
    params: RunReportParams = {},
    trigger: ExecutionTrigger = 'manual',
    userId?: string,
  ): Promise<ReportResult> {
    const report = await this.getReport(id);
    const { page = 1, pageSize = 100, dateRange, filters } = params;

    // Create execution record
    const execution = await this.executionRepo.save(
      this.executionRepo.create({
        reportId: id,
        status: 'running',
        trigger,
        triggeredById: userId,
        parameters: {
          dateRange: dateRange ? {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
          } : undefined,
          filters,
        },
        startedAt: new Date(),
      }),
    );

    try {
      // Build and execute query
      const query = this.buildQuery(report, dateRange, filters);

      // Get total count
      const countQuery = query.clone();
      const totalRows = await countQuery.getCount();

      // Get paginated results
      const rows = await query
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getRawMany();

      // Calculate aggregates if grouping is defined
      let aggregates: Record<string, unknown> | undefined;
      if (report.groupBy && report.groupBy.length > 0) {
        aggregates = await this.calculateAggregates(report, dateRange, filters);
      }

      // Transform rows to use column labels
      const transformedRows = this.transformRows(rows, report.columns);

      // Update execution record
      await this.executionRepo.update(execution.id, {
        status: 'completed',
        rowCount: totalRows,
        completedAt: new Date(),
        durationMs: Date.now() - execution.startedAt!.getTime(),
        resultSummary: {
          columns: report.columns.map((c) => c.label),
          previewRows: transformedRows.slice(0, 10).map((r) => Object.values(r)),
          totalRows,
          aggregates,
        },
      });

      return {
        columns: report.columns,
        rows: transformedRows,
        totalRows,
        page,
        pageSize,
        aggregates,
        executionId: execution.id,
      };
    } catch (err) {
      // Update execution with error
      await this.executionRepo.update(execution.id, {
        status: 'failed',
        completedAt: new Date(),
        durationMs: Date.now() - execution.startedAt!.getTime(),
        errorMessage: err.message,
      });
      throw err;
    }
  }

  async exportReport(
    id: string,
    params: RunReportParams = {},
    format: ExportFormat = 'csv',
    userId?: string,
  ): Promise<{ filePath: string; fileName: string; downloadUrl: string }> {
    const report = await this.getReport(id);
    const { dateRange, filters } = params;

    // Create execution record
    const execution = await this.executionRepo.save(
      this.executionRepo.create({
        reportId: id,
        status: 'running',
        trigger: 'manual',
        triggeredById: userId,
        parameters: { dateRange: dateRange ? {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        } : undefined, filters, format },
        startedAt: new Date(),
      }),
    );

    try {
      // Build and execute query (no pagination for export)
      const query = this.buildQuery(report, dateRange, filters);
      const rows = await query.getRawMany();
      const transformedRows = this.transformRows(rows, report.columns);

      // Generate file
      const fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${format}`;
      const filePath = path.join(this.reportsDir, fileName);

      switch (format) {
        case 'csv':
          await this.exportToCsv(filePath, report.columns, transformedRows);
          break;
        case 'json':
          await this.exportToJson(filePath, report.columns, transformedRows);
          break;
        case 'excel':
          await this.exportToExcel(filePath, report.columns, transformedRows);
          break;
        default:
          throw new BadRequestException(`Unsupported export format: ${format}`);
      }

      const stats = fs.statSync(filePath);

      // Update execution record
      await this.executionRepo.update(execution.id, {
        status: 'completed',
        rowCount: rows.length,
        filePath,
        fileSizeBytes: stats.size,
        downloadUrl: `/api/reports/download/${execution.id}`,
        completedAt: new Date(),
        durationMs: Date.now() - execution.startedAt!.getTime(),
      });

      return {
        filePath,
        fileName,
        downloadUrl: `/api/reports/download/${execution.id}`,
      };
    } catch (err) {
      await this.executionRepo.update(execution.id, {
        status: 'failed',
        completedAt: new Date(),
        durationMs: Date.now() - execution.startedAt!.getTime(),
        errorMessage: err.message,
      });
      throw err;
    }
  }

  async getExecution(id: string): Promise<ReportExecution> {
    const execution = await this.executionRepo.findOne({
      where: { id },
      relations: ['report'],
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async getExecutions(reportId: string, limit: number = 50): Promise<ReportExecution[]> {
    return this.executionRepo.find({
      where: { reportId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ==================== Report Scheduling ====================

  async createSchedule(dto: CreateScheduleDto): Promise<ReportSchedule> {
    const schedule = this.scheduleRepo.create({
      ...dto,
      nextRunAt: this.calculateNextRun(dto),
    });
    return this.scheduleRepo.save(schedule);
  }

  async getSchedules(reportId?: string): Promise<ReportSchedule[]> {
    const where: Record<string, unknown> = {};
    if (reportId) where.reportId = reportId;
    return this.scheduleRepo.find({ where, relations: ['report'] });
  }

  async updateSchedule(id: string, dto: Partial<CreateScheduleDto>): Promise<ReportSchedule> {
    const schedule = await this.scheduleRepo.findOne({ where: { id } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    Object.assign(schedule, dto);
    schedule.nextRunAt = this.calculateNextRun(schedule);
    return this.scheduleRepo.save(schedule);
  }

  async deleteSchedule(id: string): Promise<void> {
    const result = await this.scheduleRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Schedule not found');
  }

  async toggleSchedule(id: string, isActive: boolean): Promise<ReportSchedule> {
    const schedule = await this.scheduleRepo.findOne({ where: { id } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    schedule.isActive = isActive;
    if (isActive) {
      schedule.nextRunAt = this.calculateNextRun(schedule);
    }
    return this.scheduleRepo.save(schedule);
  }

  // ==================== Query Building ====================

  private buildQuery(
    report: Report,
    dateRange?: { start: Date; end: Date },
    additionalFilters?: Record<string, unknown>,
  ): SelectQueryBuilder<unknown> {
    const entityMeta = ENTITY_METADATA[report.primaryEntity];
    if (!entityMeta) {
      throw new BadRequestException(`Unknown entity: ${report.primaryEntity}`);
    }

    const qb = this.dataSource
      .createQueryBuilder()
      .from(entityMeta.table, report.primaryEntity);

    // Add column selections
    for (const column of report.columns) {
      if (!column.visible) continue;

      const fieldParts = column.field.split('.');
      const entityName = fieldParts.length > 1 ? fieldParts[0] : report.primaryEntity;
      const fieldName = fieldParts.length > 1 ? fieldParts[1] : fieldParts[0];

      if (column.aggregation) {
        qb.addSelect(`${column.aggregation.toUpperCase()}(${entityName}.${fieldName})`, column.id);
      } else {
        qb.addSelect(`${entityName}.${fieldName}`, column.id);
      }
    }

    // Add joins for related entities
    if (report.joinEntities) {
      for (const joinEntity of report.joinEntities) {
        const relation = entityMeta.relations?.[joinEntity];
        if (relation) {
          qb.leftJoin(
            relation.entity,
            joinEntity,
            `${report.primaryEntity}.${relation.foreignKey} = ${joinEntity}.${relation.targetKey}`,
          );
        }
      }
    }

    // Add date range filter
    if (dateRange && report.dateField) {
      qb.andWhere(`${report.primaryEntity}.${report.dateField} >= :startDate`, {
        startDate: dateRange.start,
      });
      qb.andWhere(`${report.primaryEntity}.${report.dateField} <= :endDate`, {
        endDate: dateRange.end,
      });
    }

    // Add report filters
    if (report.filters) {
      for (const filter of report.filters) {
        this.applyFilter(qb, filter, report.primaryEntity);
      }
    }

    // Add additional runtime filters
    if (additionalFilters) {
      for (const [field, value] of Object.entries(additionalFilters)) {
        qb.andWhere(`${report.primaryEntity}.${field} = :${field}`, { [field]: value });
      }
    }

    // Add grouping
    if (report.groupBy && report.groupBy.length > 0) {
      for (const group of report.groupBy) {
        qb.addGroupBy(`${report.primaryEntity}.${group.field}`);
      }
    }

    // Add ordering
    const sortColumns = report.columns
      .filter((c) => c.sortOrder)
      .sort((a, b) => (a.sortPriority || 0) - (b.sortPriority || 0));

    for (const column of sortColumns) {
      qb.addOrderBy(column.id, column.sortOrder?.toUpperCase() as 'ASC' | 'DESC');
    }

    return qb;
  }

  private applyFilter(
    qb: SelectQueryBuilder<unknown>,
    filter: ReportFilter,
    primaryEntity: string,
  ): void {
    const fieldParts = filter.field.split('.');
    const entityName = fieldParts.length > 1 ? fieldParts[0] : primaryEntity;
    const fieldName = fieldParts.length > 1 ? fieldParts[1] : fieldParts[0];
    const fullField = `${entityName}.${fieldName}`;
    const paramName = filter.id.replace(/-/g, '_');

    switch (filter.operator) {
      case 'eq':
        qb.andWhere(`${fullField} = :${paramName}`, { [paramName]: filter.value });
        break;
      case 'neq':
        qb.andWhere(`${fullField} != :${paramName}`, { [paramName]: filter.value });
        break;
      case 'gt':
        qb.andWhere(`${fullField} > :${paramName}`, { [paramName]: filter.value });
        break;
      case 'gte':
        qb.andWhere(`${fullField} >= :${paramName}`, { [paramName]: filter.value });
        break;
      case 'lt':
        qb.andWhere(`${fullField} < :${paramName}`, { [paramName]: filter.value });
        break;
      case 'lte':
        qb.andWhere(`${fullField} <= :${paramName}`, { [paramName]: filter.value });
        break;
      case 'in':
        qb.andWhere(`${fullField} IN (:...${paramName})`, { [paramName]: filter.value });
        break;
      case 'nin':
        qb.andWhere(`${fullField} NOT IN (:...${paramName})`, { [paramName]: filter.value });
        break;
      case 'like':
        qb.andWhere(`${fullField} LIKE :${paramName}`, { [paramName]: `%${filter.value}%` });
        break;
      case 'between':
        const [min, max] = filter.value as [unknown, unknown];
        qb.andWhere(`${fullField} BETWEEN :${paramName}_min AND :${paramName}_max`, {
          [`${paramName}_min`]: min,
          [`${paramName}_max`]: max,
        });
        break;
    }
  }

  private async calculateAggregates(
    report: Report,
    dateRange?: { start: Date; end: Date },
    filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const entityMeta = ENTITY_METADATA[report.primaryEntity];
    const qb = this.dataSource.createQueryBuilder().from(entityMeta.table, report.primaryEntity);

    // Add aggregate calculations
    for (const column of report.columns) {
      if (column.aggregation) {
        qb.addSelect(
          `${column.aggregation.toUpperCase()}(${report.primaryEntity}.${column.field})`,
          `${column.id}_agg`,
        );
      }
    }

    // Apply same filters
    if (dateRange && report.dateField) {
      qb.andWhere(`${report.primaryEntity}.${report.dateField} >= :startDate`, {
        startDate: dateRange.start,
      });
      qb.andWhere(`${report.primaryEntity}.${report.dateField} <= :endDate`, {
        endDate: dateRange.end,
      });
    }

    if (report.filters) {
      for (const filter of report.filters) {
        this.applyFilter(qb, filter, report.primaryEntity);
      }
    }

    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        qb.andWhere(`${report.primaryEntity}.${field} = :${field}`, { [field]: value });
      }
    }

    return qb.getRawOne();
  }

  private transformRows(
    rows: Record<string, unknown>[],
    columns: ReportColumn[],
  ): Record<string, unknown>[] {
    return rows.map((row) => {
      const transformed: Record<string, unknown> = {};
      for (const column of columns) {
        if (!column.visible) continue;
        let value = row[column.id];

        // Apply formatting
        if (value !== null && value !== undefined && column.format) {
          value = this.formatValue(value, column.format, column.type);
        }

        transformed[column.label] = value;
      }
      return transformed;
    });
  }

  private formatValue(value: unknown, format: string, type: string): unknown {
    if (type === 'date' && value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (type === 'number' && typeof value === 'number') {
      if (format === 'currency') {
        return `$${value.toFixed(2)}`;
      }
      if (format === 'percent') {
        return `${(value * 100).toFixed(2)}%`;
      }
    }
    return value;
  }

  // ==================== Export Functions ====================

  private async exportToCsv(
    filePath: string,
    columns: ReportColumn[],
    rows: Record<string, unknown>[],
  ): Promise<void> {
    const visibleColumns = columns.filter((c) => c.visible);
    const header = visibleColumns.map((c) => c.label).join(',');
    const lines = rows.map((row) =>
      visibleColumns.map((c) => {
        const value = row[c.label];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(','),
    );

    fs.writeFileSync(filePath, [header, ...lines].join('\n'));
  }

  private async exportToJson(
    filePath: string,
    columns: ReportColumn[],
    rows: Record<string, unknown>[],
  ): Promise<void> {
    const data = {
      columns: columns.filter((c) => c.visible).map((c) => ({
        id: c.id,
        label: c.label,
        type: c.type,
      })),
      rows,
      exportedAt: new Date().toISOString(),
      totalRows: rows.length,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private async exportToExcel(
    filePath: string,
    columns: ReportColumn[],
    rows: Record<string, unknown>[],
  ): Promise<void> {
    // Simple XLSX generation (would need xlsx library for full support)
    // For now, create a CSV that Excel can open
    await this.exportToCsv(filePath.replace('.excel', '.csv'), columns, rows);
  }

  // ==================== Scheduler ====================

  private initScheduler(): void {
    // Run scheduler every minute
    this.schedulerInterval = setInterval(() => this.processScheduledReports(), 60000);
    this.logger.log('Report scheduler initialized');
  }

  private async processScheduledReports(): Promise<void> {
    const now = new Date();
    const dueSchedules = await this.scheduleRepo.find({
      where: {
        isActive: true,
      },
      relations: ['report'],
    });

    for (const schedule of dueSchedules) {
      if (schedule.nextRunAt && schedule.nextRunAt <= now) {
        try {
          await this.runScheduledReport(schedule);
        } catch (err) {
          this.logger.error(`Failed to run scheduled report ${schedule.id}: ${err.message}`);
        }
      }
    }
  }

  private async runScheduledReport(schedule: ReportSchedule): Promise<void> {
    this.logger.log(`Running scheduled report: ${schedule.name}`);

    const dateRange = this.getScheduleDateRange(schedule);

    try {
      const result = await this.exportReport(
        schedule.reportId,
        { dateRange },
        schedule.format,
      );

      // Deliver the report
      await this.deliverReport(schedule, result.filePath);

      // Update schedule
      schedule.lastRunAt = new Date();
      schedule.lastRunStatus = 'success';
      schedule.lastRunError = undefined;
      schedule.totalRuns++;
      schedule.nextRunAt = this.calculateNextRun(schedule);
      await this.scheduleRepo.save(schedule);
    } catch (err) {
      schedule.lastRunAt = new Date();
      schedule.lastRunStatus = 'failed';
      schedule.lastRunError = err.message;
      schedule.totalRuns++;
      schedule.failedRuns++;
      schedule.nextRunAt = this.calculateNextRun(schedule);
      await this.scheduleRepo.save(schedule);
      throw err;
    }
  }

  private getScheduleDateRange(schedule: ReportSchedule): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (schedule.dateRangeOverride || schedule.frequency) {
      case 'daily':
      case 'previous_day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case 'weekly':
      case 'previous_week':
        const dayOfWeek = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 7, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 1, 23, 59, 59);
        break;
      case 'monthly':
      case 'previous_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    }

    return { start, end };
  }

  private async deliverReport(schedule: ReportSchedule, filePath: string): Promise<void> {
    switch (schedule.deliveryMethod) {
      case 'email':
        // Email delivery would be implemented here
        this.logger.log(`Would email report to: ${schedule.emailRecipients?.join(', ')}`);
        break;
      case 'webhook':
        if (schedule.webhookUrl) {
          const fileContent = fs.readFileSync(filePath, 'base64');
          await fetch(schedule.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...schedule.webhookHeaders,
            },
            body: JSON.stringify({
              reportId: schedule.reportId,
              scheduleId: schedule.id,
              fileName: path.basename(filePath),
              content: fileContent,
              timestamp: new Date().toISOString(),
            }),
          });
        }
        break;
      case 'storage':
        // File is already saved locally
        this.logger.log(`Report saved to: ${filePath}`);
        break;
      case 'sftp':
        // SFTP delivery would be implemented here
        this.logger.log(`Would SFTP report to: ${schedule.sftpHost}`);
        break;
    }
  }

  private calculateNextRun(schedule: Pick<ReportSchedule, 'frequency' | 'time' | 'dayOfWeek' | 'dayOfMonth' | 'timezone'>): Date {
    const now = new Date();
    const [hours, minutes] = (schedule.time || '08:00').split(':').map(Number);
    let next = new Date(now);

    switch (schedule.frequency) {
      case 'daily':
        next.setHours(hours, minutes, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;
      case 'weekly':
        next.setHours(hours, minutes, 0, 0);
        const targetDay = schedule.dayOfWeek ?? 1; // Default Monday
        const currentDay = next.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
          daysUntil += 7;
        }
        next.setDate(next.getDate() + daysUntil);
        break;
      case 'monthly':
        next.setHours(hours, minutes, 0, 0);
        next.setDate(schedule.dayOfMonth ?? 1);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
      case 'quarterly':
        next.setHours(hours, minutes, 0, 0);
        next.setDate(schedule.dayOfMonth ?? 1);
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const nextQuarterMonth = (currentQuarter + 1) * 3;
        next.setMonth(nextQuarterMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 3);
        }
        break;
    }

    return next;
  }

  private ensureReportsDir(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  // ==================== System Reports ====================

  async seedSystemReports(): Promise<void> {
    const systemReports = [
      {
        name: 'Campaign Performance Summary',
        description: 'Overview of campaign metrics including calls, answer rates, and conversions',
        type: 'campaign' as ReportType,
        primaryEntity: 'call',
        columns: [
          { id: 'campaign_name', field: 'campaign.name', label: 'Campaign', type: 'string' as const, visible: true, sortable: true },
          { id: 'total_calls', field: 'id', label: 'Total Calls', type: 'number' as const, aggregation: 'count' as const, visible: true, sortable: true },
          { id: 'avg_duration', field: 'duration', label: 'Avg Duration', type: 'number' as const, aggregation: 'avg' as const, visible: true, sortable: true },
        ],
        groupBy: [{ field: 'campaignId', label: 'Campaign' }],
        dateField: 'createdAt',
        defaultDateRange: 'last_7_days',
        isSystem: true,
      },
      {
        name: 'Agent Activity Report',
        description: 'Agent performance metrics and call statistics',
        type: 'agent' as ReportType,
        primaryEntity: 'call',
        columns: [
          { id: 'agent_name', field: 'agent.name', label: 'Agent', type: 'string' as const, visible: true, sortable: true },
          { id: 'total_calls', field: 'id', label: 'Calls Handled', type: 'number' as const, aggregation: 'count' as const, visible: true, sortable: true },
          { id: 'total_duration', field: 'duration', label: 'Total Talk Time', type: 'number' as const, aggregation: 'sum' as const, visible: true, sortable: true },
        ],
        groupBy: [{ field: 'agentId', label: 'Agent' }],
        dateField: 'createdAt',
        defaultDateRange: 'today',
        isSystem: true,
      },
      {
        name: 'Call Detail Records',
        description: 'Detailed listing of all calls with timestamps and outcomes',
        type: 'call' as ReportType,
        primaryEntity: 'call',
        columns: [
          { id: 'created_at', field: 'createdAt', label: 'Date/Time', type: 'date' as const, visible: true, sortable: true, sortOrder: 'desc' as const, sortPriority: 1 },
          { id: 'direction', field: 'direction', label: 'Direction', type: 'string' as const, visible: true, sortable: true },
          { id: 'from', field: 'fromNumber', label: 'From', type: 'string' as const, visible: true, sortable: false },
          { id: 'to', field: 'toNumber', label: 'To', type: 'string' as const, visible: true, sortable: false },
          { id: 'status', field: 'status', label: 'Status', type: 'string' as const, visible: true, sortable: true },
          { id: 'duration', field: 'duration', label: 'Duration (s)', type: 'number' as const, visible: true, sortable: true },
        ],
        dateField: 'createdAt',
        defaultDateRange: 'today',
        isSystem: true,
      },
    ];

    for (const reportData of systemReports) {
      const exists = await this.reportRepo.findOne({ where: { name: reportData.name, isSystem: true } });
      if (!exists) {
        await this.reportRepo.save(this.reportRepo.create(reportData));
        this.logger.log(`Created system report: ${reportData.name}`);
      }
    }
  }
}
