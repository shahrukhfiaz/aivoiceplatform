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
import { DispositionsService } from './dispositions.service';
import { CreateDispositionDto } from './dto/create-disposition.dto';
import { UpdateDispositionDto } from './dto/update-disposition.dto';
import { Disposition } from './disposition.entity';
import { PaginatedResult, PaginationQuery } from '../common/pagination';

@Controller('dispositions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispositionsController {
  constructor(private readonly dispositionsService: DispositionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateDispositionDto): Promise<Disposition> {
    return this.dispositionsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAll(@Query() query: PaginationQuery): Promise<PaginatedResult<Disposition>> {
    return this.dispositionsService.findAll(query);
  }

  @Get('all')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findAllNoPagination(): Promise<Disposition[]> {
    return this.dispositionsService.findAllNoPagination();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  findOne(@Param('id') id: string): Promise<Disposition | null> {
    return this.dispositionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDispositionDto,
  ): Promise<Disposition> {
    return this.dispositionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string): Promise<{ success: true }> {
    await this.dispositionsService.remove(id);
    return { success: true };
  }
}
