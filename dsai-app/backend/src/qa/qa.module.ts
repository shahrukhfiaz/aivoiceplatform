import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QaScorecard } from './qa-scorecard.entity';
import { QaEvaluation } from './qa-evaluation.entity';
import { QaService } from './qa.service';
import { QaController } from './qa.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([QaScorecard, QaEvaluation])],
  providers: [QaService, RolesGuard],
  controllers: [QaController],
  exports: [QaService],
})
export class QaModule implements OnModuleInit {
  constructor(private readonly qaService: QaService) {}

  async onModuleInit() {
    // Seed default scorecard if none exists
    await this.qaService.seedDefaultScorecard();
  }
}
