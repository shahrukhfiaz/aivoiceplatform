import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { LlmGatewayService } from './services/llm-gateway.service';
import { AiCostTrackerService } from './services/ai-cost-tracker.service';
import { AiCommonController } from './ai-common.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AiUsageLog]),
    ConfigModule,
  ],
  controllers: [AiCommonController],
  providers: [LlmGatewayService, AiCostTrackerService],
  exports: [LlmGatewayService, AiCostTrackerService],
})
export class AiCommonModule {}
