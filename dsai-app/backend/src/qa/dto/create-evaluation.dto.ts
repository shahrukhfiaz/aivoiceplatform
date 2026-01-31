import { IsArray, IsNumber, IsOptional, IsString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CriterionScore, EvaluationStatus } from '../qa-evaluation.entity';

export class CriterionScoreDto implements CriterionScore {
  @IsString()
  criterionId: string;

  @IsString()
  categoryId: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(1)
  maxScore: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateEvaluationDto {
  @IsString()
  callId: string;

  @IsString()
  scorecardId: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  scores: CriterionScoreDto[];

  @IsOptional()
  @IsString()
  evaluatorComments?: string;

  @IsOptional()
  @IsString()
  status?: EvaluationStatus;
}

export class UpdateEvaluationDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  scores?: CriterionScoreDto[];

  @IsOptional()
  @IsString()
  evaluatorComments?: string;

  @IsOptional()
  @IsString()
  status?: EvaluationStatus;
}

export class AgentFeedbackDto {
  @IsString()
  feedback: string;
}

export class AcknowledgeEvaluationDto {
  @IsOptional()
  @IsString()
  agentFeedback?: string;
}
