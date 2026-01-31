import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProvidersModule } from './providers/providers.module';
import { AgentsModule } from './agents/agents.module';
import { DockerModule } from './docker/docker.module';
import { PhonesModule } from './phones/phones.module';
import { NumbersModule } from './numbers/numbers.module';
import { TrunksModule } from './trunks/trunks.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RecordingsModule } from './recordings/recordings.module';
import { BrandingModule } from './branding/branding.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { CallsModule } from './calls/calls.module';
import { TwilioModule } from './twilio/twilio.module';
import { MonitoringModule } from './monitoring/monitoring.module';
// BPO Dialer modules
import { DispositionsModule } from './dispositions/dispositions.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { LeadsModule } from './leads/leads.module';
import { DialerModule } from './dialer/dialer.module';
import { DncModule } from './dnc/dnc.module';
import { QaModule } from './qa/qa.module';
import { CallerIdModule } from './caller-id/caller-id.module';
import { CrmModule } from './crm/crm.module';
import { ReportsModule } from './reports/reports.module';
import { OrganizationsModule } from './organizations/organizations.module';
// AI & Analytics modules
import { AiCommonModule } from './ai-common/ai-common.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ScoringModule } from './scoring/scoring.module';
import { CoachingModule } from './coaching/coaching.module';
import { SentimentModule } from './sentiment/sentiment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: (process.env.DB_TYPE as 'sqlite') || 'sqlite',
        database: process.env.DB_DATABASE || '/app/data/data.db',
        synchronize: true,
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    UsersModule,
    ProvidersModule,
    AgentsModule,
    DockerModule,
    PhonesModule,
    NumbersModule,
    TrunksModule,
    TwilioModule,
    WebhooksModule,
    RecordingsModule,
    BrandingModule,
    ApiKeysModule,
    CallsModule,
    MonitoringModule,
    // BPO Dialer modules
    DispositionsModule,
    CampaignsModule,
    LeadsModule,
    DialerModule,
    DncModule,
    QaModule,
    CallerIdModule,
    CrmModule,
    ReportsModule,
    OrganizationsModule,
    // AI & Analytics modules
    AiCommonModule,
    AnalyticsModule,
    ScoringModule,
    CoachingModule,
    SentimentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
