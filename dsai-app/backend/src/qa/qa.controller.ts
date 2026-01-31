import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { QaService } from './qa.service';
import { CreateScorecardDto, UpdateScorecardDto } from './dto/create-scorecard.dto';
import { CreateEvaluationDto, UpdateEvaluationDto, AcknowledgeEvaluationDto } from './dto/create-evaluation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('qa')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QaController {
  constructor(private readonly qaService: QaService) {}

  // ==================== Scorecard Endpoints ====================

  @Post('scorecards')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createScorecard(@Body() dto: CreateScorecardDto) {
    return this.qaService.createScorecard(dto);
  }

  @Get('scorecards')
  findAllScorecards(@Query('activeOnly') activeOnly?: string) {
    return this.qaService.findAllScorecards(activeOnly === 'true');
  }

  @Get('scorecards/default')
  getDefaultScorecard() {
    return this.qaService.getDefaultScorecard();
  }

  @Get('scorecards/:id')
  findScorecardById(@Param('id') id: string) {
    return this.qaService.findScorecardById(id);
  }

  @Put('scorecards/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateScorecard(@Param('id') id: string, @Body() dto: UpdateScorecardDto) {
    return this.qaService.updateScorecard(id, dto);
  }

  @Delete('scorecards/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  deleteScorecard(@Param('id') id: string) {
    return this.qaService.deleteScorecard(id);
  }

  // ==================== Evaluation Endpoints ====================

  @Post('evaluations')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createEvaluation(@Body() dto: CreateEvaluationDto, @Request() req: any) {
    return this.qaService.createEvaluation(dto, req.user.id);
  }

  @Get('evaluations')
  findAllEvaluations(
    @Query('agentId') agentId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('evaluatorId') evaluatorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('passed') passed?: string,
  ) {
    return this.qaService.findAllEvaluations({
      agentId,
      campaignId,
      evaluatorId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      passed: passed !== undefined ? passed === 'true' : undefined,
    });
  }

  @Get('evaluations/call/:callId')
  findEvaluationsByCallId(@Param('callId') callId: string) {
    return this.qaService.findEvaluationsByCallId(callId);
  }

  @Get('evaluations/:id')
  findEvaluationById(@Param('id') id: string) {
    return this.qaService.findEvaluationById(id);
  }

  @Put('evaluations/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateEvaluation(@Param('id') id: string, @Body() dto: UpdateEvaluationDto) {
    return this.qaService.updateEvaluation(id, dto);
  }

  @Post('evaluations/:id/acknowledge')
  acknowledgeEvaluation(@Param('id') id: string, @Body() dto: AcknowledgeEvaluationDto) {
    return this.qaService.acknowledgeEvaluation(id, dto.agentFeedback);
  }

  @Post('evaluations/:id/dispute')
  disputeEvaluation(@Param('id') id: string, @Body('feedback') feedback: string) {
    return this.qaService.disputeEvaluation(id, feedback);
  }

  @Delete('evaluations/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  deleteEvaluation(@Param('id') id: string) {
    return this.qaService.deleteEvaluation(id);
  }

  // ==================== Statistics Endpoints ====================

  @Get('stats')
  getQaStats(
    @Query('campaignId') campaignId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.qaService.getQaStats({
      campaignId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('stats/agent/:agentId')
  getAgentQaStats(@Param('agentId') agentId: string, @Query('limit') limit?: string) {
    return this.qaService.getAgentQaStats(agentId, limit ? parseInt(limit, 10) : 10);
  }
}
