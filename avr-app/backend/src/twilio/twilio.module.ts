import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../agents/agent.entity';
import { AgentsModule } from '../agents/agents.module';
import { RolesGuard } from '../auth/roles.guard';
import { EncryptionService } from '../common/encryption.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TrunksModule } from '../trunks/trunks.module';
import { Trunk } from '../trunks/trunk.entity';
import { TwilioNumber } from './twilio-number.entity';
import { TwilioController } from './twilio.controller';
import { TwilioService } from './twilio.service';
import { TwilioCallService } from './twilio-call.service';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { TwilioMediaStreamGateway } from './twilio-media-stream.gateway';
import { TwilioTrunkService } from './twilio-trunk.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TwilioNumber, Agent, Trunk]),
    forwardRef(() => WebhooksModule),
    forwardRef(() => AgentsModule),
    forwardRef(() => TrunksModule),
  ],
  providers: [TwilioService, TwilioCallService, TwilioMediaStreamGateway, TwilioTrunkService, EncryptionService, RolesGuard],
  controllers: [TwilioController, TwilioWebhookController],
  exports: [TwilioService, TwilioCallService, TwilioMediaStreamGateway, TwilioTrunkService],
})
export class TwilioModule {}
