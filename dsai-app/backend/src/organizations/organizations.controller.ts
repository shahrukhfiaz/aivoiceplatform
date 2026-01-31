import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import {
  OrganizationsService,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './organizations.service';
import { PlanType } from './organization.entity';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  // ==================== Organization CRUD ====================

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateOrganizationDto) {
    return this.orgsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll() {
    return this.orgsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.orgsService.findById(id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.orgsService.findBySlug(slug);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    await this.orgsService.delete(id);
    return { success: true };
  }

  // ==================== Plan Management ====================

  @Patch(':id/plan')
  @Roles(UserRole.ADMIN)
  async updatePlan(
    @Param('id') id: string,
    @Body() body: { plan: PlanType },
  ) {
    return this.orgsService.updatePlan(id, body.plan);
  }

  @Post(':id/suspend')
  @Roles(UserRole.ADMIN)
  async suspend(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.orgsService.suspendOrganization(id, body.reason);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.ADMIN)
  async reactivate(@Param('id') id: string) {
    return this.orgsService.reactivateOrganization(id);
  }

  // ==================== Usage & Limits ====================

  @Get(':id/usage')
  async getUsageStats(@Param('id') id: string) {
    return this.orgsService.getUsageStats(id);
  }

  @Get(':id/limits/:limitType')
  async checkLimit(
    @Param('id') id: string,
    @Param('limitType') limitType: string,
  ) {
    return this.orgsService.checkLimit(id, limitType as keyof typeof import('./organization.entity').PLAN_LIMITS['free']);
  }

  // ==================== Admin Operations ====================

  @Post('reset-monthly-usage')
  @Roles(UserRole.ADMIN)
  async resetMonthlyUsage() {
    await this.orgsService.resetMonthlyUsage();
    return { success: true, message: 'Monthly usage reset for all organizations' };
  }
}
