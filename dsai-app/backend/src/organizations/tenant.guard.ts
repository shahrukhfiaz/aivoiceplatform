import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationsService } from './organizations.service';

export const SKIP_TENANT_CHECK_KEY = 'skipTenantCheck';
export const SkipTenantCheck = () => SetMetadata(SKIP_TENANT_CHECK_KEY, true);

export const ENFORCE_LIMIT_KEY = 'enforceLimit';
export const EnforceLimit = (limitType: string, action: string) =>
  SetMetadata(ENFORCE_LIMIT_KEY, { limitType, action });

/**
 * TenantGuard ensures that:
 * 1. User belongs to an organization (unless marked with @SkipTenantCheck)
 * 2. Organization is in active status
 * 3. Optionally enforces plan limits (when @EnforceLimit is used)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private orgsService: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if tenant check should be skipped
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Super admin can access everything
    if (user?.role === 'superadmin') {
      return true;
    }

    // User must have an organization
    if (!user?.organizationId) {
      throw new ForbiddenException('User is not associated with any organization');
    }

    // Get organization and verify status
    const org = await this.orgsService.findById(user.organizationId);

    if (org.status === 'suspended') {
      throw new ForbiddenException('Organization is suspended. Please contact support.');
    }

    if (org.status === 'cancelled') {
      throw new ForbiddenException('Organization subscription has been cancelled.');
    }

    // Check if trial has expired
    if (org.trialEndsAt && new Date(org.trialEndsAt) < new Date()) {
      throw new ForbiddenException('Trial period has expired. Please upgrade your plan.');
    }

    // Attach organization to request for use in services
    request.organization = org;

    // Check for limit enforcement
    const limitConfig = this.reflector.getAllAndOverride<{ limitType: string; action: string }>(
      ENFORCE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (limitConfig) {
      await this.orgsService.enforceLimit(
        user.organizationId,
        limitConfig.limitType as keyof typeof import('./organization.entity').PLAN_LIMITS['free'],
        limitConfig.action,
      );
    }

    return true;
  }
}

/**
 * Helper decorator to get organization from request
 */
export function GetOrganization() {
  return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      const ctx = args.find((arg) => arg && typeof arg === 'object' && 'switchToHttp' in arg);
      if (ctx) {
        const request = (ctx as ExecutionContext).switchToHttp().getRequest();
        args.push(request.organization);
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}
