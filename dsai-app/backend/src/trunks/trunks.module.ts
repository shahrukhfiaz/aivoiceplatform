import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { AsteriskModule } from '../asterisk/asterisk.module';
import { Agent } from '../agents/agent.entity';
import { Trunk } from './trunk.entity';
import { TrunksService } from './trunks.service';
import { TrunksController } from './trunks.controller';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trunk, Agent]),
    AsteriskModule,
    forwardRef(() => WebhooksModule),
  ],
  providers: [TrunksService, RolesGuard],
  controllers: [TrunksController],
  exports: [TrunksService],
})
export class TrunksModule {}
