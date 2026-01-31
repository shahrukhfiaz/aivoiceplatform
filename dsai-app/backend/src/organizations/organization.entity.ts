import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';

export type OrganizationStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type PlanType = 'free' | 'starter' | 'professional' | 'enterprise';

@Entity()
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string; // URL-friendly identifier

  @Column({ type: 'text', default: 'active' })
  status: OrganizationStatus;

  // Subscription/Plan
  @Column({ type: 'text', default: 'free' })
  plan: PlanType;

  @Column({ type: 'datetime', nullable: true })
  trialEndsAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  subscriptionEndsAt?: Date;

  // Branding
  @Column({ type: 'text', nullable: true })
  logoUrl?: string;

  @Column({ type: 'text', nullable: true })
  primaryColor?: string;

  @Column({ type: 'text', nullable: true })
  customDomain?: string;

  // Contact
  @Column({ type: 'text', nullable: true })
  contactEmail?: string;

  @Column({ type: 'text', nullable: true })
  contactPhone?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  // Limits based on plan
  @Column({ type: 'simple-json', nullable: true })
  limits?: {
    maxUsers: number;
    maxAgents: number;
    maxCampaigns: number;
    maxLeadsPerMonth: number;
    maxCallsPerMonth: number;
    maxConcurrentCalls: number;
    recordingRetentionDays: number;
    crmIntegrations: boolean;
    advancedReporting: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };

  // Usage tracking
  @Column({ type: 'simple-json', nullable: true })
  usage?: {
    currentUsers: number;
    currentAgents: number;
    currentCampaigns: number;
    leadsThisMonth: number;
    callsThisMonth: number;
    lastResetAt: string;
  };

  // Settings
  @Column({ type: 'simple-json', nullable: true })
  settings?: {
    timezone: string;
    defaultCallerId: string;
    autoRecordCalls: boolean;
    emailNotifications: boolean;
    webhookUrl?: string;
  };

  // Billing
  @Column({ type: 'text', nullable: true })
  stripeCustomerId?: string;

  @Column({ type: 'text', nullable: true })
  stripeSubscriptionId?: string;

  // Users belonging to this organization
  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @Column({ nullable: true })
  ownerId?: string; // Primary owner/admin

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Plan configurations
export const PLAN_LIMITS: Record<PlanType, Organization['limits']> = {
  free: {
    maxUsers: 2,
    maxAgents: 1,
    maxCampaigns: 1,
    maxLeadsPerMonth: 100,
    maxCallsPerMonth: 500,
    maxConcurrentCalls: 1,
    recordingRetentionDays: 7,
    crmIntegrations: false,
    advancedReporting: false,
    apiAccess: false,
    whiteLabel: false,
  },
  starter: {
    maxUsers: 5,
    maxAgents: 3,
    maxCampaigns: 5,
    maxLeadsPerMonth: 1000,
    maxCallsPerMonth: 5000,
    maxConcurrentCalls: 5,
    recordingRetentionDays: 30,
    crmIntegrations: true,
    advancedReporting: false,
    apiAccess: false,
    whiteLabel: false,
  },
  professional: {
    maxUsers: 25,
    maxAgents: 10,
    maxCampaigns: 20,
    maxLeadsPerMonth: 10000,
    maxCallsPerMonth: 50000,
    maxConcurrentCalls: 25,
    recordingRetentionDays: 90,
    crmIntegrations: true,
    advancedReporting: true,
    apiAccess: true,
    whiteLabel: false,
  },
  enterprise: {
    maxUsers: -1, // unlimited
    maxAgents: -1,
    maxCampaigns: -1,
    maxLeadsPerMonth: -1,
    maxCallsPerMonth: -1,
    maxConcurrentCalls: -1,
    recordingRetentionDays: 365,
    crmIntegrations: true,
    advancedReporting: true,
    apiAccess: true,
    whiteLabel: true,
  },
};
