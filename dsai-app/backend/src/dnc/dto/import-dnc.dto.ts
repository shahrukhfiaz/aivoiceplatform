import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class DncImportEntry {
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ImportDncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DncImportEntry)
  entries: DncImportEntry[];

  @IsOptional()
  @IsEnum(['internal', 'national', 'state', 'disposition', 'customer_request', 'import'])
  source?: 'internal' | 'national' | 'state' | 'disposition' | 'customer_request' | 'import';

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ScrubLeadsDto {
  @IsArray()
  @IsString({ each: true })
  phoneNumbers: string[];

  @IsOptional()
  @IsString()
  campaignId?: string;
}
