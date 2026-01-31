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
  CrmService,
  CreateConnectionDto,
  UpdateConnectionDto,
  CreateFieldMappingDto,
} from './crm.service';
import { CrmSyncLog, SyncOperation } from './crm-sync-log.entity';

@Controller('crm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ==================== Connection Endpoints ====================

  @Post('connections')
  @Roles(UserRole.ADMIN)
  async createConnection(@Body() dto: CreateConnectionDto) {
    return this.crmService.createConnection(dto);
  }

  @Get('connections')
  async getConnections() {
    return this.crmService.getConnections();
  }

  @Get('connections/:id')
  async getConnection(@Param('id') id: string) {
    return this.crmService.getConnection(id);
  }

  @Patch('connections/:id')
  @Roles(UserRole.ADMIN)
  async updateConnection(
    @Param('id') id: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.crmService.updateConnection(id, dto);
  }

  @Delete('connections/:id')
  @Roles(UserRole.ADMIN)
  async deleteConnection(@Param('id') id: string) {
    await this.crmService.deleteConnection(id);
    return { success: true };
  }

  // ==================== OAuth Endpoints ====================

  @Get('connections/:id/auth-url')
  @Roles(UserRole.ADMIN)
  async getAuthUrl(
    @Param('id') id: string,
    @Query('redirectUri') redirectUri: string,
  ) {
    const url = await this.crmService.getAuthorizationUrl(id, redirectUri);
    return { url };
  }

  @Post('connections/:id/oauth-callback')
  @Roles(UserRole.ADMIN)
  async handleOAuthCallback(
    @Param('id') id: string,
    @Body() body: { code: string; redirectUri: string },
  ) {
    return this.crmService.handleOAuthCallback(id, body.code, body.redirectUri);
  }

  @Post('connections/:id/refresh-token')
  @Roles(UserRole.ADMIN)
  async refreshToken(@Param('id') id: string) {
    return this.crmService.refreshConnectionToken(id);
  }

  @Post('connections/:id/test')
  @Roles(UserRole.ADMIN)
  async testConnection(@Param('id') id: string) {
    return this.crmService.testConnection(id);
  }

  // ==================== Field Mapping Endpoints ====================

  @Post('field-mappings')
  @Roles(UserRole.ADMIN)
  async createFieldMapping(@Body() dto: CreateFieldMappingDto) {
    return this.crmService.createFieldMapping(dto);
  }

  @Get('connections/:connectionId/field-mappings')
  async getFieldMappings(
    @Param('connectionId') connectionId: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.crmService.getFieldMappings(connectionId, entityType);
  }

  @Patch('field-mappings/:id')
  @Roles(UserRole.ADMIN)
  async updateFieldMapping(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFieldMappingDto>,
  ) {
    return this.crmService.updateFieldMapping(id, dto);
  }

  @Delete('field-mappings/:id')
  @Roles(UserRole.ADMIN)
  async deleteFieldMapping(@Param('id') id: string) {
    await this.crmService.deleteFieldMapping(id);
    return { success: true };
  }

  @Post('connections/:connectionId/field-mappings/bulk')
  @Roles(UserRole.ADMIN)
  async bulkCreateFieldMappings(
    @Param('connectionId') connectionId: string,
    @Body() body: { mappings: Omit<CreateFieldMappingDto, 'connectionId'>[] },
  ) {
    return this.crmService.bulkCreateFieldMappings(connectionId, body.mappings);
  }

  // ==================== CRM Metadata Endpoints ====================

  @Get('connections/:id/objects')
  async getAvailableObjects(@Param('id') id: string) {
    const objects = await this.crmService.getAvailableObjects(id);
    return { objects };
  }

  @Get('connections/:id/objects/:objectName/metadata')
  async getObjectMetadata(
    @Param('id') id: string,
    @Param('objectName') objectName: string,
  ) {
    return this.crmService.getObjectMetadata(id, objectName);
  }

  // ==================== Sync Endpoints ====================

  @Post('connections/:id/sync')
  @Roles(UserRole.ADMIN)
  async syncRecord(
    @Param('id') connectionId: string,
    @Body() body: {
      entityType: string;
      record: Record<string, unknown>;
      operation?: SyncOperation;
      localId?: string;
    },
  ) {
    return this.crmService.syncRecord(
      connectionId,
      body.entityType,
      body.record,
      body.operation || 'upsert',
      body.localId,
    );
  }

  @Post('connections/:id/sync/bulk')
  @Roles(UserRole.ADMIN)
  async bulkSyncRecords(
    @Param('id') connectionId: string,
    @Body() body: {
      entityType: string;
      records: Array<{ id: string; data: Record<string, unknown> }>;
      operation?: 'create' | 'update';
    },
  ) {
    return this.crmService.bulkSyncRecords(
      connectionId,
      body.entityType,
      body.records,
      body.operation || 'create',
    );
  }

  // ==================== Sync Logs Endpoints ====================

  @Get('connections/:id/sync-logs')
  async getSyncLogs(
    @Param('id') connectionId: string,
    @Query('limit') limit?: string,
  ): Promise<CrmSyncLog[]> {
    return this.crmService.getSyncLogs(connectionId, limit ? parseInt(limit) : 100);
  }

  @Get('connections/:id/sync-stats')
  async getSyncStats(@Param('id') connectionId: string) {
    return this.crmService.getSyncStats(connectionId);
  }
}
