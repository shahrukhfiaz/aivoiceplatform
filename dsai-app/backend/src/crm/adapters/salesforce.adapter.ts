import { Injectable, Logger } from '@nestjs/common';
import {
  CrmAdapter,
  CrmRecord,
  CrmObjectMetadata,
  CrmFieldMetadata,
  SyncResult,
  BulkSyncResult,
} from './crm-adapter.interface';
import { CrmConnection } from '../crm-connection.entity';

const SALESFORCE_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const SALESFORCE_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';
const SALESFORCE_SANDBOX_AUTH_URL = 'https://test.salesforce.com/services/oauth2/authorize';
const SALESFORCE_SANDBOX_TOKEN_URL = 'https://test.salesforce.com/services/oauth2/token';

@Injectable()
export class SalesforceAdapter implements CrmAdapter {
  private readonly logger = new Logger(SalesforceAdapter.name);

  private getAuthUrl(sandbox: boolean): string {
    return sandbox ? SALESFORCE_SANDBOX_AUTH_URL : SALESFORCE_AUTH_URL;
  }

  private getTokenUrl(sandbox: boolean): string {
    return sandbox ? SALESFORCE_SANDBOX_TOKEN_URL : SALESFORCE_TOKEN_URL;
  }

  private async makeRequest(
    connection: CrmConnection,
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<Response> {
    const instanceUrl = connection.settings?.instanceUrl;
    if (!instanceUrl) {
      throw new Error('Salesforce instance URL not configured');
    }

    const url = `${instanceUrl}/services/data/v59.0${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return response;
  }

  async testConnection(connection: CrmConnection): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest(connection, 'GET', '/sobjects');
      if (response.ok) {
        return { success: true, message: 'Connected to Salesforce successfully' };
      }
      const error = await response.json();
      return { success: false, message: error.message || 'Connection failed' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async getAuthorizationUrl(connection: CrmConnection, redirectUri: string): Promise<string> {
    const sandbox = connection.settings?.sandbox ?? false;
    const clientId = process.env.SALESFORCE_CLIENT_ID;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId || '',
      redirect_uri: redirectUri,
      scope: 'api refresh_token',
      state: connection.id,
    });

    return `${this.getAuthUrl(sandbox)}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    connection: CrmConnection,
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const sandbox = connection.settings?.sandbox ?? false;
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId || '',
      client_secret: clientSecret || '',
      redirect_uri: redirectUri,
    });

