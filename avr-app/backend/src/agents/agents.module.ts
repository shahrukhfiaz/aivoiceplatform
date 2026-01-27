import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../docker/docker.module';
import { AsteriskModule } from '../asterisk/asterisk.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { RolesGuard } from '../auth/roles.guard';
import { Provider } from '../providers/provider.entity';
import { Trunk } from '../trunks/trunk.entity';
import { Agent } from './agent.entity';
import { AgentsService } from './agents.service';
import { AgentsController, InternalAgentsController } from './agents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Provider, Trunk]),
    DockerModule,
    AsteriskModule,
    forwardRef(() => WebhooksModule),
  ],
  providers: [AgentsService, RolesGuard],
  controllers: [AgentsController, InternalAgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
