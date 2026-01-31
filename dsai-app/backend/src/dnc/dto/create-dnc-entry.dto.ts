import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class CreateDncEntryDto {
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsEnum(['internal', 'national', 'state', 'disposition', 'customer_request', 'import'])
  source?: 'internal' | 'national' | 'state' | 'disposition' | 'customer_request' | 'import';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
