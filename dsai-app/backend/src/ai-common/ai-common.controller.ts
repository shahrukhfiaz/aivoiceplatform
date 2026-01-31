import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AiCostTrackerService } from './services/ai-cost-tracker.service';
import { LlmGatewayService } from './services/llm-gateway.service';
import { AiFeatureType } from './entities/ai-usage-log.entity';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiCommonController {
  constructor(
    private readonly costTracker: AiCostTrackerService,
    private readonly llmGateway: LlmGatewayService,
  ) {}

  @Get('usage/summary')
  @Roles(UserRole.ADMIN)
  async getUsageSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('organizationId') organizationId?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.costTracker.getUsageSummary({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      organizationId,
      campaignId,
    });
  }

  @Get('usage/daily')
  @Roles(UserRole.ADMIN)
  async getDailyCosts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.costTracker.getDailyCosts({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      organizationId,
    });
  }

  @Get('usage/logs')
  @Roles(UserRole.ADMIN)
  async getRecentLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('featureType') featureType?: AiFeatureType,
    @Query('organizationId') organizationId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('success') success?: string,
  ) {
    return this.costTracker.getRecentLogs({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      featureType,
      organizationId,
      campaignId,
      success: success !== undefined ? success === 'true' : undefined,
    });
  }

  @Get('usage/estimate')
  async getEstimatedCost(
    @Query('featureType') featureType: AiFeatureType,
    @Query('organizationId') organizationId?: string,
  ) {
    const avgCost = await this.costTracker.getEstimatedCostPerCall(
      featureType,
      organizationId,
    );
    return { featureType, estimatedCostPerCall: avgCost };
  }

  @Get('providers')
  async getAvailableProviders() {
    const providers = this.llmGateway.getAvailableProviders();
    return {
      providers,
      models: providers.reduce(
        (acc, provider) => ({
          ...acc,
          [provider]: this.llmGateway.getAvailableModels(provider),
        }),
        {},
      ),
    };
  }
}
