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

const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_API_URL = 'https://www.zohoapis.com/crm/v2';

@Injectable()
export class ZohoAdapter implements CrmAdapter {
  private readonly logger = new Logger(ZohoAdapter.name);

  private async makeRequest(
    connection: CrmConnection,
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<Response> {
    const url = `${ZOHO_API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${connection.accessToken}`,
      'Content-Type': 'application/json',
    };

    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async testConnection(connection: CrmConnection): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest(connection, 'GET', '/users?type=CurrentUser');
      if (response.ok) {
        return { success: true, message: 'Connected to Zoho CRM successfully' };
      }
      const error = await response.json();
      return { success: false, message: error.message || 'Connection failed' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async getAuthorizationUrl(connection: CrmConnection, redirectUri: string): Promise<string> {
    const clientId = process.env.ZOHO_CLIENT_ID;

    const scopes = [
      'ZohoCRM.modules.ALL',
      'ZohoCRM.settings.ALL',
      'ZohoCRM.users.READ',
    ].join(',');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId || '',
      redirect_uri: redirectUri,
      scope: scopes,
      access_type: 'offline',
      state: connection.id,
    });

    return `${ZOHO_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    connection: CrmConnection,
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId || '',
      client_secret: clientSecret || '',
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Token exchange failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
  }

  async refreshToken(
    connection: CrmConnection,
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId || '',
      client_secret: clientSecret || '',
      refresh_token: connection.refreshToken || '',
    });

    const response = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Token refresh failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
  }

  async getAvailableObjects(connection: CrmConnection): Promise<string[]> {
    const response = await this.makeRequest(connection, 'GET', '/settings/modules');
    if (!response.ok) {
      throw new Error('Failed to get Zoho modules');
    }

    const data = await response.json();
    return data.modules
      .filter((mod: { api_supported: boolean }) => mod.api_supported)
      .map((mod: { api_name: string }) => mod.api_name);
  }

  async getObjectMetadata(connection: CrmConnection, objectName: string): Promise<CrmObjectMetadata> {
    const response = await this.makeRequest(
      connection,
      'GET',
      `/settings/fields?module=${objectName}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get metadata for ${objectName}`);
    }

    const data = await response.json();

    const fields: CrmFieldMetadata[] = data.fields.map((field: Record<string, unknown>) => ({
      name: field.api_name as string,
      label: field.display_label as string,
      type: field.data_type as string,
      required: field.system_mandatory as boolean,
      picklistValues: (field.pick_list_values as { actual_value: string }[])?.map((p) => p.actual_value),
    }));

    return {
      name: objectName,
      label: objectName,
      fields,
    };
  }

  async createRecord(
    connection: CrmConnection,
    objectName: string,
    data: CrmRecord,
  ): Promise<SyncResult> {
    try {
      const response = await this.makeRequest(
        connection,
        'POST',
        `/${objectName}`,
        { data: [data] },
      );

      const result = await response.json();

      if (result.data && result.data[0]?.status === 'success') {
        return {
          success: true,
          crmId: result.data[0].details.id,
          data: result.data[0],
        };
      }
      return {
        success: false,
        error: result.data?.[0]?.message || result.message || 'Create failed',
      };
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
        'PUT',
        `/${objectName}/${crmId}`,
        { data: [data] },
      );

      const result = await response.json();

      if (result.data && result.data[0]?.status === 'success') {
        return { success: true, crmId, data: result.data[0] };
      }
      return {
        success: false,
        error: result.data?.[0]?.message || result.message || 'Update failed',
      };
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
      // Zoho supports upsert with duplicate check
      const response = await this.makeRequest(
        connection,
        'POST',
        `/${objectName}/upsert`,
        {
          data: [{ ...data, [externalIdField]: externalIdValue }],
          duplicate_check_fields: [externalIdField],
        },
      );

      const result = await response.json();

      if (result.data && result.data[0]?.status === 'success') {
        return {
          success: true,
          crmId: result.data[0].details.id,
          data: result.data[0],
        };
      }
      return {
        success: false,
        error: result.data?.[0]?.message || result.message || 'Upsert failed',
      };
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
        `/${objectName}?ids=${crmId}`,
      );

      const result = await response.json();

      if (result.data && result.data[0]?.status === 'success') {
        return { success: true, crmId };
      }
      return {
        success: false,
        error: result.data?.[0]?.message || result.message || 'Delete failed',
      };
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
    let endpoint = `/${objectName}`;
    const params = new URLSearchParams();

    if (fields && fields.length > 0) {
      params.append('fields', fields.join(','));
    }
    if (limit) {
      params.append('per_page', limit.toString());
    }

    // Zoho uses COQL for complex queries
    if (filters && Object.keys(filters).length > 0) {
      const selectFields = fields?.join(', ') || 'id, Full_Name';
      const whereClause = Object.entries(filters)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' and ');
      const query = `select ${selectFields} from ${objectName} where ${whereClause} limit ${limit || 100}`;

      const searchResponse = await this.makeRequest(
        connection,
        'POST',
        '/coql',
        { select_query: query },
      );

      const searchResult = await searchResponse.json();
      return searchResult.data || [];
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const response = await this.makeRequest(connection, 'GET', endpoint);
    const data = await response.json();
    return data.data || [];
  }

  async bulkCreate(
    connection: CrmConnection,
    objectName: string,
    records: CrmRecord[],
  ): Promise<BulkSyncResult> {
    const results: SyncResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    // Zoho accepts up to 100 records per batch
    const batches = this.chunkArray(records, 100);

    for (const batch of batches) {
      try {
        const response = await this.makeRequest(
          connection,
          'POST',
          `/${objectName}`,
          { data: batch },
        );

        const data = await response.json();

        if (data.data) {
          for (const result of data.data) {
            if (result.status === 'success') {
              results.push({ success: true, crmId: result.details.id, data: result });
              totalSuccess++;
            } else {
              results.push({ success: false, error: result.message });
              totalFailed++;
            }
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

    const batches = this.chunkArray(records, 100);

    for (const batch of batches) {
      try {
        const response = await this.makeRequest(
          connection,
          'PUT',
          `/${objectName}`,
          {
            data: batch.map((record) => ({
              id: record.id,
              ...record.data,
            })),
          },
        );

        const data = await response.json();

        if (data.data) {
          for (const result of data.data) {
            if (result.status === 'success') {
              results.push({ success: true, crmId: result.details.id, data: result });
              totalSuccess++;
            } else {
              results.push({ success: false, error: result.message });
              totalFailed++;
            }
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
