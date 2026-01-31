import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallerIdService, PoolStats, NumberStats } from './caller-id.service';
import { CallerIdPool } from './caller-id-pool.entity';
import { CallerIdNumber, CallerIdStatus } from './caller-id-number.entity';
import { CallerIdReputationEvent } from './caller-id-reputation-event.entity';
import { CreateCallerIdPoolDto } from './dto/create-pool.dto';
import { UpdateCallerIdPoolDto } from './dto/update-pool.dto';
import { AddCallerIdNumberDto, UpdateCallerIdNumberDto, FlagNumberDto, ImportNumbersDto } from './dto/add-number.dto';

@Controller('caller-id')
@UseGuards(JwtAuthGuard)
export class CallerIdController {
  constructor(private readonly callerIdService: CallerIdService) {}

  // ==================== Pool Management ====================

  @Post('pools')
  async createPool(@Body() dto: CreateCallerIdPoolDto): Promise<CallerIdPool> {
    return this.callerIdService.createPool(dto);
  }

  @Get('pools')
  async findAllPools(): Promise<CallerIdPool[]> {
    return this.callerIdService.findAllPools();
  }

  @Get('pools/:id')
  async findPool(@Param('id', ParseUUIDPipe) id: string): Promise<CallerIdPool> {
    return this.callerIdService.findPool(id);
  }

  @Patch('pools/:id')
  async updatePool(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallerIdPoolDto,
  ): Promise<CallerIdPool> {
    return this.callerIdService.updatePool(id, dto);
  }

  @Delete('pools/:id')
  async deletePool(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.callerIdService.deletePool(id);
    return { success: true };
  }

  @Get('pools/:id/stats')
  async getPoolStats(@Param('id', ParseUUIDPipe) id: string): Promise<PoolStats> {
    return this.callerIdService.getPoolStats(id);
  }

  // ==================== Number Management ====================

  @Post('pools/:poolId/numbers')
  async addNumber(
    @Param('poolId', ParseUUIDPipe) poolId: string,
    @Body() dto: AddCallerIdNumberDto,
  ): Promise<CallerIdNumber> {
    return this.callerIdService.addNumber(poolId, dto);
  }

  @Post('pools/:poolId/numbers/import')
  async importNumbers(
    @Param('poolId', ParseUUIDPipe) poolId: string,
    @Body() dto: ImportNumbersDto,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    return this.callerIdService.importNumbers(poolId, dto.numbers);
  }

  @Get('pools/:poolId/numbers')
  async findNumbers(
    @Param('poolId', ParseUUIDPipe) poolId: string,
    @Query('status') status?: CallerIdStatus,
    @Query('areaCode') areaCode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ numbers: CallerIdNumber[]; total: number }> {
    return this.callerIdService.findNumbers(poolId, {
      status,
      areaCode,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('numbers/:id')
  async findNumber(@Param('id', ParseUUIDPipe) id: string): Promise<CallerIdNumber> {
    return this.callerIdService.findNumber(id);
  }

  @Patch('numbers/:id')
  async updateNumber(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallerIdNumberDto,
  ): Promise<CallerIdNumber> {
    return this.callerIdService.updateNumber(id, dto);
  }

  @Delete('numbers/:id')
  async deleteNumber(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.callerIdService.deleteNumber(id);
    return { success: true };
  }

  @Get('numbers/:id/stats')
  async getNumberStats(@Param('id', ParseUUIDPipe) id: string): Promise<NumberStats> {
    return this.callerIdService.getNumberStats(id);
  }

  // ==================== Reputation Management ====================

  @Post('numbers/:id/flag')
  async flagNumber(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FlagNumberDto,
  ): Promise<CallerIdNumber> {
    return this.callerIdService.flagNumber(id, dto);
  }

  @Post('numbers/:id/unblock')
  async unblockNumber(@Param('id', ParseUUIDPipe) id: string): Promise<CallerIdNumber> {
    return this.callerIdService.unblockNumber(id);
  }

  @Get('numbers/:id/reputation-history')
  async getReputationHistory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CallerIdReputationEvent[]> {
    return this.callerIdService.getReputationHistory(id);
  }

  // ==================== Analytics ====================

  @Get('analytics/overview')
  async getOverview(): Promise<{
    totalPools: number;
    totalNumbers: number;
    activeNumbers: number;
    flaggedNumbers: number;
  }> {
    const pools = await this.callerIdService.findAllPools();
    let totalNumbers = 0;
    let activeNumbers = 0;
    let flaggedNumbers = 0;

    for (const pool of pools) {
      totalNumbers += pool.totalNumbers || 0;
      activeNumbers += pool.activeNumbers || 0;
      flaggedNumbers += pool.flaggedNumbers || 0;
    }

    return {
      totalPools: pools.length,
      totalNumbers,
      activeNumbers,
      flaggedNumbers,
    };
  }
}
