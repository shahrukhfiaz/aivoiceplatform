import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Disposition } from './disposition.entity';
import { DispositionsService } from './dispositions.service';
import { DispositionsController } from './dispositions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Disposition])],
  providers: [DispositionsService, RolesGuard],
  controllers: [DispositionsController],
  exports: [DispositionsService],
})
export class DispositionsModule {}
