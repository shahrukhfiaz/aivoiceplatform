import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CrmFieldMapping } from './crm-field-mapping.entity';
import { CrmSyncLog } from './crm-sync-log.entity';

export type CrmProvider = 'salesforce' | 'hubspot' | 'zoho' | 'custom';
export type ConnectionStatus = 'active' | 'inactive' | 'error' | 'pending_auth';
export type SyncDirection = 'to_crm' | 'from_crm' | 'bidirectional';

@Entity()
export class CrmConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  provider: CrmProvider;

  @Column({ type: 'text', default: 'inactive' })
  status: ConnectionStatus;

  // OAuth/API credentials (encrypted)
  @Column({ type: 'text', nullable: true })
  accessToken?: string;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ type: 'datetime', nullable: true })
  tokenExpiresAt?: Date;

  @Column({ type: 'text', nullable: true })
  apiKey?: string;

  // Provider-specific settings
  @Column({ type: 'simple-json', nullable: true })
  settings?: {
    instanceUrl?: string; // Salesforce instance URL
    portalId?: string; // HubSpot portal ID
    orgId?: string; // Zoho org ID
    customApiUrl?: string; // Custom CRM API URL
    authType?: 'oauth2' | 'api_key' | 'basic';
    username?: string;
    sandbox?: boolean;
  };

  // Sync configuration
  @Column({ type: 'text', default: 'to_crm' })
  syncDirection: SyncDirection;

  @Column({ type: 'boolean', default: false })
  autoSyncEnabled: boolean;

  @Column({ type: 'integer', default: 60 })
  syncIntervalMinutes: number;

  @Column({ type: 'datetime', nullable: true })
  lastSyncAt?: Date;

  @Column({ type: 'text', nullable: true })
  lastSyncStatus?: string;

  @Column({ type: 'integer', default: 0 })
  totalSynced: number;

  @Column({ type: 'integer', default: 0 })
  syncErrors: number;

  // Entity mapping configuration
  @Column({ type: 'simple-json', nullable: true })
  entityMappings?: {
    lead?: {
      crmObject: string; // 'Lead', 'Contact', etc.
      enabled: boolean;
    };
    call?: {
      crmObject: string; // 'Task', 'Activity', etc.
      enabled: boolean;
    };
    disposition?: {
      crmObject: string;
      enabled: boolean;
    };
  };

  @OneToMany(() => CrmFieldMapping, (mapping) => mapping.connection)
  fieldMappings: CrmFieldMapping[];

  @OneToMany(() => CrmSyncLog, (log) => log.connection)
  syncLogs: CrmSyncLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
