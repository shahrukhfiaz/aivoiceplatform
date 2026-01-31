import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AnalyticsService, AnalyzeCallOptions } from './analytics.service';
import {
  AnalyticsStatus,
} from './entities/call-analytics.entity';
import { KeywordCategory } from './entities/keyword-match.entity';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ==================== Call Analysis ====================

  @Post('calls/:callId/analyze')
  @Roles(UserRole.ADMIN)
  async analyzeCall(
    @Param('callId') callId: string,
    @Body()
    body: {
      transcript: string;
      totalDurationMs?: number;
      campaignId?: string;
      agentId?: string;
      organizationId?: string;
      script?: string;
      skipScriptAnalysis?: boolean;
    },
  ) {
    return this.analyticsService.analyzeCall({
      callId,
      transcript: body.transcript,
      totalDurationMs: body.totalDurationMs,
      campaignId: body.campaignId,
      agentId: body.agentId,
      organizationId: body.organizationId,
      script: body.script,
      skipScriptAnalysis: body.skipScriptAnalysis,
    });
  }

  @Get('calls/:callId')
  async getCallAnalytics(@Param('callId') callId: string) {
    return this.analyticsService.getCallAnalytics(callId);
  }

  @Get('calls')
  async listAnalytics(
    @Query('campaignId') campaignId?: string,
    @Query('agentId') agentId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: AnalyticsStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.analyticsService.findAll({
      campaignId,
      agentId,
      organizationId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get('calls/:callId/keywords')
  async getKeywordMatches(@Param('callId') callId: string) {
    const analytics = await this.analyticsService.getCallAnalytics(callId);
    if (!analytics) {
      return { matches: [] };
    }
    const matches = await this.analyticsService.getKeywordMatches(analytics.id);
    return { matches };
  }

  // ==================== Summary & Trends ====================

  @Get('summary')
  async getSummary(
    @Query('campaignId') campaignId?: string,
    @Query('agentId') agentId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getSummary({
      campaignId,
      agentId,
      organizationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('campaigns/:campaignId/script-adherence')
  async getScriptAdherenceTrend(
    @Param('campaignId') campaignId: string,
    @Query('agentId') agentId?: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getScriptAdherenceTrend({
      campaignId,
      agentId,
      days: days ? parseInt(days) : 30,
    });
  }

  // ==================== Keywords ====================

  @Get('keywords')
  async getKeywords(
    @Query('organizationId') organizationId?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.analyticsService.getKeywords(organizationId, campaignId);
  }

  @Post('keywords')
  @Roles(UserRole.ADMIN)
  async addKeyword(
    @Body()
    body: {
      keyword: string;
      category: KeywordCategory;
      organizationId?: string;
      campaignId?: string;
      isCaseSensitive?: boolean;
      isRegex?: boolean;
      alertThreshold?: number;
    },
  ) {
    return this.analyticsService.addKeyword(body);
  }

  @Delete('keywords/:id')
  @Roles(UserRole.ADMIN)
  async deleteKeyword(@Param('id') id: string) {
    await this.analyticsService.deleteKeyword(id);
    return { success: true };
  }
}
