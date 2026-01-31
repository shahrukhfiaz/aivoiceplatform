import { AiFeatureType, AiProvider } from '../entities/ai-usage-log.entity';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionOptions {
  provider?: AiProvider;
  model?: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  featureType: AiFeatureType;
  metadata?: {
    callId?: string;
    leadId?: string;
    agentId?: string;
    campaignId?: string;
    organizationId?: string;
  };
}

export interface LlmCompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  provider: AiProvider;
  model: string;
  requestId?: string;
}

export interface ProviderConfig {
  name: AiProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  models: {
    [key: string]: {
      inputCostPer1k: number;
      outputCostPer1k: number;
      maxContextTokens: number;
    };
  };
}

// Cost per 1K tokens in USD (as of 2025)
export const PROVIDER_PRICING: Record<string, ProviderConfig['models']> = {
  openai: {
    'gpt-4o': {
      inputCostPer1k: 0.0025,
      outputCostPer1k: 0.01,
      maxContextTokens: 128000,
    },
    'gpt-4o-mini': {
      inputCostPer1k: 0.00015,
      outputCostPer1k: 0.0006,
      maxContextTokens: 128000,
    },
    'gpt-4-turbo': {
      inputCostPer1k: 0.01,
      outputCostPer1k: 0.03,
      maxContextTokens: 128000,
    },
  },
  gemini: {
    'gemini-2.0-flash-exp': {
      inputCostPer1k: 0.0,
      outputCostPer1k: 0.0,
      maxContextTokens: 1000000,
    },
    'gemini-1.5-pro': {
      inputCostPer1k: 0.00125,
      outputCostPer1k: 0.005,
      maxContextTokens: 2000000,
    },
    'gemini-1.5-flash': {
      inputCostPer1k: 0.000075,
      outputCostPer1k: 0.0003,
      maxContextTokens: 1000000,
    },
  },
  claude: {
    'claude-3-5-sonnet-20241022': {
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
      maxContextTokens: 200000,
    },
    'claude-3-haiku-20240307': {
      inputCostPer1k: 0.00025,
      outputCostPer1k: 0.00125,
      maxContextTokens: 200000,
    },
    'claude-3-opus-20240229': {
      inputCostPer1k: 0.015,
      outputCostPer1k: 0.075,
      maxContextTokens: 200000,
    },
  },
};

// Default models for each feature type (optimized for cost/quality balance)
export const DEFAULT_MODELS: Record<AiFeatureType, { provider: AiProvider; model: string }> = {
  speech_analytics: { provider: 'openai', model: 'gpt-4o-mini' },
  lead_scoring: { provider: 'openai', model: 'gpt-4o-mini' },
  coaching: { provider: 'openai', model: 'gpt-4o-mini' },
  sentiment: { provider: 'openai', model: 'gpt-4o-mini' },
};
