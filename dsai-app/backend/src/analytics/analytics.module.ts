import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallAnalytics } from './entities/call-analytics.entity';
import { KeywordMatch, KeywordConfig } from './entities/keyword-match.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { SpeechMetricsProcessor } from './processors/speech-metrics.processor';
import { KeywordDetectorProcessor } from './processors/keyword-detector.processor';
import { ScriptAdherenceProcessor } from './processors/script-adherence.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallAnalytics, KeywordMatch, KeywordConfig]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    SpeechMetricsProcessor,
    KeywordDetectorProcessor,
    ScriptAdherenceProcessor,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
