import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Campaign } from '../campaigns/campaign.entity';
import { CampaignList } from '../campaigns/campaign-list.entity';
import { Lead } from '../leads/lead.entity';
import { Agent } from '../agents/agent.entity';
import { DialerService } from './dialer.service';
import { DialerController } from './dialer.controller';
import { AmdService } from './amd.service';
import { AgentsModule } from '../agents/agents.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { DncModule } from '../dnc/dnc.module';
import { CallerIdModule } from '../caller-id/caller-id.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignList, Lead, Agent]),
    forwardRef(() => AgentsModule),
    forwardRef(() => CampaignsModule),
    forwardRef(() => WebhooksModule),
    DncModule,
    CallerIdModule,
  ],
  providers: [DialerService, AmdService, RolesGuard],
  controllers: [DialerController],
  exports: [DialerService, AmdService],
})
export class DialerModule {}
