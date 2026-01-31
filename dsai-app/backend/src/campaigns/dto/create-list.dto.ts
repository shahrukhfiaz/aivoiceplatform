import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class CreateListDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
