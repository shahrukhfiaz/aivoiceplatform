import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { CrmConnection } from './crm-connection.entity';

export type MappingDirection = 'to_crm' | 'from_crm' | 'bidirectional';
export type FieldTransform = 'none' | 'uppercase' | 'lowercase' | 'date_format' | 'phone_format' | 'custom';

@Entity()
@Index(['connectionId', 'entityType', 'localField'], { unique: true })
export class CrmFieldMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  connectionId: string;

  @ManyToOne(() => CrmConnection, (connection) => connection.fieldMappings, { onDelete: 'CASCADE' })
  connection: CrmConnection;

  // Entity type: lead, call, disposition, campaign
  @Column()
  entityType: string;

  // Local DSAI field name
  @Column()
  localField: string;

  // CRM field name/path
  @Column()
  crmField: string;

  // Direction of sync
  @Column({ type: 'text', default: 'to_crm' })
  direction: MappingDirection;

  // Data transformation
  @Column({ type: 'text', default: 'none' })
  transform: FieldTransform;

  // Custom transform expression (for advanced use)
  @Column({ type: 'text', nullable: true })
  customTransform?: string;

  // Default value if source is empty
  @Column({ type: 'text', nullable: true })
  defaultValue?: string;

  // Is this mapping required?
  @Column({ type: 'boolean', default: false })
  required: boolean;

  // Is this mapping active?
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Field metadata
  @Column({ type: 'simple-json', nullable: true })
  metadata?: {
    localFieldType?: string;
    crmFieldType?: string;
    crmFieldLabel?: string;
    crmPicklistValues?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
