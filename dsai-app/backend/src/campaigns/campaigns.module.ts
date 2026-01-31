import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Agent } from '../agents/agent.entity';
import { Trunk } from '../trunks/trunk.entity';
import { Campaign } from './campaign.entity';
import { CampaignList } from './campaign-list.entity';
import { Lead } from '../leads/lead.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignList, Lead, Agent, Trunk]),
    forwardRef(() => WebhooksModule),
  ],
  providers: [CampaignsService, RolesGuard],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
