import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import {
  OutgoingWebhookService,
  CreateOutgoingWebhookDto,
  UpdateOutgoingWebhookDto,
} from './outgoing-webhook.service';

@Controller('webhooks/outgoing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutgoingWebhookController {
  constructor(private readonly webhookService: OutgoingWebhookService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateOutgoingWebhookDto) {
    return this.webhookService.create(dto);
  }

  @Get()
  async findAll(@Query('organizationId') organizationId?: string) {
    return this.webhookService.findAll(organizationId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.webhookService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOutgoingWebhookDto,
  ) {
    return this.webhookService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    await this.webhookService.delete(id);
    return { success: true };
  }

  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN)
  async toggleActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.webhookService.toggleActive(id, body.isActive);
  }

  @Post(':id/test')
  @Roles(UserRole.ADMIN)
  async testWebhook(@Param('id') id: string) {
    return this.webhookService.testWebhook(id);
  }

  @Get(':id/logs')
  async getDeliveryLogs(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhookService.getDeliveryLogs(id, limit ? parseInt(limit) : 50);
  }

  @Get('logs/recent')
  async getRecentLogs(
    @Query('organizationId') organizationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhookService.getRecentLogs(
      organizationId,
      limit ? parseInt(limit) : 100,
    );
  }
}
