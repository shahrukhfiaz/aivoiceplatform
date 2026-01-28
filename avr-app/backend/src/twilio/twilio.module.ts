import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../agents/agent.entity';
import { AgentsModule } from '../agents/agents.module';
import { RolesGuard } from '../auth/roles.guard';
import { EncryptionService } from '../common/encryption.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TwilioNumber } from './twilio-number.entity';
import { TwilioController } from './twilio.controller';
import { TwilioService } from './twilio.service';
import { TwilioCallService } from './twilio-call.service';
import { TwilioWebhookController } from './twilio-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TwilioNumber, Agent]),
    forwardRef(() => WebhooksModule),
    forwardRef(() => AgentsModule),
  ],
  providers: [TwilioService, TwilioCallService, EncryptionService, RolesGuard],
  controllers: [TwilioController, TwilioWebhookController],
  exports: [TwilioService, TwilioCallService],
})
export class TwilioModule {}
