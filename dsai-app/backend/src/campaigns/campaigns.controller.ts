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
import { CampaignsService, CampaignStats } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateListDto } from './dto/create-list.dto';
import { Campaign } from './campaign.entity';
import { CampaignList } from './campaign-list.entity';
import { PaginatedResult, PaginationQuery } from '../common/pagination';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateCampaignDto): Promise<Campaign> {
    return this.campaignsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAll(@Query() query: PaginationQuery): Promise<PaginatedResult<Campaign>> {
    return this.campaignsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findOne(@Param('id') id: string): Promise<Campaign | null> {
    return this.campaignsService.findOne(id);
  }

  @Get(':id/stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  getStats(@Param('id') id: string): Promise<CampaignStats> {
    return this.campaignsService.getStats(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<Campaign> {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.campaignsService.remove(id);
    return { success: true };
  }

  // Campaign control
  @Post(':id/start')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  start(@Param('id') id: string): Promise<Campaign> {
    return this.campaignsService.start(id);
  }

  @Post(':id/pause')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  pause(@Param('id') id: string): Promise<Campaign> {
    return this.campaignsService.pause(id);
  }

  @Post(':id/stop')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  stop(@Param('id') id: string): Promise<Campaign> {
    return this.campaignsService.stop(id);
  }

  // List management
  @Post(':id/lists')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createList(
    @Param('id') campaignId: string,
    @Body() dto: CreateListDto,
  ): Promise<CampaignList> {
    return this.campaignsService.createList(campaignId, dto);
  }

  @Get(':id/lists')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findLists(@Param('id') campaignId: string): Promise<CampaignList[]> {
    return this.campaignsService.findLists(campaignId);
  }

  @Delete(':id/lists/:listId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async removeList(
    @Param('id') campaignId: string,
    @Param('listId') listId: string,
  ): Promise<{ success: true }> {
    await this.campaignsService.removeList(campaignId, listId);
    return { success: true };
  }
}
