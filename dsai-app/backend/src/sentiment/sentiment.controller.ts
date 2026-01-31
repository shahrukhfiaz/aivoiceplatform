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
import {
  SentimentService,
  AnalyzeCallSentimentOptions,
} from './sentiment.service';
import { SentimentStatus } from './entities/call-sentiment.entity';

@Controller('sentiment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SentimentController {
  constructor(private readonly sentimentService: SentimentService) {}

  // ==================== Analysis ====================

  @Post('calls/:callId/analyze')
  @Roles(UserRole.ADMIN)
  async analyzeCall(
    @Param('callId') callId: string,
    @Body()
    body: {
      transcript: string;
      campaignId?: string;
      agentId?: string;
      organizationId?: string;
    },
  ) {
    return this.sentimentService.analyzeCall({
      callId,
      transcript: body.transcript,
      campaignId: body.campaignId,
      agentId: body.agentId,
      organizationId: body.organizationId,
    });
  }

  // ==================== Retrieval ====================

  @Get('calls/:callId')
  async getCallSentiment(@Param('callId') callId: string) {
    return this.sentimentService.getCallSentiment(callId);
  }

  @Get('calls/:callId/utterances')
  async getUtterances(@Param('callId') callId: string) {
    const sentiment = await this.sentimentService.getCallSentiment(callId);
    if (!sentiment) {
      return { utterances: [] };
    }
    const utterances = await this.sentimentService.getUtterances(sentiment.id);
    return { utterances };
  }

  @Get('calls')
  async listSentiments(
    @Query('campaignId') campaignId?: string,
    @Query('agentId') agentId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: SentimentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.sentimentService.findAll({
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

  // ==================== Summary & Trends ====================

  @Get('summary')
  async getSummary(
    @Query('campaignId') campaignId?: string,
    @Query('agentId') agentId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.sentimentService.getSummary({
      campaignId,
      agentId,
      organizationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('trends')
  async getSentimentTrends(
    @Query('campaignId') campaignId?: string,
    @Query('agentId') agentId?: string,
    @Query('days') days?: string,
  ) {
    return this.sentimentService.getSentimentTrends({
      campaignId,
      agentId,
      days: days ? parseInt(days) : 30,
    });
  }

  @Get('emotions')
  async getEmotionDistribution(
    @Query('campaignId') campaignId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const summary = await this.sentimentService.getSummary({
      campaignId,
      organizationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return { emotionDistribution: summary.emotionDistribution };
  }

  @Get('satisfaction')
  async getSatisfactionMetrics(
    @Query('campaignId') campaignId?: string,
    @Query('agentId') agentId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const summary = await this.sentimentService.getSummary({
      campaignId,
      agentId,
      organizationId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    return {
      totalCalls: summary.totalCalls,
      satisfactionRate: summary.satisfactionRate,
      avgSentimentDelta: summary.avgSentimentDelta,
    };
  }

  // ==================== Alerts ====================

  @Get('alerts/negative')
  async getNegativeSentimentAlerts(
    @Query('campaignId') campaignId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sentimentService.getNegativeSentimentCalls({
      campaignId,
      organizationId,
      threshold: threshold ? parseFloat(threshold) : -0.3,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // ==================== Agent Summary ====================

  @Get('agents/:agentId/summary')
  async getAgentSentimentSummary(
    @Param('agentId') agentId: string,
    @Query('campaignId') campaignId?: string,
    @Query('days') days?: string,
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days ? parseInt(days) : 30));

    const summary = await this.sentimentService.getSummary({
      agentId,
      campaignId,
      startDate,
      endDate,
    });

    const trends = await this.sentimentService.getSentimentTrends({
      agentId,
      campaignId,
      days: days ? parseInt(days) : 30,
    });

    return {
      summary,
      trends,
    };
  }

  // ==================== Campaign Summary ====================

  @Get('campaigns/:campaignId/summary')
  async getCampaignSentimentSummary(
    @Param('campaignId') campaignId: string,
    @Query('days') days?: string,
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days ? parseInt(days) : 30));

    const summary = await this.sentimentService.getSummary({
      campaignId,
      startDate,
      endDate,
    });

    const trends = await this.sentimentService.getSentimentTrends({
      campaignId,
      days: days ? parseInt(days) : 30,
    });

    return {
      summary,
      trends,
    };
  }
}
