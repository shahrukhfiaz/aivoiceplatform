import { CrmConnection } from '../crm-connection.entity';

export interface CrmRecord {
  id?: string;
  [key: string]: unknown;
}

export interface CrmFieldMetadata {
  name: string;
  label: string;
  type: string;
  required: boolean;
  picklistValues?: string[];
  referenceTo?: string;
}

export interface CrmObjectMetadata {
  name: string;
  label: string;
  fields: CrmFieldMetadata[];
}

export interface SyncResult {
  success: boolean;
  crmId?: string;
  error?: string;
  data?: CrmRecord;
}

export interface BulkSyncResult {
  success: boolean;
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
  results: SyncResult[];
  errors?: string[];
}

export interface CrmAdapter {
  /**
   * Test the connection to the CRM
   */
  testConnection(connection: CrmConnection): Promise<{ success: boolean; message: string }>;

  /**
   * Initialize OAuth flow - returns authorization URL
   */
  getAuthorizationUrl(connection: CrmConnection, redirectUri: string): Promise<string>;

  /**
   * Exchange authorization code for access token
   */
  exchangeCodeForToken(
    connection: CrmConnection,
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>;

  /**
   * Refresh access token
   */
  refreshToken(connection: CrmConnection): Promise<{ accessToken: string; expiresAt?: Date }>;

  /**
   * Get available objects in the CRM
   */
  getAvailableObjects(connection: CrmConnection): Promise<string[]>;

  /**
   * Get metadata for a CRM object
   */
  getObjectMetadata(connection: CrmConnection, objectName: string): Promise<CrmObjectMetadata>;

  /**
   * Create a record in the CRM
   */
  createRecord(connection: CrmConnection, objectName: string, data: CrmRecord): Promise<SyncResult>;

  /**
   * Update a record in the CRM
   */
  updateRecord(
    connection: CrmConnection,
    objectName: string,
    crmId: string,
    data: CrmRecord,
  ): Promise<SyncResult>;

  /**
   * Upsert a record (create or update based on external ID)
   */
  upsertRecord(
    connection: CrmConnection,
    objectName: string,
    externalIdField: string,
    externalIdValue: string,
    data: CrmRecord,
  ): Promise<SyncResult>;

  /**
   * Delete a record from the CRM
   */
  deleteRecord(connection: CrmConnection, objectName: string, crmId: string): Promise<SyncResult>;

  /**
   * Query records from the CRM
   */
  queryRecords(
    connection: CrmConnection,
    objectName: string,
    filters?: Record<string, unknown>,
    fields?: string[],
    limit?: number,
  ): Promise<CrmRecord[]>;

  /**
   * Bulk create records
   */
  bulkCreate(connection: CrmConnection, objectName: string, records: CrmRecord[]): Promise<BulkSyncResult>;

  /**
   * Bulk update records
   */
  bulkUpdate(
    connection: CrmConnection,
    objectName: string,
    records: Array<{ id: string; data: CrmRecord }>,
  ): Promise<BulkSyncResult>;
}
