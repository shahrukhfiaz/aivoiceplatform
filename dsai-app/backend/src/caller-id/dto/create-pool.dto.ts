import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, Min, Max } from 'class-validator';
import { RotationStrategy } from '../caller-id-pool.entity';

export class CreateCallerIdPoolDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  localPresenceEnabled?: boolean;

  @IsOptional()
  @IsEnum(['round_robin', 'random', 'weighted', 'least_recently_used'])
  rotationStrategy?: RotationStrategy;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxCallsPerNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  cooldownMinutes?: number;
}
