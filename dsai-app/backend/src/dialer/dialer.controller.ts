import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { DialerService, DialerStats } from './dialer.service';

@Controller('dialer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DialerController {
  constructor(private readonly dialerService: DialerService) {}

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  getAllActiveStats(): Promise<DialerStats[]> {
    return this.dialerService.getAllActiveStats();
  }

  @Get('status/:campaignId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  getStats(@Param('campaignId') campaignId: string): Promise<DialerStats> {
    return this.dialerService.getStats(campaignId);
  }

  @Post('start/:campaignId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async start(@Param('campaignId') campaignId: string): Promise<{ success: true }> {
    await this.dialerService.startCampaign(campaignId);
    return { success: true };
  }

  @Post('stop/:campaignId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async stop(@Param('campaignId') campaignId: string): Promise<{ success: true }> {
    await this.dialerService.stopCampaign(campaignId);
    return { success: true };
  }
}
