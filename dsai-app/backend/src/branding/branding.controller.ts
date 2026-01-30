import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  /**
   * Get current branding configuration.
   * Public endpoint (no authentication required) so login page can fetch branding.
   */
  @Get()
  async get() {
    return this.brandingService.get();
  }

  /**
   * Update branding configuration.
   * Admin-only endpoint.
   */
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(@Body() updateBrandingDto: UpdateBrandingDto) {
    return this.brandingService.update(updateBrandingDto);
  }
}
