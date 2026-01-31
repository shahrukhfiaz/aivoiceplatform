import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { DncService, ScrubResult } from './dnc.service';
import { DncEntry, DncSource } from './dnc-entry.entity';
import { CreateDncEntryDto } from './dto/create-dnc-entry.dto';
import { ImportDncDto, ScrubLeadsDto } from './dto/import-dnc.dto';
import { PaginatedResult, PaginationQuery } from '../common/pagination';

interface AuthenticatedRequest {
  user: { sub: string; username: string; role: string };
}

@Controller('dnc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DncController {
  constructor(private readonly dncService: DncService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async create(
    @Body() dto: CreateDncEntryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DncEntry> {
    return this.dncService.create(dto, req.user.sub);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async bulkImport(
    @Body() dto: ImportDncDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ imported: number; skipped: number }> {
    return this.dncService.bulkImport(dto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async findAll(
    @Query() query: PaginationQuery & { campaignId?: string; source?: DncSource; search?: string },
  ): Promise<PaginatedResult<DncEntry>> {
    return this.dncService.findAll(query);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getStats(
    @Query('campaignId') campaignId?: string,
  ): Promise<{ total: number; bySource: Record<string, number> }> {
    return this.dncService.getStats(campaignId);
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async exportList(
    @Query('campaignId') campaignId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const entries = await this.dncService.exportList(campaignId);

    // Generate CSV
    const header = 'phoneNumber,source,reason,createdAt\n';
    const rows = entries
      .map(
        (e) =>
          `${e.phoneNumber},${e.source},${(e.reason || '').replace(/,/g, ';')},${e.createdAt.toISOString()}`,
      )
      .join('\n');

    const csv = header + rows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dnc-export-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Post('scrub')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async scrubList(@Body() dto: ScrubLeadsDto): Promise<ScrubResult> {
    return this.dncService.scrubList(dto);
  }

  @Post('check')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async checkNumber(
    @Body() body: { phoneNumber: string; campaignId?: string },
  ): Promise<{ blocked: boolean }> {
    const blocked = await this.dncService.isBlocked(body.phoneNumber, body.campaignId);
    return { blocked };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async findOne(@Param('id') id: string): Promise<DncEntry> {
    const entry = await this.dncService.findOne(id);
    if (!entry) {
      throw new Error('DNC entry not found');
    }
    return entry;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.dncService.remove(id);
    return { success: true };
  }
}
