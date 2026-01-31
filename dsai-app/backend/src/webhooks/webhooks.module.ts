import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Agent } from '../agents/agent.entity';
import { Call } from './call.entity';
import { CallEvent } from './call-event.entity';
import { OutgoingWebhook, WebhookDeliveryLog } from './outgoing-webhook.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { OutgoingWebhookController } from './outgoing-webhook.controller';
import { OutgoingWebhookService } from './outgoing-webhook.service';
import { CallUpdatesGateway } from './call-updates.gateway';
import { RecordingsModule } from '../recordings/recordings.module';
import { CostsModule } from '../costs/costs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Call, CallEvent, Agent, OutgoingWebhook, WebhookDeliveryLog]),
    RecordingsModule,
    CostsModule,
  ],
  controllers: [WebhooksController, OutgoingWebhookController],
  providers: [WebhooksService, OutgoingWebhookService, CallUpdatesGateway, RolesGuard],
  exports: [WebhooksService, OutgoingWebhookService, CallUpdatesGateway],
})
export class WebhooksModule {}
