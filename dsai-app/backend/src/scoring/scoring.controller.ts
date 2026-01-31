import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ScoringService, LeadData } from './scoring.service';
import { ScoringModel } from './entities/scoring-model.entity';

@Controller('scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  // ==================== Lead Scoring ====================

  @Post('leads/:leadId/score')
  @Roles(UserRole.ADMIN)
  async scoreLead(
    @Param('leadId') leadId: string,
    @Body() body: Omit<LeadData, 'id'>,
  ) {
    return this.scoringService.scoreLead({ id: leadId, ...body });
  }

  @Post('batch')
  @Roles(UserRole.ADMIN)
  async scoreLeadsBatch(@Body() body: { leads: LeadData[] }) {
    return this.scoringService.scoreLeadsBatch(body.leads);
  }

  @Get('leads/:leadId')
  async getLeadScore(@Param('leadId') leadId: string) {
    return this.scoringService.getLeadScore(leadId);
  }

  @Get('leads')
  async listScores(
    @Query('campaignId') campaignId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.scoringService.findAll({
      campaignId,
      organizationId,
      minScore: minScore ? parseInt(minScore) : undefined,
      maxScore: maxScore ? parseInt(maxScore) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  // ==================== Priority Queue ====================

  @Get('campaigns/:campaignId/priority-queue')
  async getPriorityQueue(
    @Param('campaignId') campaignId: string,
    @Query('limit') limit?: string,
    @Query('minScore') minScore?: string,
  ) {
    return this.scoringService.getPriorityQueue({
      campaignId,
      limit: limit ? parseInt(limit) : 100,
      minScore: minScore ? parseInt(minScore) : 0,
    });
  }

  @Get('leads/:leadId/best-time')
  async getBestTimeToCall(@Param('leadId') leadId: string) {
    return this.scoringService.getBestTimeToCall(leadId);
  }

  // ==================== Models ====================

  @Get('models')
  async getModels(@Query('organizationId') organizationId?: string) {
    return this.scoringService.getModels(organizationId);
  }

  @Post('models')
  @Roles(UserRole.ADMIN)
  async createModel(@Body() body: Partial<ScoringModel>) {
    return this.scoringService.createModel(body);
  }

  @Post('models/:id/activate')
  @Roles(UserRole.ADMIN)
  async activateModel(@Param('id') id: string) {
    return this.scoringService.activateModel(id);
  }
}
