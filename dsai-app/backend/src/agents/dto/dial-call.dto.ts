import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  IsUUID,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class DialCallDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'toNumber must be a valid phone number (E.164 format recommended)',
  })
  toNumber: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'fromNumber must be a valid phone number (E.164 format recommended)',
  })
  fromNumber?: string;

  @IsOptional()
  @IsUUID()
  trunkId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(300)
  timeout?: number;
}
