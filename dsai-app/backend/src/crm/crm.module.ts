import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmConnection } from './crm-connection.entity';
import { CrmFieldMapping } from './crm-field-mapping.entity';
import { CrmSyncLog } from './crm-sync-log.entity';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { SalesforceAdapter } from './adapters/salesforce.adapter';
import { HubSpotAdapter } from './adapters/hubspot.adapter';
import { ZohoAdapter } from './adapters/zoho.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([CrmConnection, CrmFieldMapping, CrmSyncLog]),
  ],
  providers: [
    CrmService,
    SalesforceAdapter,
    HubSpotAdapter,
    ZohoAdapter,
  ],
  controllers: [CrmController],
  exports: [CrmService],
})
export class CrmModule {}
