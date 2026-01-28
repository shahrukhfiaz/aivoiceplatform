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
import { PaginatedResult, PaginationQuery } from '../common/pagination';
import { UserRole } from '../users/user.entity';
import { CreateTwilioNumberDto } from './dto/create-twilio-number.dto';
import { UpdateTwilioNumberDto } from './dto/update-twilio-number.dto';
import { TwilioNumberResponse, TwilioService } from './twilio.service';

@Controller('twilio-numbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TwilioController {
  constructor(private readonly twilioService: TwilioService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateTwilioNumberDto): Promise<TwilioNumberResponse> {
    return this.twilioService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAll(
    @Query() query: PaginationQuery,
  ): Promise<PaginatedResult<TwilioNumberResponse>> {
    return this.twilioService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findOne(@Param('id') id: string): Promise<TwilioNumberResponse> {
    return this.twilioService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTwilioNumberDto,
  ): Promise<TwilioNumberResponse> {
    return this.twilioService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.twilioService.remove(id);
    return { success: true };
  }

  @Post(':id/verify')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  verifyCredentials(
    @Param('id') id: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.twilioService.verifyCredentials(id);
  }

  @Post(':id/configure-webhooks')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  configureWebhooks(
    @Param('id') id: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.twilioService.configureWebhooksById(id);
  }
}
