import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { AsteriskModule } from '../asterisk/asterisk.module';
import { Agent } from '../agents/agent.entity';
import { Trunk } from './trunk.entity';
import { TrunksService } from './trunks.service';
import { TrunksController } from './trunks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Trunk, Agent]), AsteriskModule],
  providers: [TrunksService, RolesGuard],
  controllers: [TrunksController],
  exports: [TrunksService],
})
export class TrunksModule {}
