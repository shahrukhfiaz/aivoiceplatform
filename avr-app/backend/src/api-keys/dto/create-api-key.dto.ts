import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsArray()
  @IsEnum(['read', 'write', 'admin'], { each: true })
  scopes?: ('read' | 'write' | 'admin')[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
