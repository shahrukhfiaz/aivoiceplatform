import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  Min,
  Max,
  Matches,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'number must be a valid phone number (E.164 format recommended)',
  })
  number: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class PhoneNumberDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'number must be a valid phone number (E.164 format recommended)',
  })
  number?: string;

  @IsOptional()
  @IsUUID()
  trunkId?: string;
}

export class CreateCallDto {
  /**
   * The agent ID to use for this call (similar to VAPI's assistantId)
   */
  @IsUUID()
  agentId: string;

  /**
   * The customer to call
   */
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  /**
   * Optional phone number configuration for caller ID
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => PhoneNumberDto)
  phoneNumber?: PhoneNumberDto;

  /**
   * Custom metadata to attach to the call
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /**
   * Dial timeout in seconds (default: 60)
   */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(300)
  maxDuration?: number;

  /**
   * Optional name for the call (for identification in logs)
   */
  @IsOptional()
  @IsString()
  name?: string;
}
