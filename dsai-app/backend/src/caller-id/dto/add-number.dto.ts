import { IsString, IsOptional, Matches, IsEnum } from 'class-validator';
import { CallerIdStatus } from '../caller-id-number.entity';

export class AddCallerIdNumberDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'Phone number must be a valid E.164 format' })
  phoneNumber: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: CallerIdStatus;
}

export class ImportNumbersDto {
  numbers: AddCallerIdNumberDto[];
}

export class UpdateCallerIdNumberDto {
  @IsOptional()
  @IsEnum(['active', 'cooling_down', 'flagged', 'blocked', 'inactive'])
  status?: CallerIdStatus;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

export class FlagNumberDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  source?: string;
}
