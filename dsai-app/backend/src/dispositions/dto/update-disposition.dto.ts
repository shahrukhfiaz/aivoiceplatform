import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';

export class UpdateDispositionDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['positive', 'negative', 'neutral', 'callback'])
  category?: 'positive' | 'negative' | 'neutral' | 'callback';

  @IsOptional()
  @IsBoolean()
  markAsDnc?: boolean;

  @IsOptional()
  @IsBoolean()
  scheduleCallback?: boolean;

  @IsOptional()
  @IsNumber()
  retryAfterMinutes?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
