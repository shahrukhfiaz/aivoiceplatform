import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['predictive', 'progressive', 'preview', 'power'])
  dialingMode?: 'predictive' | 'progressive' | 'preview' | 'power';

  @IsOptional()
  @IsString()
  aiAgentId?: string;

  @IsOptional()
  @IsString()
  outboundTrunkId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  callsPerAgent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxAbandonRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(120)
  ringTimeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  wrapUpTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxAttemptsPerLead?: number;

  @IsOptional()
  @IsString()
  defaultCallerId?: string;

  @IsOptional()
  @IsObject()
  schedule?: {
    days: number[];
    startTime: string;
    endTime: string;
    timezone: string;
  };

  @IsOptional()
  @IsString()
  script?: string;

  // Calling hours (TCPA compliance)
  @IsOptional()
  @IsObject()
  callingHours?: {
    timezone: string;
    weekday: { start: string; end: string };
    saturday: { start: string; end: string } | null;
    sunday: { start: string; end: string } | null;
  };

  @IsOptional()
  @IsBoolean()
  respectStateRules?: boolean;

  // AMD settings
  @IsOptional()
  @IsBoolean()
  amdEnabled?: boolean;

  @IsOptional()
  @IsEnum(['fast', 'balanced', 'accurate'])
  amdMode?: 'fast' | 'balanced' | 'accurate';

  @IsOptional()
  @IsObject()
  amdSettings?: {
    initialSilence?: number;
    greeting?: number;
    afterGreetingSilence?: number;
    totalAnalysisTime?: number;
    minWordLength?: number;
    betweenWordsSilence?: number;
    maximumWordLength?: number;
    silenceThreshold?: number;
  };

  @IsOptional()
  @IsBoolean()
  voicemailDropEnabled?: boolean;

  @IsOptional()
  @IsString()
  voicemailDropRecordingId?: string;

  // Local Presence / Caller ID Pool
  @IsOptional()
  @IsString()
  callerIdPoolId?: string;

  @IsOptional()
  @IsBoolean()
  localPresenceEnabled?: boolean;

  @IsOptional()
  @IsEnum(['pool_first', 'default_only', 'pool_only'])
  callerIdStrategy?: 'pool_first' | 'default_only' | 'pool_only';
}
