import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { LeadsService, LeadFilter } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UploadLeadsDto } from './dto/upload-leads.dto';
import { Lead } from './lead.entity';
import { PaginatedResult } from '../common/pagination';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateLeadDto): Promise<Lead> {
    return this.leadsService.create(dto);
  }

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  upload(@Body() dto: UploadLeadsDto): Promise<{ imported: number; skipped: number }> {
    return this.leadsService.uploadLeads(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAll(@Query() query: LeadFilter): Promise<PaginatedResult<Lead>> {
    return this.leadsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findOne(@Param('id') id: string): Promise<Lead | null> {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto): Promise<Lead> {
    return this.leadsService.update(id, dto);
  }

  @Post(':id/disposition')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  setDisposition(
    @Param('id') id: string,
    @Body() body: { dispositionId: string; notes?: string },
  ): Promise<Lead> {
    return this.leadsService.setDisposition(id, body.dispositionId, body.notes);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.leadsService.remove(id);
    return { success: true };
  }
}
