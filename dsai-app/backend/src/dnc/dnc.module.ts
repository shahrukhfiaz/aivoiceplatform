import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DncEntry } from './dnc-entry.entity';
import { DncService } from './dnc.service';
import { DncController } from './dnc.controller';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DncEntry]),
    WebhooksModule,
  ],
  controllers: [DncController],
  providers: [DncService],
  exports: [DncService],
})
export class DncModule {}
