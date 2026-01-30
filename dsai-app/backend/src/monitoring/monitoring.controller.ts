import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { MonitoringService } from './monitoring.service';
import {
  SystemMetricsDto,
  CpuMetricsDto,
  MemoryMetricsDto,
  NetworkMetricsDto,
  DiskMetricsDto,
} from './dto/system-metrics.dto';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('system')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getSystemMetrics(): Promise<SystemMetricsDto> {
    return this.monitoringService.getSystemMetrics();
  }

  @Get('cpu')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getCpuMetrics(): Promise<CpuMetricsDto> {
    return this.monitoringService.getCpuMetrics();
  }

  @Get('memory')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getMemoryMetrics(): Promise<MemoryMetricsDto> {
    return this.monitoringService.getMemoryMetrics();
  }

  @Get('network')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getNetworkMetrics(): Promise<NetworkMetricsDto> {
    return this.monitoringService.getNetworkMetrics();
  }

  @Get('disk')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getDiskMetrics(): Promise<DiskMetricsDto> {
    return this.monitoringService.getDiskMetrics();
  }
}
