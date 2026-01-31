import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiEvaluation } from './entities/ai-evaluation.entity';
import {
  CoachingInsight,
  TrainingRecommendation,
} from './entities/coaching-insight.entity';
import { CoachingService } from './coaching.service';
import { CoachingController } from './coaching.controller';
import { LlmEvaluator } from './evaluators/llm-evaluator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiEvaluation,
      CoachingInsight,
      TrainingRecommendation,
    ]),
  ],
  controllers: [CoachingController],
  providers: [CoachingService, LlmEvaluator],
  exports: [CoachingService],
})
export class CoachingModule {}
