import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTrunkDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEnum(['inbound', 'outbound'])
  direction: 'inbound' | 'outbound';

  @IsOptional()
  @IsIn(['generic', 'twilio', 'telnyx', 'vonage'])
  providerType?: 'generic' | 'twilio' | 'telnyx' | 'vonage';

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsIn(['udp', 'tcp', 'tls', 'wss'])
  transport?: 'udp' | 'tcp' | 'tls' | 'wss';

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+(,[a-zA-Z0-9_.-]+)*$/, {
    message: 'Invalid codecs list',
  })
  codecs?: string;

  // Inbound-specific fields
  @IsOptional()
  @IsString()
  didNumber?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  allowedIps?: string;

  // Outbound-specific fields
  @IsOptional()
  @IsBoolean()
  registerEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  registerInterval?: number;

  @IsOptional()
  @IsString()
  outboundCallerId?: string;

  // Common fields
  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  denoiseEnabled?: boolean;
}