    const response = await fetch(this.getTokenUrl(sandbox), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Token exchange failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.issued_at ? new Date(parseInt(data.issued_at) + 7200000) : undefined, // 2 hours
    };
  }

  async refreshToken(
    connection: CrmConnection,
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    const sandbox = connection.settings?.sandbox ?? false;
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken || '',
      client_id: clientId || '',
      client_secret: clientSecret || '',
    });

    const response = await fetch(this.getTokenUrl(sandbox), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Token refresh failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + 7200000), // 2 hours
    };
  }

  async getAvailableObjects(connection: CrmConnection): Promise<string[]> {
    const response = await this.makeRequest(connection, 'GET', '/sobjects');
    if (!response.ok) {
      throw new Error('Failed to get Salesforce objects');
    }

    const data = await response.json();
    return data.sobjects
      .filter((obj: { createable: boolean }) => obj.createable)
      .map((obj: { name: string }) => obj.name);
  }

  async getObjectMetadata(connection: CrmConnection, objectName: string): Promise<CrmObjectMetadata> {
    const response = await this.makeRequest(connection, 'GET', `/sobjects/${objectName}/describe`);
    if (!response.ok) {
      throw new Error(`Failed to get metadata for ${objectName}`);
    }

    const data = await response.json();

    const fields: CrmFieldMetadata[] = data.fields.map((field: Record<string, unknown>) => ({
      name: field.name as string,
      label: field.label as string,
      type: field.type as string,
      required: !field.nillable && !field.defaultedOnCreate,
      picklistValues: (field.picklistValues as { value: string }[])?.map((p) => p.value),
      referenceTo: (field.referenceTo as string[])?.[0],
    }));

    return {
      name: data.name,
      label: data.label,
      fields,
    };
  }

  async createRecord(
    connection: CrmConnection,
    objectName: string,
    data: CrmRecord,
  ): Promise<SyncResult> {
    try {
      const response = await this.makeRequest(connection, 'POST', `/sobjects/${objectName}`, data);
      const result = await response.json();

      if (response.ok) {
        return { success: true, crmId: result.id, data: result };
      }
      return { success: false, error: result[0]?.message || 'Create failed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async updateRecord(
    connection: CrmConnection,
    objectName: string,
    crmId: string,
    data: CrmRecord,
  ): Promise<SyncResult> {
    try {
      const response = await this.makeRequest(
        connection,
        'PATCH',
        `/sobjects/${objectName}/${crmId}`,
        data,
      );

      if (response.status === 204) {
        return { success: true, crmId };
      }
      const result = await response.json();
      return { success: false, error: result[0]?.message || 'Update failed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async upsertRecord(
    connection: CrmConnection,
    objectName: string,
    externalIdField: string,
    externalIdValue: string,
    data: CrmRecord,
  ): Promise<SyncResult> {
    try {
      const response = await this.makeRequest(
        connection,
        'PATCH',
        `/sobjects/${objectName}/${externalIdField}/${externalIdValue}`,
        data,
      );

      const result = await response.json();
      if (response.ok) {
        return { success: true, crmId: result.id, data: result };
      }
      return { success: false, error: result[0]?.message || 'Upsert failed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async deleteRecord(
    connection: CrmConnection,
    objectName: string,
    crmId: string,
  ): Promise<SyncResult> {
    try {
      const response = await this.makeRequest(
        connection,
        'DELETE',
        `/sobjects/${objectName}/${crmId}`,
      );

      if (response.status === 204) {
        return { success: true, crmId };
      }
      const result = await response.json();
      return { success: false, error: result[0]?.message || 'Delete failed' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async queryRecords(
    connection: CrmConnection,
    objectName: string,
    filters?: Record<string, unknown>,
    fields?: string[],
    limit?: number,
  ): Promise<CrmRecord[]> {
    const selectFields = fields?.join(', ') || 'Id, Name';
    let query = `SELECT ${selectFields} FROM ${objectName}`;

    if (filters && Object.keys(filters).length > 0) {
      const whereClause = Object.entries(filters)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const response = await this.makeRequest(
      connection,
      'GET',
      `/query?q=${encodeURIComponent(query)}`,
    );

    if (!response.ok) {
      throw new Error('Query failed');
    }

    const data = await response.json();
    return data.records;
  }

  async bulkCreate(
    connection: CrmConnection,
    objectName: string,
    records: CrmRecord[],
  ): Promise<BulkSyncResult> {
    const results: SyncResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    // Salesforce Composite API for bulk operations (up to 200 records)
    const batches = this.chunkArray(records, 200);

    for (const batch of batches) {
      try {
        const compositeRequest = {
          allOrNone: false,
          records: batch.map((record) => ({
            attributes: { type: objectName },
            ...record,
          })),
        };

        const response = await this.makeRequest(
          connection,
          'POST',
          `/composite/sobjects`,
          compositeRequest,
        );

        const data = await response.json();

        for (const result of data) {
          if (result.success) {
            results.push({ success: true, crmId: result.id });
            totalSuccess++;
          } else {
            results.push({
              success: false,
              error: result.errors?.[0]?.message || 'Create failed',
            });
            totalFailed++;
          }
        }
      } catch (err) {
        this.logger.error(`Bulk create error: ${err.message}`);
        batch.forEach(() => {
          results.push({ success: false, error: err.message });
          totalFailed++;
        });
      }
    }

    return {
      success: totalFailed === 0,
      totalProcessed: records.length,
      totalSuccess,
      totalFailed,
      results,
    };
  }

  async bulkUpdate(
    connection: CrmConnection,
    objectName: string,
    records: Array<{ id: string; data: CrmRecord }>,
  ): Promise<BulkSyncResult> {
    const results: SyncResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    const batches = this.chunkArray(records, 200);

    for (const batch of batches) {
      try {
        const compositeRequest = {
          allOrNone: false,
          records: batch.map((record) => ({
            attributes: { type: objectName },
            Id: record.id,
            ...record.data,
          })),
        };

        const response = await this.makeRequest(
          connection,
          'PATCH',
          `/composite/sobjects`,
          compositeRequest,
        );

        const data = await response.json();

        for (const result of data) {
          if (result.success) {
            results.push({ success: true, crmId: result.id });
            totalSuccess++;
          } else {
            results.push({
              success: false,
              error: result.errors?.[0]?.message || 'Update failed',
            });
            totalFailed++;
          }
        }
      } catch (err) {
        this.logger.error(`Bulk update error: ${err.message}`);
        batch.forEach(() => {
          results.push({ success: false, error: err.message });
          totalFailed++;
        });
      }
    }

    return {
      success: totalFailed === 0,
      totalProcessed: records.length,
      totalSuccess,
      totalFailed,
      results,
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
