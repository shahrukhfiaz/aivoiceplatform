import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
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
}
