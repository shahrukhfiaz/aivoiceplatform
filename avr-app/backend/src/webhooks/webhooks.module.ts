import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Agent } from '../agents/agent.entity';
import { Call } from './call.entity';
import { CallEvent } from './call-event.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { RecordingsModule } from '../recordings/recordings.module';
import { CostsModule } from '../costs/costs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Call, CallEvent, Agent]),
    RecordingsModule,
    CostsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, RolesGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
