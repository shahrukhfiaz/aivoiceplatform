import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import {
  ReportsService,
  CreateReportDto,
  CreateScheduleDto,
  RunReportParams,
} from './reports.service';
import { ExportFormat } from './report-schedule.entity';
import * as fs from 'fs';
import * as path from 'path';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ==================== Report CRUD ====================

  @Post()
  async createReport(@Body() dto: CreateReportDto, @Request() req: { user: { id: string } }) {
    return this.reportsService.createReport(dto, req.user.id);
  }

  @Get()
  async getReports(@Query('organizationId') organizationId?: string) {
    return this.reportsService.getReports(organizationId);
  }

  @Get(':id')
  async getReport(@Param('id') id: string) {
    return this.reportsService.getReport(id);
  }

  @Patch(':id')
  async updateReport(
    @Param('id') id: string,
    @Body() dto: Partial<CreateReportDto>,
  ) {
    return this.reportsService.updateReport(id, dto);
  }

  @Delete(':id')
  async deleteReport(@Param('id') id: string) {
    await this.reportsService.deleteReport(id);
    return { success: true };
  }

  @Post(':id/duplicate')
  async duplicateReport(
    @Param('id') id: string,
    @Body() body: { name: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.reportsService.duplicateReport(id, body.name, req.user.id);
  }

  // ==================== Report Execution ====================

  @Post(':id/run')
  async runReport(
    @Param('id') id: string,
    @Body() body: {
      dateRange?: { start: string; end: string };
      filters?: Record<string, unknown>;
      page?: number;
      pageSize?: number;
    },
    @Request() req: { user: { id: string } },
  ) {
    const params: RunReportParams = {
      page: body.page || 1,
      pageSize: body.pageSize || 100,
      filters: body.filters,
    };

    if (body.dateRange) {
      params.dateRange = {
        start: new Date(body.dateRange.start),
        end: new Date(body.dateRange.end),
      };
    }

    return this.reportsService.runReport(id, params, 'manual', req.user.id);
  }

  @Post(':id/export')
  async exportReport(
    @Param('id') id: string,
    @Body() body: {
      dateRange?: { start: string; end: string };
      filters?: Record<string, unknown>;
      format?: ExportFormat;
    },
    @Request() req: { user: { id: string } },
  ) {
    const params: RunReportParams = {
      filters: body.filters,
    };

    if (body.dateRange) {
      params.dateRange = {
        start: new Date(body.dateRange.start),
        end: new Date(body.dateRange.end),
      };
    }

    return this.reportsService.exportReport(
      id,
      params,
      body.format || 'csv',
      req.user.id,
    );
  }

  @Get('download/:executionId')
  async downloadReport(
    @Param('executionId') executionId: string,
    @Res() res: Response,
  ) {
    const execution = await this.reportsService.getExecution(executionId);

    if (!execution.filePath || !fs.existsSync(execution.filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const fileName = path.basename(execution.filePath);
    const ext = path.extname(fileName).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.csv') contentType = 'text/csv';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.xlsx' || ext === '.excel') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(execution.filePath).pipe(res);
  }

  @Get(':id/executions')
  async getExecutions(
    @Param('id') reportId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getExecutions(reportId, limit ? parseInt(limit) : 50);
  }

  @Get('executions/:executionId')
  async getExecution(@Param('executionId') executionId: string) {
    return this.reportsService.getExecution(executionId);
  }

  // ==================== Report Scheduling ====================

  @Post('schedules')
  @Roles(UserRole.ADMIN)
  async createSchedule(@Body() dto: CreateScheduleDto) {
    return this.reportsService.createSchedule(dto);
  }

  @Get('schedules')
  async getSchedules(@Query('reportId') reportId?: string) {
    return this.reportsService.getSchedules(reportId);
  }

  @Patch('schedules/:id')
  @Roles(UserRole.ADMIN)
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: Partial<CreateScheduleDto>,
  ) {
    return this.reportsService.updateSchedule(id, dto);
  }

  @Delete('schedules/:id')
  @Roles(UserRole.ADMIN)
  async deleteSchedule(@Param('id') id: string) {
    await this.reportsService.deleteSchedule(id);
    return { success: true };
  }

  @Patch('schedules/:id/toggle')
  @Roles(UserRole.ADMIN)
  async toggleSchedule(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.reportsService.toggleSchedule(id, body.isActive);
  }

  // ==================== System Reports ====================

  @Post('seed-system-reports')
  @Roles(UserRole.ADMIN)
  async seedSystemReports() {
    await this.reportsService.seedSystemReports();
    return { success: true, message: 'System reports seeded' };
  }
}
