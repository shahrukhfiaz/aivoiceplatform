import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../ai-common/services/llm-gateway.service';
import {
  SentimentLabel,
  Emotion,
  EmotionDetection,
  SentimentTrajectoryPoint,
  SatisfactionIndicator,
  sentimentToLabel,
} from '../entities/call-sentiment.entity';

export interface TranscriptForSentiment {
  speaker: 'agent' | 'customer';
  text: string;
  timestampMs?: number;
}

export interface UtteranceSentimentResult {
  speaker: 'agent' | 'customer';
  text: string;
  timestampMs?: number;
  sentiment: number;
  sentimentLabel: SentimentLabel;
  emotion?: Emotion;
  emotionIntensity?: number;
  keywords?: string[];
}

export interface SentimentAnalysisResult {
  overallSentiment: number;
  overallLabel: SentimentLabel;
  customerStartSentiment: number;
  customerEndSentiment: number;
  customerSentimentDelta: number;
  emotionsDetected: EmotionDetection[];
  dominantEmotion: Emotion;
  sentimentTrajectory: SentimentTrajectoryPoint[];
  customerSatisfied: boolean;
  satisfactionConfidence: number;
  satisfactionIndicators: SatisfactionIndicator[];
  utterances: UtteranceSentimentResult[];
  cost: number;
  provider: string;
  model: string;
}

@Injectable()
export class LlmSentimentAnalyzer {
  private readonly logger = new Logger(LlmSentimentAnalyzer.name);

  constructor(private readonly llmGateway: LlmGatewayService) {}

