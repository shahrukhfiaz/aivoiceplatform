import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AgentCallType, AgentMode } from '../agent.entity';

export class CreateAgentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(AgentMode)
  mode?: AgentMode;

  @IsOptional()
  @IsEnum(AgentCallType)
  defaultCallType?: AgentCallType;

  @IsOptional()
  @IsUUID()
  providerAsrId?: string;

  @IsOptional()
  @IsUUID()
  providerLlmId?: string;

  @IsOptional()
  @IsUUID()
  providerTtsId?: string;

  @IsOptional()
  @IsUUID()
  providerStsId?: string;

  @IsOptional()
  @IsUUID()
  outboundTrunkId?: string;
}
