import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';

export class CreateDispositionDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

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
