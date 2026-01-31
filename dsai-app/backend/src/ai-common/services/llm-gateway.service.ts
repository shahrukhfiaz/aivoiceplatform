import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
  DEFAULT_MODELS,
  PROVIDER_PRICING,
} from '../interfaces/ai-provider.interface';
import { AiCostTrackerService } from './ai-cost-tracker.service';
import { AiProvider, AiFeatureType } from '../entities/ai-usage-log.entity';

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface ClaudeResponse {
  id: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private readonly openaiApiKey: string;
  private readonly geminiApiKey: string;
  private readonly claudeApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly costTracker: AiCostTrackerService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.claudeApiKey = this.configService.get<string>('ANTHROPIC_API_KEY') || '';
  }

  /**
   * Main completion method - routes to the appropriate provider
   */
  async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const startTime = Date.now();
    const defaultConfig = DEFAULT_MODELS[options.featureType];
    const provider = options.provider || defaultConfig.provider;
    const model = options.model || defaultConfig.model;

    this.logger.debug(`LLM request: ${provider}/${model} for ${options.featureType}`);

    try {
      let result: LlmCompletionResult;

      switch (provider) {
        case 'openai':
          result = await this.completeWithOpenAI(model, options);
          break;
        case 'gemini':
          result = await this.completeWithGemini(model, options);
          break;
        case 'claude':
          result = await this.completeWithClaude(model, options);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      // Log successful usage
      await this.costTracker.logUsage({
        featureType: options.featureType,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        requestId: result.requestId,
        ...options.metadata,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`LLM error (${provider}/${model}): ${errorMessage}`);

      // Log failed usage
      await this.costTracker.logError({
        featureType: options.featureType,
        provider,
        model,
        errorMessage,
        latencyMs,
        ...options.metadata,
      });

      // Try fallback provider if available
      if (options.provider) {
        // User specified provider, don't fallback
        throw error;
      }

      const fallbackResult = await this.tryFallback(options, provider, startTime);
      if (fallbackResult) {
        return fallbackResult;
      }

      throw error;
    }
  }

  /**
   * Complete with fallback providers
   */
  private async tryFallback(
    options: LlmCompletionOptions,
    failedProvider: AiProvider,
    originalStartTime: number,
  ): Promise<LlmCompletionResult | null> {
    const fallbackOrder: AiProvider[] = ['openai', 'gemini', 'claude'];
    const availableFallbacks = fallbackOrder.filter(
      (p) => p !== failedProvider && this.hasApiKey(p),
    );

    for (const fallbackProvider of availableFallbacks) {
      try {
        this.logger.warn(`Trying fallback provider: ${fallbackProvider}`);
        const fallbackModel = this.getDefaultModelForProvider(fallbackProvider);

        const result = await this.complete({
          ...options,
          provider: fallbackProvider,
          model: fallbackModel,
        });

        return result;
      } catch (fallbackError) {
        this.logger.error(`Fallback ${fallbackProvider} also failed`);
        continue;
      }
    }

    return null;
  }

  /**
   * Check if we have an API key for a provider
   */
  private hasApiKey(provider: AiProvider): boolean {
    switch (provider) {
      case 'openai':
        return !!this.openaiApiKey;
      case 'gemini':
        return !!this.geminiApiKey;
      case 'claude':
        return !!this.claudeApiKey;
      default:
        return false;
    }
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModelForProvider(provider: AiProvider): string {
    switch (provider) {
      case 'openai':
        return 'gpt-4o-mini';
      case 'gemini':
        return 'gemini-2.0-flash-exp';
      case 'claude':
        return 'claude-3-haiku-20240307';
      default:
        return 'gpt-4o-mini';
    }
  }

  /**
   * OpenAI completion
   */
  private async completeWithOpenAI(
    model: string,
    options: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    const startTime = Date.now();

    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    };

    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data: OpenAIResponse = await response.json();
    const latencyMs = Date.now() - startTime;

    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = this.costTracker.calculateCost('openai', model, inputTokens, outputTokens);

    return {
      content: data.choices[0]?.message?.content || '',
      inputTokens,
      outputTokens,
      cost,
      latencyMs,
      provider: 'openai',
      model,
      requestId: data.id,
    };
  }

  /**
   * Google Gemini completion
   */
  private async completeWithGemini(
    model: string,
    options: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    const startTime = Date.now();

    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Convert messages to Gemini format
    const contents = this.convertToGeminiFormat(options.messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };

    if (options.responseFormat === 'json') {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data: GeminiResponse = await response.json();
    const latencyMs = Date.now() - startTime;

    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    const cost = this.costTracker.calculateCost('gemini', model, inputTokens, outputTokens);

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      inputTokens,
      outputTokens,
      cost,
      latencyMs,
      provider: 'gemini',
      model,
    };
  }

  /**
   * Anthropic Claude completion
   */
  private async completeWithClaude(
    model: string,
    options: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    const startTime = Date.now();

    if (!this.claudeApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Separate system message from other messages for Claude
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const otherMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 2048,
      messages: otherMessages,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data: ClaudeResponse = await response.json();
    const latencyMs = Date.now() - startTime;

    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = this.costTracker.calculateCost('claude', model, inputTokens, outputTokens);

    const content = data.content?.[0]?.text || '';

    return {
      content,
      inputTokens,
      outputTokens,
      cost,
      latencyMs,
      provider: 'claude',
      model,
      requestId: data.id,
    };
  }

  /**
   * Convert standard messages to Gemini format
   */
  private convertToGeminiFormat(messages: LlmMessage[]): Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Combine system message with first user message for Gemini
    let systemContent = '';
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      systemContent = systemMsg.content + '\n\n';
    }

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      const role = msg.role === 'assistant' ? 'model' : 'user';
      let content = msg.content;

      // Prepend system content to first user message
      if (systemContent && msg.role === 'user') {
        content = systemContent + content;
        systemContent = '';
      }

      contents.push({
        role,
        parts: [{ text: content }],
      });
    }

    return contents;
  }

  /**
   * Get available providers based on configured API keys
   */
  getAvailableProviders(): AiProvider[] {
    const providers: AiProvider[] = [];
    if (this.openaiApiKey) providers.push('openai');
    if (this.geminiApiKey) providers.push('gemini');
    if (this.claudeApiKey) providers.push('claude');
    return providers;
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider: AiProvider): string[] {
    const pricing = PROVIDER_PRICING[provider];
    return pricing ? Object.keys(pricing) : [];
  }
}