  /**
   * Analyze sentiment of a call transcript
   */
  async analyzeTranscript(
    segments: TranscriptForSentiment[],
    metadata?: {
      callId?: string;
      campaignId?: string;
      organizationId?: string;
    },
  ): Promise<SentimentAnalysisResult> {
    const transcript = segments
      .map((s, i) => `[${i + 1}] ${s.speaker.toUpperCase()}: ${s.text}`)
      .join('\n');

    const prompt = `Analyze the sentiment and emotions in this customer service call transcript.

## TRANSCRIPT:
${transcript}

## ANALYSIS REQUIRED:
1. Overall sentiment (-1 to 1, where -1 = very negative, 0 = neutral, 1 = very positive)
2. Customer journey (sentiment at start, end, and change)
3. Emotions detected (angry, frustrated, confused, neutral, satisfied, happy, excited)
4. Sentiment trajectory over the call
5. Customer satisfaction assessment

Return a JSON object with this structure:
{
  "overallSentiment": <-1 to 1>,
  "customerStartSentiment": <-1 to 1, customer's sentiment in first few exchanges>,
  "customerEndSentiment": <-1 to 1, customer's sentiment in last few exchanges>,
  "emotionsDetected": [
    {
      "emotion": "<emotion name>",
      "count": <number of times detected>,
      "avgIntensity": <0-1>
    }
  ],
  "dominantEmotion": "<most frequent/intense emotion>",
  "sentimentTrajectory": [
    {
      "timestampPercent": <0, 25, 50, 75, 100>,
      "sentiment": <-1 to 1>,
      "speaker": "<agent or customer>"
    }
  ],
  "customerSatisfied": <true/false>,
  "satisfactionConfidence": <0-1>,
  "satisfactionIndicators": [
    {
      "indicator": "<what indicates satisfaction/dissatisfaction>",
      "present": <true/false>,
      "quote": "<relevant quote from transcript>"
    }
  ],
  "utterances": [
    {
      "sequenceNumber": <1, 2, 3...>,
      "speaker": "<agent or customer>",
      "sentiment": <-1 to 1>,
      "emotion": "<emotion if strong>",
      "emotionIntensity": <0-1 if emotion present>,
      "keywords": ["<sentiment-bearing words>"]
    }
  ]
}

Be accurate and nuanced. Consider context - sarcasm, politeness formulas, etc.`;

    try {
      const result = await this.llmGateway.complete({
        messages: [
          {
            role: 'system',
            content:
              'You are an expert sentiment analyst. Analyze conversations accurately, considering context, tone, and subtle emotional cues. Always return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        featureType: 'sentiment',
        responseFormat: 'json',
        temperature: 0.3,
        maxTokens: 2500,
        metadata,
      });

      const parsed = JSON.parse(result.content);

      // Calculate delta
      const customerSentimentDelta =
        (parsed.customerEndSentiment || 0) - (parsed.customerStartSentiment || 0);

      // Map utterances back to original segments
      const utterances: UtteranceSentimentResult[] = segments.map((seg, i) => {
        const llmUtterance = parsed.utterances?.find(
          (u: any) => u.sequenceNumber === i + 1,
        );

        return {
          speaker: seg.speaker,
          text: seg.text,
          timestampMs: seg.timestampMs,
          sentiment: llmUtterance?.sentiment || 0,
          sentimentLabel: sentimentToLabel(llmUtterance?.sentiment || 0),
          emotion: llmUtterance?.emotion,
          emotionIntensity: llmUtterance?.emotionIntensity,
          keywords: llmUtterance?.keywords,
        };
      });

      return {
        overallSentiment: parsed.overallSentiment || 0,
        overallLabel: sentimentToLabel(parsed.overallSentiment || 0),
        customerStartSentiment: parsed.customerStartSentiment || 0,
        customerEndSentiment: parsed.customerEndSentiment || 0,
        customerSentimentDelta,
        emotionsDetected: parsed.emotionsDetected || [],
        dominantEmotion: parsed.dominantEmotion || 'neutral',
        sentimentTrajectory: parsed.sentimentTrajectory || [],
        customerSatisfied: parsed.customerSatisfied ?? false,
        satisfactionConfidence: parsed.satisfactionConfidence || 0.5,
        satisfactionIndicators: parsed.satisfactionIndicators || [],
        utterances,
        cost: result.cost,
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      this.logger.error(`Sentiment analysis failed: ${error}`);
      throw error;
    }
  }

  /**
   * Quick sentiment analysis for a single utterance (no LLM, rule-based)
   */
  analyzeUtteranceBasic(text: string): {
    sentiment: number;
    label: SentimentLabel;
  } {
    const lowerText = text.toLowerCase();

    // Simple keyword-based scoring
    const positiveWords = [
      'thank',
      'thanks',
      'great',
      'perfect',
      'excellent',
      'wonderful',
      'amazing',
      'appreciate',
      'helpful',
      'good',
      'love',
      'happy',
      'pleased',
      'satisfied',
      'awesome',
      'fantastic',
    ];

    const negativeWords = [
      'terrible',
      'horrible',
      'awful',
      'worst',
      'bad',
      'hate',
      'angry',
      'frustrated',
      'annoyed',
      'disappointed',
      'upset',
      'ridiculous',
      'useless',
      'waste',
      'incompetent',
    ];

    const strongNegativeWords = [
      'lawsuit',
      'sue',
      'lawyer',
      'scam',
      'fraud',
      'steal',
      'liar',
    ];

    let score = 0;
    let wordCount = 0;

    const words = lowerText.split(/\s+/);

    for (const word of words) {
      if (positiveWords.some((pw) => word.includes(pw))) {
        score += 1;
        wordCount++;
      }
      if (negativeWords.some((nw) => word.includes(nw))) {
        score -= 1;
        wordCount++;
      }
      if (strongNegativeWords.some((snw) => word.includes(snw))) {
        score -= 2;
        wordCount++;
      }
    }

    // Normalize to -1 to 1 range
    const sentiment = wordCount > 0 ? Math.max(-1, Math.min(1, score / wordCount)) : 0;

    return {
      sentiment,
      label: sentimentToLabel(sentiment),
    };
  }
}
