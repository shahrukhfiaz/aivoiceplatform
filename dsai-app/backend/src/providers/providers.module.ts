import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { ProvidersService } from './providers.service';
import { ProvidersController, InternalProvidersController } from './providers.controller';
import { Provider } from './provider.entity';
import { Agent } from '../agents/agent.entity';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Provider, Agent]),
    forwardRef(() => WebhooksModule),
  ],
  providers: [ProvidersService, RolesGuard],
  controllers: [ProvidersController, InternalProvidersController],
  exports: [ProvidersService],
})
export class ProvidersModule {}
