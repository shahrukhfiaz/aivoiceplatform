import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { Organization } from '../organizations/organization.entity';

export enum UserRole {
  SUPERADMIN = 'superadmin', // Platform-wide admin
  ADMIN = 'admin',
  MANAGER = 'manager',
  VIEWER = 'viewer',
}

@Entity()
@Index(['organizationId', 'username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  username: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'text', default: UserRole.VIEWER })
  role: UserRole;

  // Multi-tenant: Organization relationship
  @Column({ nullable: true })
  organizationId?: string;

  @ManyToOne(() => Organization, (org) => org.users, { nullable: true })
  organization?: Organization;

  // Additional user fields
  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date;
}
