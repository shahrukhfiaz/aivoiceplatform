import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallSentiment } from './entities/call-sentiment.entity';
import { UtteranceSentiment } from './entities/utterance-sentiment.entity';
import { SentimentService } from './sentiment.service';
import { SentimentController } from './sentiment.controller';
import { LlmSentimentAnalyzer } from './analyzers/llm-sentiment.analyzer';

@Module({
  imports: [TypeOrmModule.forFeature([CallSentiment, UtteranceSentiment])],
  controllers: [SentimentController],
  providers: [SentimentService, LlmSentimentAnalyzer],
  exports: [SentimentService],
})
export class SentimentModule {}
