import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import {
  ApiKeyResponseDto,
  ApiKeyCreatedResponseDto,
} from './dto/api-key-response.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async create(
    @Req() req,
    @Body() dto: CreateApiKeyDto,
  ): Promise<ApiKeyCreatedResponseDto> {
    return this.apiKeysService.create(req.user.sub, dto);
  }

  @Get()
  async findAll(@Req() req): Promise<ApiKeyResponseDto[]> {
    return this.apiKeysService.findAllByUser(req.user.sub);
  }

  @Post(':id/revoke')
  async revoke(
    @Req() req,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.apiKeysService.revoke(id, req.user.sub);
    return { success: true };
  }

  @Delete(':id')
  async delete(
    @Req() req,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.apiKeysService.delete(id, req.user.sub);
    return { success: true };
  }
}
