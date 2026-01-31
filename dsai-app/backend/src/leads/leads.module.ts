import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Lead } from './lead.entity';
import { CampaignList } from '../campaigns/campaign-list.entity';
import { Disposition } from '../dispositions/disposition.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, CampaignList, Disposition]),
    forwardRef(() => CampaignsModule),
  ],
  providers: [LeadsService, RolesGuard],
  controllers: [LeadsController],
  exports: [LeadsService],
})
export class LeadsModule {}
