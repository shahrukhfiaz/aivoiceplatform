import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmConnection, CrmProvider, ConnectionStatus } from './crm-connection.entity';
import { CrmFieldMapping } from './crm-field-mapping.entity';
import { CrmSyncLog, SyncStatus, SyncOperation } from './crm-sync-log.entity';
import {
  CrmAdapter,
  CrmRecord,
  CrmObjectMetadata,
  SyncResult,
  BulkSyncResult,
} from './adapters/crm-adapter.interface';
import { SalesforceAdapter } from './adapters/salesforce.adapter';
import { HubSpotAdapter } from './adapters/hubspot.adapter';
import { ZohoAdapter } from './adapters/zoho.adapter';
import { v4 as uuidv4 } from 'uuid';

export interface CreateConnectionDto {
  name: string;
  provider: CrmProvider;
  settings?: CrmConnection['settings'];
  apiKey?: string;
}

export interface UpdateConnectionDto {
  name?: string;
  settings?: CrmConnection['settings'];
  syncDirection?: CrmConnection['syncDirection'];
  autoSyncEnabled?: boolean;
  syncIntervalMinutes?: number;
  entityMappings?: CrmConnection['entityMappings'];
}

export interface CreateFieldMappingDto {
  connectionId: string;
  entityType: string;
  localField: string;
  crmField: string;
  direction?: CrmFieldMapping['direction'];
  transform?: CrmFieldMapping['transform'];
  customTransform?: string;
  defaultValue?: string;
  required?: boolean;
}

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(CrmConnection)
    private readonly connectionRepo: Repository<CrmConnection>,
    @InjectRepository(CrmFieldMapping)
    private readonly mappingRepo: Repository<CrmFieldMapping>,
    @InjectRepository(CrmSyncLog)
    private readonly syncLogRepo: Repository<CrmSyncLog>,
    private readonly salesforceAdapter: SalesforceAdapter,
    private readonly hubspotAdapter: HubSpotAdapter,
    private readonly zohoAdapter: ZohoAdapter,
  ) {
    this.initAutoSync();
  }

  // ==================== Connection Management ====================

  async createConnection(dto: CreateConnectionDto): Promise<CrmConnection> {
    const connection = this.connectionRepo.create({
      name: dto.name,
      provider: dto.provider,
      settings: dto.settings,
      apiKey: dto.apiKey,
      status: dto.apiKey ? 'pending_auth' : 'inactive',
    });

    return this.connectionRepo.save(connection);
  }

  async getConnections(): Promise<CrmConnection[]> {
    return this.connectionRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getConnection(id: string): Promise<CrmConnection> {
    const connection = await this.connectionRepo.findOne({
      where: { id },
      relations: ['fieldMappings'],
    });

    if (!connection) {
      throw new NotFoundException('CRM connection not found');
    }

    return connection;
  }

  async updateConnection(id: string, dto: UpdateConnectionDto): Promise<CrmConnection> {
    const connection = await this.getConnection(id);

    if (dto.name !== undefined) connection.name = dto.name;
    if (dto.settings) connection.settings = { ...connection.settings, ...dto.settings };
    if (dto.syncDirection) connection.syncDirection = dto.syncDirection;
    if (dto.autoSyncEnabled !== undefined) connection.autoSyncEnabled = dto.autoSyncEnabled;
    if (dto.syncIntervalMinutes) connection.syncIntervalMinutes = dto.syncIntervalMinutes;
    if (dto.entityMappings) connection.entityMappings = dto.entityMappings;

    const saved = await this.connectionRepo.save(connection);

    // Update auto-sync interval if changed
    if (dto.autoSyncEnabled !== undefined || dto.syncIntervalMinutes) {
      this.updateAutoSync(saved);
    }

    return saved;
  }

  async deleteConnection(id: string): Promise<void> {
    const connection = await this.getConnection(id);
    this.stopAutoSync(id);
    await this.connectionRepo.remove(connection);
  }

  // ==================== OAuth & Authentication ====================

  async getAuthorizationUrl(connectionId: string, redirectUri: string): Promise<string> {
    const connection = await this.getConnection(connectionId);
    const adapter = this.getAdapter(connection.provider);
    return adapter.getAuthorizationUrl(connection, redirectUri);
  }

  async handleOAuthCallback(
    connectionId: string,
    code: string,
    redirectUri: string,
  ): Promise<CrmConnection> {
    const connection = await this.getConnection(connectionId);
    const adapter = this.getAdapter(connection.provider);

    const tokens = await adapter.exchangeCodeForToken(connection, code, redirectUri);

    connection.accessToken = tokens.accessToken;
    connection.refreshToken = tokens.refreshToken;
    connection.tokenExpiresAt = tokens.expiresAt;
    connection.status = 'active';

    return this.connectionRepo.save(connection);
  }

  async refreshConnectionToken(connectionId: string): Promise<CrmConnection> {
    const connection = await this.getConnection(connectionId);

    if (!connection.refreshToken) {
      throw new BadRequestException('No refresh token available');
    }

    const adapter = this.getAdapter(connection.provider);
    const tokens = await adapter.refreshToken(connection);

    connection.accessToken = tokens.accessToken;
    connection.tokenExpiresAt = tokens.expiresAt;

    return this.connectionRepo.save(connection);
  }

  async testConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
    const connection = await this.getConnection(connectionId);
    await this.ensureValidToken(connection);
    const adapter = this.getAdapter(connection.provider);
    return adapter.testConnection(connection);
  }

  // ==================== Field Mapping ====================

  async createFieldMapping(dto: CreateFieldMappingDto): Promise<CrmFieldMapping> {
    const mapping = this.mappingRepo.create(dto);
    return this.mappingRepo.save(mapping);
  }

  async getFieldMappings(connectionId: string, entityType?: string): Promise<CrmFieldMapping[]> {
    const where: Record<string, unknown> = { connectionId };
    if (entityType) where.entityType = entityType;

    return this.mappingRepo.find({ where, order: { createdAt: 'ASC' } });
  }

  async updateFieldMapping(
    id: string,
    dto: Partial<CreateFieldMappingDto>,
  ): Promise<CrmFieldMapping> {
    const mapping = await this.mappingRepo.findOne({ where: { id } });
    if (!mapping) throw new NotFoundException('Field mapping not found');

    Object.assign(mapping, dto);
    return this.mappingRepo.save(mapping);
  }

  async deleteFieldMapping(id: string): Promise<void> {
    const result = await this.mappingRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Field mapping not found');
  }

  async bulkCreateFieldMappings(
    connectionId: string,
    mappings: Omit<CreateFieldMappingDto, 'connectionId'>[],
  ): Promise<CrmFieldMapping[]> {
    const entities = mappings.map((m) =>
      this.mappingRepo.create({ ...m, connectionId }),
    );
    return this.mappingRepo.save(entities);
  }

  // ==================== CRM Metadata ====================

  async getAvailableObjects(connectionId: string): Promise<string[]> {
    const connection = await this.getConnection(connectionId);
    await this.ensureValidToken(connection);
    const adapter = this.getAdapter(connection.provider);
    return adapter.getAvailableObjects(connection);
  }

  async getObjectMetadata(connectionId: string, objectName: string): Promise<CrmObjectMetadata> {
    const connection = await this.getConnection(connectionId);
    await this.ensureValidToken(connection);
    const adapter = this.getAdapter(connection.provider);
    return adapter.getObjectMetadata(connection, objectName);
  }

  // ==================== Data Sync ====================

  async syncRecord(
    connectionId: string,
    entityType: string,
    localRecord: Record<string, unknown>,
    operation: SyncOperation = 'upsert',
    localId?: string,
  ): Promise<SyncResult> {
    const connection = await this.getConnection(connectionId);
    await this.ensureValidToken(connection);

    const adapter = this.getAdapter(connection.provider);
    const mappings = await this.getFieldMappings(connectionId, entityType);

    if (mappings.length === 0) {
      throw new BadRequestException(`No field mappings found for ${entityType}`);
    }

    const crmObject = connection.entityMappings?.[entityType]?.crmObject;
    if (!crmObject) {
      throw new BadRequestException(`No CRM object mapped for ${entityType}`);
    }

    // Transform local record to CRM format
    const crmRecord = this.transformToCrm(localRecord, mappings);

    // Create sync log
    const sessionId = uuidv4();
    const log = await this.createSyncLog({
      connectionId,
      sessionId,
      entityType,
      operation,
      direction: 'to_crm',
      localId,
      status: 'in_progress',
    });

    const startTime = Date.now();

    try {
      let result: SyncResult;

      switch (operation) {
        case 'create':
          result = await adapter.createRecord(connection, crmObject, crmRecord);
          break;
        case 'update':
          if (!localRecord.crmId) {
            throw new BadRequestException('crmId required for update operation');
          }
          result = await adapter.updateRecord(
            connection,
            crmObject,
            localRecord.crmId as string,
            crmRecord,
          );
          break;
        case 'upsert':
          result = await adapter.upsertRecord(
            connection,
            crmObject,
            'DSAI_Id__c', // External ID field
            localId || (localRecord.id as string),
            crmRecord,
          );
          break;
        case 'delete':
          if (!localRecord.crmId) {
            throw new BadRequestException('crmId required for delete operation');
          }
          result = await adapter.deleteRecord(
            connection,
            crmObject,
            localRecord.crmId as string,
          );
          break;
      }

      // Update log
      await this.updateSyncLog(log.id, {
        status: result.success ? 'completed' : 'failed',
        crmId: result.crmId,
        recordsProcessed: 1,
        recordsSuccess: result.success ? 1 : 0,
        recordsFailed: result.success ? 0 : 1,
        errorMessage: result.error,
        responsePayload: result.data as Record<string, unknown>,
        durationMs: Date.now() - startTime,
      });

      // Update connection stats
      await this.updateConnectionStats(connectionId, result.success);

      return result;
    } catch (err) {
      await this.updateSyncLog(log.id, {
        status: 'failed',
        errorMessage: err.message,
        durationMs: Date.now() - startTime,
      });
      throw err;
    }
  }

  async bulkSyncRecords(
    connectionId: string,
    entityType: string,
    records: Array<{ id: string; data: Record<string, unknown> }>,
    operation: 'create' | 'update' = 'create',
  ): Promise<BulkSyncResult> {
    const connection = await this.getConnection(connectionId);
    await this.ensureValidToken(connection);

    const adapter = this.getAdapter(connection.provider);
    const mappings = await this.getFieldMappings(connectionId, entityType);

    if (mappings.length === 0) {
      throw new BadRequestException(`No field mappings found for ${entityType}`);
    }

    const crmObject = connection.entityMappings?.[entityType]?.crmObject;
    if (!crmObject) {
      throw new BadRequestException(`No CRM object mapped for ${entityType}`);
    }

    // Transform all records
    const crmRecords = records.map((r) => ({
      id: r.id,
      data: this.transformToCrm(r.data, mappings),
    }));

    // Create session log
    const sessionId = uuidv4();
    const log = await this.createSyncLog({
      connectionId,
      sessionId,
      entityType,
      operation,
      direction: 'to_crm',
      status: 'in_progress',
    });

    const startTime = Date.now();

    try {
      let result: BulkSyncResult;

      if (operation === 'create') {
        result = await adapter.bulkCreate(
          connection,
          crmObject,
          crmRecords.map((r) => r.data),
        );
      } else {
        result = await adapter.bulkUpdate(
          connection,
          crmObject,
          crmRecords.map((r) => ({ id: r.id, data: r.data })),
        );
      }

      await this.updateSyncLog(log.id, {
        status: result.success ? 'completed' : 'partial',
        recordsProcessed: result.totalProcessed,
        recordsSuccess: result.totalSuccess,
        recordsFailed: result.totalFailed,
        errorMessage: result.errors?.join('; '),
        durationMs: Date.now() - startTime,
      });

      // Update connection stats
      connection.totalSynced += result.totalSuccess;
      connection.syncErrors += result.totalFailed;
      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = result.success ? 'success' : 'partial';
      await this.connectionRepo.save(connection);

      return result;
    } catch (err) {
      await this.updateSyncLog(log.id, {
        status: 'failed',
        errorMessage: err.message,
        durationMs: Date.now() - startTime,
      });
      throw err;
    }
  }

  // ==================== Sync Logs ====================

  async getSyncLogs(
    connectionId: string,
    limit: number = 100,
  ): Promise<CrmSyncLog[]> {
    return this.syncLogRepo.find({
      where: { connectionId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getSyncStats(connectionId: string): Promise<{
    totalSynced: number;
    totalErrors: number;
    lastSyncAt: Date | null;
    recentLogs: CrmSyncLog[];
    dailyStats: { date: string; success: number; failed: number }[];
  }> {
    const connection = await this.getConnection(connectionId);
    const recentLogs = await this.getSyncLogs(connectionId, 10);

    // Get daily stats for last 7 days
    const dailyStats = await this.syncLogRepo
      .createQueryBuilder('log')
      .select("DATE(log.createdAt)", 'date')
      .addSelect('SUM(log.recordsSuccess)', 'success')
      .addSelect('SUM(log.recordsFailed)', 'failed')
      .where('log.connectionId = :connectionId', { connectionId })
      .andWhere('log.createdAt >= :startDate', {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      })
      .groupBy("DATE(log.createdAt)")
      .getRawMany();

    return {
      totalSynced: connection.totalSynced,
      totalErrors: connection.syncErrors,
      lastSyncAt: connection.lastSyncAt || null,
      recentLogs,
      dailyStats,
    };
  }

  // ==================== Private Helpers ====================

  private getAdapter(provider: CrmProvider): CrmAdapter {
    switch (provider) {
      case 'salesforce':
        return this.salesforceAdapter;
      case 'hubspot':
        return this.hubspotAdapter;
      case 'zoho':
        return this.zohoAdapter;
      default:
        throw new BadRequestException(`Unsupported CRM provider: ${provider}`);
    }
  }

  private async ensureValidToken(connection: CrmConnection): Promise<void> {
    if (!connection.accessToken) {
      throw new BadRequestException('Connection not authenticated');
    }

    // Check if token is expired (with 5 min buffer)
    if (connection.tokenExpiresAt) {
      const expiresAt = new Date(connection.tokenExpiresAt);
      if (expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
        if (connection.refreshToken) {
          await this.refreshConnectionToken(connection.id);
        } else {
          throw new BadRequestException('Token expired and no refresh token available');
        }
      }
    }
  }

  private transformToCrm(
    localRecord: Record<string, unknown>,
    mappings: CrmFieldMapping[],
  ): CrmRecord {
    const crmRecord: CrmRecord = {};

    for (const mapping of mappings) {
      if (!mapping.isActive || mapping.direction === 'from_crm') continue;

      let value = localRecord[mapping.localField];

      // Apply default value if source is empty
      if (value === undefined || value === null || value === '') {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        } else if (mapping.required) {
          continue; // Skip required fields with no value
        } else {
          continue;
        }
      }

      // Apply transformation
      value = this.applyTransform(value, mapping.transform, mapping.customTransform);

      crmRecord[mapping.crmField] = value;
    }

    return crmRecord;
  }

  private applyTransform(
    value: unknown,
    transform: CrmFieldMapping['transform'],
    customTransform?: string,
  ): unknown {
    if (value === null || value === undefined) return value;

    switch (transform) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'date_format':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return value;
      case 'phone_format':
        // Remove non-numeric characters and format
        if (typeof value === 'string') {
          const digits = value.replace(/\D/g, '');
          if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
          }
          return digits;
        }
        return value;
      case 'custom':
        // Simple expression evaluation (for advanced users)
        if (customTransform) {
          try {
            // Very basic - just supports direct field references
            return value;
          } catch {
            return value;
          }
        }
        return value;
      default:
        return value;
    }
  }

  private async createSyncLog(data: Partial<CrmSyncLog>): Promise<CrmSyncLog> {
    const log = this.syncLogRepo.create({
      ...data,
      startedAt: new Date(),
    });
    return this.syncLogRepo.save(log);
  }

  private async updateSyncLog(
    id: string,
    data: Partial<CrmSyncLog>,
  ): Promise<void> {
    await this.syncLogRepo.update(id, {
      ...data,
      completedAt: new Date(),
    });
  }

  private async updateConnectionStats(
    connectionId: string,
    success: boolean,
  ): Promise<void> {
    const connection = await this.connectionRepo.findOne({ where: { id: connectionId } });
    if (connection) {
      if (success) {
        connection.totalSynced++;
      } else {
        connection.syncErrors++;
      }
      connection.lastSyncAt = new Date();
      connection.lastSyncStatus = success ? 'success' : 'error';
      await this.connectionRepo.save(connection);
    }
  }

  // ==================== Auto-Sync ====================

  private async initAutoSync(): Promise<void> {
    const connections = await this.connectionRepo.find({
      where: { autoSyncEnabled: true, status: 'active' },
    });

    for (const connection of connections) {
      this.startAutoSync(connection);
    }
  }

  private startAutoSync(connection: CrmConnection): void {
    if (this.syncIntervals.has(connection.id)) {
      return;
    }

    const intervalMs = connection.syncIntervalMinutes * 60 * 1000;
    const interval = setInterval(
      () => this.runAutoSync(connection.id),
      intervalMs,
    );

    this.syncIntervals.set(connection.id, interval);
    this.logger.log(`Started auto-sync for connection ${connection.name} (every ${connection.syncIntervalMinutes} min)`);
  }

  private stopAutoSync(connectionId: string): void {
    const interval = this.syncIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(connectionId);
    }
  }

  private updateAutoSync(connection: CrmConnection): void {
    this.stopAutoSync(connection.id);
    if (connection.autoSyncEnabled && connection.status === 'active') {
      this.startAutoSync(connection);
    }
  }

  private async runAutoSync(connectionId: string): Promise<void> {
    this.logger.debug(`Running auto-sync for connection ${connectionId}`);
    // Auto-sync logic would go here
    // This would pull from configured data sources and sync to CRM
  }
}
