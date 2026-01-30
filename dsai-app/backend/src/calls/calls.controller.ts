import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto/create-call.dto';
import { CallResponseDto, CallListResponseDto } from './dto/call-response.dto';
import { PaginationQuery } from '../common/pagination';

/**
 * VAPI-style calls API controller
 * Provides programmatic API access for initiating and managing calls
 *
 * Supports both JWT and API key authentication
 */
@Controller('calls')
@UseGuards(CombinedAuthGuard, RolesGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  /**
   * Create a new outbound call
   *
   * POST /calls
   *
   * Similar to VAPI's Create Call API
   *
   * @example
   * ```
   * POST /calls
   * Authorization: Bearer sk_live_xxxxx
   * Content-Type: application/json
   *
   * {
   *   "agentId": "uuid-of-agent",
   *   "customer": {
   *     "number": "+14155551234",
   *     "name": "John Doe"
   *   },
   *   "phoneNumber": {
   *     "number": "+14155559999"
   *   },
   *   "metadata": {
   *     "campaign": "Q1",
   *     "leadId": "12345"
   *   },
   *   "maxDuration": 300
   * }
   * ```
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createCall(@Body() createCallDto: CreateCallDto): Promise<CallResponseDto> {
    return this.callsService.createCall(createCallDto);
  }

  /**
   * List all calls with pagination and filtering
   *
   * GET /calls
   *
   * @param query.page - Page number (default: 1)
   * @param query.limit - Items per page (default: 20)
   * @param query.agentId - Filter by agent ID
   * @param query.status - Filter by status (queued, in-progress, ended)
   * @param query.type - Filter by type (inbound, outbound)
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async listCalls(
    @Query() query: PaginationQuery & {
      agentId?: string;
      status?: string;
      type?: string;
    },
  ): Promise<CallListResponseDto> {
    return this.callsService.listCalls(query);
  }

  /**
   * Get a call by ID
   *
   * GET /calls/:id
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  async getCall(@Param('id') id: string): Promise<CallResponseDto> {
    const call = await this.callsService.getCall(id);
    if (!call) {
      throw new NotFoundException('Call not found');
    }
    return call;
  }
}
