import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AgentCallType, AgentMode } from '../agent.entity';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AgentMode)
  mode?: AgentMode;

  @IsOptional()
  @IsEnum(AgentCallType)
  defaultCallType?: AgentCallType;

  @IsOptional()
  @IsUUID()
  providerAsrId?: string | null;

  @IsOptional()
  @IsUUID()
  providerLlmId?: string | null;

  @IsOptional()
  @IsUUID()
  providerTtsId?: string | null;

  @IsOptional()
  @IsUUID()
  providerStsId?: string | null;

  @IsOptional()
  @IsUUID()
  outboundTrunkId?: string | null;
}
