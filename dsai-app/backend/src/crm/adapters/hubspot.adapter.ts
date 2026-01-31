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

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const HUBSPOT_API_URL = 'https://api.hubapi.com';

@Injectable()
export class HubSpotAdapter implements CrmAdapter {
  private readonly logger = new Logger(HubSpotAdapter.name);

  private async makeRequest(
    connection: CrmConnection,
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<Response> {
    const url = `${HUBSPOT_API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // HubSpot supports both OAuth and API key
    if (connection.accessToken) {
      headers.Authorization = `Bearer ${connection.accessToken}`;
    } else if (connection.apiKey) {
      // API key auth (deprecated but still used)
      const separator = endpoint.includes('?') ? '&' : '?';
      return fetch(`${url}${separator}hapikey=${connection.apiKey}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async testConnection(connection: CrmConnection): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest(connection, 'GET', '/crm/v3/objects/contacts?limit=1');
      if (response.ok) {
        return { success: true, message: 'Connected to HubSpot successfully' };
      }
      const error = await response.json();
      return { success: false, message: error.message || 'Connection failed' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async getAuthorizationUrl(connection: CrmConnection, redirectUri: string): Promise<string> {
    const clientId = process.env.HUBSPOT_CLIENT_ID;

    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.schemas.contacts.read',
      'crm.schemas.deals.read',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      scope: scopes,
      state: connection.id,
    });

    return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    connection: CrmConnection,
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId || '',
      client_secret: clientSecret || '',
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Token exchange failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshToken(
    connection: CrmConnection,
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId || '',
      client_secret: clientSecret || '',
      refresh_token: connection.refreshToken || '',
    });

    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Token refresh failed');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getAvailableObjects(_connection: CrmConnection): Promise<string[]> {
    // HubSpot has standard objects
    return ['contacts', 'companies', 'deals', 'tickets', 'products', 'line_items', 'quotes'];
  }

  async getObjectMetadata(connection: CrmConnection, objectName: string): Promise<CrmObjectMetadata> {
    const response = await this.makeRequest(
      connection,
      'GET',
      `/crm/v3/properties/${objectName}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get metadata for ${objectName}`);
    }

    const data = await response.json();

    const fields: CrmFieldMetadata[] = data.results.map((prop: Record<string, unknown>) => ({
      name: prop.name as string,
      label: prop.label as string,
      type: prop.type as string,
      required: !!prop.required,
      picklistValues: (prop.options as { value: string }[])?.map((o) => o.value),
    }));

    return {
      name: objectName,
      label: objectName.charAt(0).toUpperCase() + objectName.slice(1),
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
        `/crm/v3/objects/${objectName}`,
        { properties: data },
      );

      const result = await response.json();

      if (response.ok) {
        return { success: true, crmId: result.id, data: result };
      }
      return { success: false, error: result.message || 'Create failed' };
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
        `/crm/v3/objects/${objectName}/${crmId}`,
        { properties: data },
      );

      const result = await response.json();

      if (response.ok) {
        return { success: true, crmId, data: result };
      }
      return { success: false, error: result.message || 'Update failed' };
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
    // HubSpot uses email as unique identifier for contacts
    // For other objects, we need to search first then create/update
    try {
      // Search for existing record
      const searchResponse = await this.makeRequest(
        connection,
        'POST',
        `/crm/v3/objects/${objectName}/search`,
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: externalIdField,
                  operator: 'EQ',
                  value: externalIdValue,
                },
              ],
            },
          ],
        },
      );

      const searchResult = await searchResponse.json();

      if (searchResult.results && searchResult.results.length > 0) {
        // Update existing
        return this.updateRecord(connection, objectName, searchResult.results[0].id, data);
      } else {
        // Create new
        return this.createRecord(connection, objectName, { ...data, [externalIdField]: externalIdValue });
      }
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
        `/crm/v3/objects/${objectName}/${crmId}`,
      );

      if (response.ok || response.status === 204) {
        return { success: true, crmId };
      }
      const result = await response.json();
      return { success: false, error: result.message || 'Delete failed' };
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
    let endpoint = `/crm/v3/objects/${objectName}`;
    const params = new URLSearchParams();

    if (fields && fields.length > 0) {
      params.append('properties', fields.join(','));
    }
    if (limit) {
      params.append('limit', limit.toString());
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    // For filtered queries, use search API
    if (filters && Object.keys(filters).length > 0) {
      const searchResponse = await this.makeRequest(
        connection,
        'POST',
        `/crm/v3/objects/${objectName}/search`,
        {
          filterGroups: [
            {
              filters: Object.entries(filters).map(([key, value]) => ({
                propertyName: key,
                operator: 'EQ',
                value,
              })),
            },
          ],
          properties: fields,
          limit: limit || 100,
        },
      );

      const searchResult = await searchResponse.json();
      return searchResult.results || [];
    }

    const response = await this.makeRequest(connection, 'GET', endpoint);
    const data = await response.json();
    return data.results || [];
  }

  async bulkCreate(
    connection: CrmConnection,
    objectName: string,
    records: CrmRecord[],
  ): Promise<BulkSyncResult> {
    const results: SyncResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    // HubSpot batch API accepts up to 100 records
    const batches = this.chunkArray(records, 100);

    for (const batch of batches) {
      try {
        const response = await this.makeRequest(
          connection,
          'POST',
          `/crm/v3/objects/${objectName}/batch/create`,
          {
            inputs: batch.map((record) => ({ properties: record })),
          },
        );

        const data = await response.json();

        if (data.results) {
          for (const result of data.results) {
            results.push({ success: true, crmId: result.id, data: result });
            totalSuccess++;
          }
        }

        if (data.errors) {
          for (const error of data.errors) {
            results.push({ success: false, error: error.message });
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

    const batches = this.chunkArray(records, 100);

    for (const batch of batches) {
      try {
        const response = await this.makeRequest(
          connection,
          'POST',
          `/crm/v3/objects/${objectName}/batch/update`,
          {
            inputs: batch.map((record) => ({
              id: record.id,
              properties: record.data,
            })),
          },
        );

        const data = await response.json();

        if (data.results) {
          for (const result of data.results) {
            results.push({ success: true, crmId: result.id, data: result });
            totalSuccess++;
          }
        }

        if (data.errors) {
          for (const error of data.errors) {
            results.push({ success: false, error: error.message });
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
