import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallerIdPool } from './caller-id-pool.entity';
import { CallerIdNumber } from './caller-id-number.entity';
import { CallerIdUsageLog } from './caller-id-usage-log.entity';
import { CallerIdReputationEvent } from './caller-id-reputation-event.entity';
import { CallerIdService } from './caller-id.service';
import { CallerIdController } from './caller-id.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CallerIdPool,
      CallerIdNumber,
      CallerIdUsageLog,
      CallerIdReputationEvent,
    ]),
  ],
  providers: [CallerIdService],
  controllers: [CallerIdController],
  exports: [CallerIdService],
})
export class CallerIdModule {}
