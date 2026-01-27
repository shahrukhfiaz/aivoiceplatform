import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { DialCallDto } from './dto/dial-call.dto';
import { DialResponseDto } from './dto/dial-response.dto';
import { RunAgentDto } from './dto/run-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { VicidialConfigDto } from './dto/vicidial-config.dto';
import { Agent } from './agent.entity';
import { PaginationQuery, PaginatedResult } from '../common/pagination';

/**
 * Internal controller for container-to-backend communication.
 * No authentication required - containers use this to fetch their config dynamically.
 */
@Controller('internal/agents')
export class InternalAgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  /**
   * Get provider URLs for an agent.
   * Used by core containers to fetch provider URLs dynamically from database.
   * Returns provider container names and ports so core can connect to them.
   */
  @Get(':id/providers')
  async getProviderUrls(@Param('id') id: string): Promise<{
    stsUrl?: string;
    asrUrl?: string;
    llmUrl?: string;
    ttsUrl?: string;
  }> {
    return this.agentsService.getProviderUrlsForAgent(id);
  }
}

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() createAgentDto: CreateAgentDto): Promise<Agent> {
    return this.agentsService.create(createAgentDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAll(@Query() query: PaginationQuery): Promise<PaginatedResult<Agent>> {
    return this.agentsService.findAll(query);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
  ): Promise<Agent> {
    return this.agentsService.update(id, updateAgentDto);
  }

  @Post(':id/run')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  runAgent(@Param('id') id: string, @Body() runAgentDto: RunAgentDto) {
    return this.agentsService.runAgent(id, runAgentDto);
  }

  @Post(':id/stop')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  stopAgent(@Param('id') id: string): Promise<Agent> {
    return this.agentsService.stopAgent(id);
  }

  @Post(':id/dial')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  dialOutbound(
    @Param('id') id: string,
    @Body() dialCallDto: DialCallDto,
  ): Promise<DialResponseDto> {
    return this.agentsService.dialOutbound(id, dialCallDto);
  }

  @Get(':id/vicidial-config')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getVicidialConfig(@Param('id') id: string): Promise<VicidialConfigDto> {
    const agent = await this.agentsService.findOne(id);
    return this.agentsService.getVicidialConfig(agent);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.agentsService.remove(id);
    return { success: true };
  }
}
