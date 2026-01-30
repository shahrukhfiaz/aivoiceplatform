import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTwilioNumberDto {
  // E.164 format phone number (e.g., +14156021922)
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +14156021922)',
  })
  phoneNumber?: string;

  // Friendly label for the phone number
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label?: string;

  // Twilio Account SID (format: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
  @IsOptional()
  @IsString()
  @Matches(/^AC[a-f0-9]{32}$/, {
    message: 'Invalid Twilio Account SID format',
  })
  accountSid?: string;

  // Twilio Auth Token (32 characters) - only update if provided
  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(32)
  authToken?: string;

  // Enable SMS messaging capability
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  // Enable voice call capability
  @IsOptional()
  @IsBoolean()
  callsEnabled?: boolean;

  // Enable call recording
  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  // Enable audio denoise
  @IsOptional()
  @IsBoolean()
  denoiseEnabled?: boolean;

  // Agent to route inbound calls to
  @IsOptional()
  @IsUUID()
  agentId?: string | null;
}
