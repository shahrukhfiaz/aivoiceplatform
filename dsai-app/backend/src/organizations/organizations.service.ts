import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization, OrganizationStatus, PlanType, PLAN_LIMITS } from './organization.entity';

export interface CreateOrganizationDto {
  name: string;
  slug?: string;
  contactEmail?: string;
  contactPhone?: string;
  plan?: PlanType;
  ownerId?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  status?: OrganizationStatus;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  settings?: Organization['settings'];
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  // ==================== CRUD Operations ====================

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    // Generate slug from name if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check for duplicate slug
    const existing = await this.orgRepo.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException('An organization with this slug already exists');
    }

    const plan = dto.plan || 'free';
    const limits = PLAN_LIMITS[plan];

    const org = this.orgRepo.create({
      ...dto,
      slug,
      plan,
      limits,
      status: 'active',
      trialEndsAt: plan === 'free' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined,
      usage: {
        currentUsers: 0,
        currentAgents: 0,
        currentCampaigns: 0,
        leadsThisMonth: 0,
        callsThisMonth: 0,
        lastResetAt: new Date().toISOString(),
      },
      settings: {
        timezone: 'America/New_York',
        defaultCallerId: '',
        autoRecordCalls: true,
        emailNotifications: true,
      },
    });

    return this.orgRepo.save(org);
  }

  async findAll(): Promise<Organization[]> {
    return this.orgRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.orgRepo.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async findBySlug(slug: string): Promise<Organization> {
    const org = await this.orgRepo.findOne({
      where: { slug },
      relations: ['users'],
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.findById(id);

    if (dto.name !== undefined) org.name = dto.name;
    if (dto.status !== undefined) org.status = dto.status;
    if (dto.contactEmail !== undefined) org.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) org.contactPhone = dto.contactPhone;
    if (dto.address !== undefined) org.address = dto.address;
    if (dto.logoUrl !== undefined) org.logoUrl = dto.logoUrl;
    if (dto.primaryColor !== undefined) org.primaryColor = dto.primaryColor;
    if (dto.customDomain !== undefined) org.customDomain = dto.customDomain;
    if (dto.settings) org.settings = { ...org.settings, ...dto.settings };

    return this.orgRepo.save(org);
  }

  async delete(id: string): Promise<void> {
    const org = await this.findById(id);

    // Check if org has active users
    if (org.users && org.users.length > 0) {
      throw new BadRequestException('Cannot delete organization with active users');
    }

    await this.orgRepo.remove(org);
  }

  // ==================== Plan & Subscription ====================

  async updatePlan(id: string, plan: PlanType): Promise<Organization> {
    const org = await this.findById(id);

    org.plan = plan;
    org.limits = PLAN_LIMITS[plan];

    // If upgrading from free, clear trial
    if (org.trialEndsAt && plan !== 'free') {
      org.trialEndsAt = undefined;
    }

    return this.orgRepo.save(org);
  }

  async suspendOrganization(id: string, reason?: string): Promise<Organization> {
    const org = await this.findById(id);
    org.status = 'suspended';
    this.logger.warn(`Organization ${org.name} suspended. Reason: ${reason || 'N/A'}`);
    return this.orgRepo.save(org);
  }

  async reactivateOrganization(id: string): Promise<Organization> {
    const org = await this.findById(id);
    org.status = 'active';
    return this.orgRepo.save(org);
  }

  // ==================== Usage Tracking ====================

  async incrementUsage(
    id: string,
    field: 'leadsThisMonth' | 'callsThisMonth',
    amount: number = 1,
  ): Promise<void> {
    const org = await this.findById(id);

    if (!org.usage) {
      org.usage = {
        currentUsers: 0,
        currentAgents: 0,
        currentCampaigns: 0,
        leadsThisMonth: 0,
        callsThisMonth: 0,
        lastResetAt: new Date().toISOString(),
      };
    }

    org.usage[field] += amount;
    await this.orgRepo.save(org);
  }

  async updateResourceCount(
    id: string,
    field: 'currentUsers' | 'currentAgents' | 'currentCampaigns',
    count: number,
  ): Promise<void> {
    const org = await this.findById(id);

    if (!org.usage) {
      org.usage = {
        currentUsers: 0,
        currentAgents: 0,
        currentCampaigns: 0,
        leadsThisMonth: 0,
        callsThisMonth: 0,
        lastResetAt: new Date().toISOString(),
      };
    }

    org.usage[field] = count;
    await this.orgRepo.save(org);
  }

  async resetMonthlyUsage(): Promise<void> {
    const orgs = await this.orgRepo.find();

    for (const org of orgs) {
      if (org.usage) {
        org.usage.leadsThisMonth = 0;
        org.usage.callsThisMonth = 0;
        org.usage.lastResetAt = new Date().toISOString();
      }
      await this.orgRepo.save(org);
    }

    this.logger.log('Monthly usage reset for all organizations');
  }

  // ==================== Limit Checking ====================

  async checkLimit(
    orgId: string,
    limitType: keyof Organization['limits'],
    currentValue?: number,
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const org = await this.findById(orgId);

    if (!org.limits) {
      return { allowed: true, limit: -1, current: 0 };
    }

    const limit = org.limits[limitType];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, current: currentValue || 0 };
    }

    // For boolean limits
    if (typeof limit === 'boolean') {
      return { allowed: limit, limit: limit ? 1 : 0, current: currentValue || 0 };
    }

    // For numeric limits
    let current = currentValue || 0;

    if (!currentValue && org.usage) {
      switch (limitType) {
        case 'maxUsers':
          current = org.usage.currentUsers;
          break;
        case 'maxAgents':
          current = org.usage.currentAgents;
          break;
        case 'maxCampaigns':
          current = org.usage.currentCampaigns;
          break;
        case 'maxLeadsPerMonth':
          current = org.usage.leadsThisMonth;
          break;
        case 'maxCallsPerMonth':
          current = org.usage.callsThisMonth;
          break;
      }
    }

    return {
      allowed: current < limit,
      limit,
      current,
    };
  }

  async enforceLimit(
    orgId: string,
    limitType: keyof Organization['limits'],
    action: string,
  ): Promise<void> {
    const check = await this.checkLimit(orgId, limitType);

    if (!check.allowed) {
      throw new ForbiddenException(
        `Limit exceeded: ${action}. Current: ${check.current}, Limit: ${check.limit}. Please upgrade your plan.`,
      );
    }
  }

  // ==================== Helpers ====================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  async getUsageStats(id: string): Promise<{
    plan: PlanType;
    limits: Organization['limits'];
    usage: Organization['usage'];
    percentages: Record<string, number>;
  }> {
    const org = await this.findById(id);

    const percentages: Record<string, number> = {};

    if (org.limits && org.usage) {
      const numericLimits = [
        'maxUsers',
        'maxAgents',
        'maxCampaigns',
        'maxLeadsPerMonth',
        'maxCallsPerMonth',
      ] as const;

      for (const key of numericLimits) {
        const limit = org.limits[key] as number;
        let current = 0;

        switch (key) {
          case 'maxUsers':
            current = org.usage.currentUsers;
            break;
          case 'maxAgents':
            current = org.usage.currentAgents;
            break;
          case 'maxCampaigns':
            current = org.usage.currentCampaigns;
            break;
          case 'maxLeadsPerMonth':
            current = org.usage.leadsThisMonth;
            break;
          case 'maxCallsPerMonth':
            current = org.usage.callsThisMonth;
            break;
        }

        percentages[key] = limit === -1 ? 0 : Math.round((current / limit) * 100);
      }
    }

    return {
      plan: org.plan,
      limits: org.limits || null,
      usage: org.usage || null,
      percentages,
    };
  }
}
