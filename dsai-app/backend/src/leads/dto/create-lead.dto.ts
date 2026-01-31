import { IsString, IsOptional, IsNumber, IsObject, IsEmail } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  listId: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  altPhone1?: string;

  @IsOptional()
  @IsString()
  altPhone2?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  priority?: number;
}
