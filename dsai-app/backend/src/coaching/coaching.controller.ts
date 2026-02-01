import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { CoachingService, EvaluateCallOptions } from './coaching.service';
import {
  EvaluationStatus,
} from './entities/ai-evaluation.entity';
import { InsightType } from './entities/coaching-insight.entity';

@Controller('coaching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachingController {
  constructor(private readonly coachingService: CoachingService) {}

  // ==================== Evaluations ====================

  @Post('evaluate/:callId')
  @Roles(UserRole.ADMIN)
  async evaluateCall(
    @Param('callId') callId: string,
    @Body()
    body: {
      transcript: string;
      agentId?: string;
      campaignId?: string;
      organizationId?: string;
      scorecardId?: string;
    },
  ) {
    return this.coachingService.evaluateCall({
      callId,
      transcript: body.transcript,
      agentId: body.agentId,
      campaignId: body.campaignId,
      organizationId: body.organizationId,
      scorecardId: body.scorecardId,
    });
  }

  @Get('evaluations/:id')
  async getEvaluation(@Param('id') id: string) {
    return this.coachingService.findById(id);
  }

  @Get('evaluations')
  async listEvaluations(
    @Query('agentId') agentId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: EvaluationStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.coachingService.findAllEvaluations({
      agentId,
      campaignId,
      organizationId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get('evaluations/:id/comparison')
  async compareWithHuman(
    @Param('id') id: string,
    @Body()
    body: {
      humanScore: number;
      humanCategoryScores?: Record<string, number>;
    },
  ) {
    const evaluation = await this.coachingService.findById(id);
    return this.coachingService.compareWithHumanEvaluation(
      evaluation.callId,
      body.humanScore,
      body.humanCategoryScores,
    );
  }

  // ==================== Insights ====================

  @Get('insights')
  async getAllInsights(
    @Query('agentId') agentId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('insightType') insightType?: InsightType,
    @Query('acknowledged') acknowledged?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coachingService.getAllInsights({
      agentId,
      campaignId,
      organizationId,
      insightType,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('agents/:agentId/insights')
  async getAgentInsights(
    @Param('agentId') agentId: string,
    @Query('campaignId') campaignId?: string,
    @Query('insightType') insightType?: InsightType,
    @Query('acknowledged') acknowledged?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coachingService.getAgentInsights(agentId, {
      campaignId,
      insightType,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Post('agents/:agentId/insights/generate')
  @Roles(UserRole.ADMIN)
  async generateAgentInsights(
    @Param('agentId') agentId: string,
    @Query('campaignId') campaignId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.coachingService.generateAgentInsights(
      agentId,
      campaignId,
      organizationId,
    );
  }

  @Post('insights/:id/acknowledge')
  @Roles(UserRole.ADMIN)
  async acknowledgeInsight(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Request() req: any,
  ) {
    return this.coachingService.acknowledgeInsight(
      id,
      req.user?.id || 'system',
      body.notes,
    );
  }

  // ==================== Performance Summary ====================

  @Get('agents/:agentId/summary')
  async getAgentPerformanceSummary(
    @Param('agentId') agentId: string,
    @Query('campaignId') campaignId?: string,
    @Query('days') days?: string,
  ) {
    return this.coachingService.getAgentPerformanceSummary(agentId, {
      campaignId,
      days: days ? parseInt(days) : 30,
    });
  }

  // ==================== Training Recommendations ====================

  @Get('agents/:agentId/recommendations')
  async getAgentRecommendations(
    @Param('agentId') agentId: string,
    @Query('status') status?: 'pending' | 'in_progress' | 'completed' | 'dismissed',
  ) {
    return this.coachingService.getAgentRecommendations(agentId, status);
  }

  @Post('agents/:agentId/recommendations')
  @Roles(UserRole.ADMIN)
  async createRecommendation(
    @Param('agentId') agentId: string,
    @Body()
    body: {
      campaignId?: string;
      organizationId?: string;
      insightId?: string;
      title: string;
      description: string;
      category: string;
      priority?: number;
      resources?: Array<{
        type: 'video' | 'document' | 'exercise' | 'call_review';
        title: string;
        url?: string;
        callId?: string;
      }>;
    },
  ) {
    return this.coachingService.createRecommendation({
      agentId,
      ...body,
    });
  }

  @Patch('recommendations/:id/status')
  @Roles(UserRole.ADMIN)
  async updateRecommendationStatus(
    @Param('id') id: string,
    @Body()
    body: {
      status: 'in_progress' | 'completed' | 'dismissed';
      notes?: string;
    },
  ) {
    return this.coachingService.updateRecommendationStatus(
      id,
      body.status,
      body.notes,
    );
  }
}
