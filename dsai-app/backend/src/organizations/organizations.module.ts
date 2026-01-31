import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  providers: [OrganizationsService, TenantGuard],
  controllers: [OrganizationsController],
  exports: [OrganizationsService, TenantGuard],
})
export class OrganizationsModule {}
