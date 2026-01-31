import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../ai-common/services/llm-gateway.service';
import { CategoryScore, SpecificFeedback } from '../entities/ai-evaluation.entity';

export interface QaScorecard {
  id: string;
  name: string;
  categories: Array<{
    name: string;
    weight: number;
    criteria: Array<{
      question: string;
      type: 'yes_no' | 'scale_1_5' | 'text';
      points: number;
    }>;
  }>;
  passingScore?: number;
}

export interface EvaluationResult {
  categoryScores: CategoryScore[];
  totalScore: number;
  passed: boolean;
  overallSummary: string;
  strengths: string[];
  areasForImprovement: string[];
  specificFeedback: SpecificFeedback[];
  inputTokens: number;
  outputTokens: number;
  cost: number;
  provider: string;
  model: string;
}

@Injectable()
export class LlmEvaluator {
  private readonly logger = new Logger(LlmEvaluator.name);

  constructor(private readonly llmGateway: LlmGatewayService) {}

  /**
   * Evaluate a call transcript using LLM against a QA scorecard
   */
  async evaluateCall(
    transcript: string,
    scorecard: QaScorecard,
    metadata?: {
      callId?: string;
      agentId?: string;
      campaignId?: string;
      organizationId?: string;
    },
  ): Promise<EvaluationResult> {
    const scorecardDescription = this.formatScorecardForPrompt(scorecard);

    const prompt = `You are a call center quality analyst. Evaluate the following call transcript against the provided QA scorecard.

## QA SCORECARD: ${scorecard.name}
${scorecardDescription}

## CALL TRANSCRIPT:
${transcript}

## EVALUATION INSTRUCTIONS:
1. Score each category based on the criteria provided
2. Provide specific feedback with timestamps where possible
3. Be fair but thorough - note both strengths and areas for improvement
4. Consider the context and customer responses when scoring

Return your evaluation as a JSON object with this exact structure:
{
  "categoryScores": [
    {
      "name": "<category name>",
      "score": <0-100>,
      "weight": <weight from scorecard>,
      "reasoning": "<brief explanation>",
      "criteria": [
        {
          "question": "<criterion question>",
          "score": <points earned>,
          "notes": "<optional notes>"
        }
      ]
    }
  ],
  "totalScore": <weighted average 0-100>,
  "passed": <true if totalScore >= ${scorecard.passingScore || 70}>,
  "overallSummary": "<2-3 sentence summary of the call quality>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "areasForImprovement": ["<area 1>", "<area 2>", ...],
  "specificFeedback": [
    {
      "timestamp": "<approximate time or 'Beginning'/'Middle'/'End'>",
      "utterance": "<relevant quote from transcript>",
      "feedback": "<specific feedback>",
      "severity": "<'info' | 'warning' | 'critical'>",
      "category": "<related category name>"
    }
  ]
}

Be constructive and specific in your feedback. Focus on actionable improvements.`;

    try {
      const result = await this.llmGateway.complete({
        messages: [
          {
            role: 'system',
            content:
              'You are an expert call center quality analyst. Evaluate calls fairly and provide constructive, actionable feedback. Always return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        featureType: 'coaching',
        responseFormat: 'json',
        temperature: 0.3, // More deterministic for evaluation
        maxTokens: 3000,
        metadata,
      });

      const parsed = JSON.parse(result.content);

      return {
        categoryScores: parsed.categoryScores || [],
        totalScore: parsed.totalScore || 0,
        passed: parsed.passed ?? false,
        overallSummary: parsed.overallSummary || '',
        strengths: parsed.strengths || [],
        areasForImprovement: parsed.areasForImprovement || [],
        specificFeedback: (parsed.specificFeedback || []).map((f: any) => ({
          timestamp: f.timestamp,
          utterance: f.utterance,
          feedback: f.feedback,
          severity: f.severity || 'info',
          category: f.category,
        })),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost,
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      this.logger.error(`LLM evaluation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Generate coaching insights from multiple evaluations
   */
  async generateInsights(
    agentId: string,
    evaluations: Array<{
      callId: string;
      totalScore: number;
      categoryScores: CategoryScore[];
      areasForImprovement: string[];
      strengths: string[];
    }>,
    metadata?: {
      campaignId?: string;
      organizationId?: string;
    },
  ): Promise<{
    insights: Array<{
      type: 'strength' | 'weakness' | 'trend' | 'recommendation';
      category: string;
      title: string;
      description: string;
      severity: number;
      actionItems: string[];
    }>;
    cost: number;
  }> {
    if (evaluations.length < 3) {
      return { insights: [], cost: 0 };
    }

    // Summarize evaluations for the prompt
    const evalSummary = evaluations.map((e, i) => ({
      callNumber: i + 1,
      score: e.totalScore,
      categoryBreakdown: e.categoryScores.map((c) => `${c.name}: ${c.score}`).join(', '),
      strengths: e.strengths.slice(0, 2).join(', '),
      improvements: e.areasForImprovement.slice(0, 2).join(', '),
    }));

    const prompt = `Analyze these ${evaluations.length} recent call evaluations for an agent and identify patterns and coaching opportunities.

## EVALUATION SUMMARY:
${JSON.stringify(evalSummary, null, 2)}

## ANALYSIS REQUIRED:
1. Identify consistent strengths (appears in 50%+ of calls)
2. Identify consistent weaknesses (appears in 30%+ of calls)
3. Identify trends (improving, declining, or stable)
4. Provide specific, actionable coaching recommendations

Return a JSON object:
{
  "insights": [
    {
      "type": "<'strength' | 'weakness' | 'trend' | 'recommendation'>",
      "category": "<category name or 'Overall'>",
      "title": "<short title>",
      "description": "<detailed description>",
      "severity": <1-10, higher = more important>,
      "actionItems": ["<specific action 1>", "<specific action 2>"]
    }
  ]
}

Focus on patterns, not one-off issues. Provide 3-5 key insights.`;

    try {
      const result = await this.llmGateway.complete({
        messages: [
          {
            role: 'system',
            content:
              'You are a call center coach. Analyze performance data and provide actionable coaching insights. Always return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        featureType: 'coaching',
        responseFormat: 'json',
        temperature: 0.4,
        maxTokens: 2000,
        metadata: { agentId, ...metadata },
      });

      const parsed = JSON.parse(result.content);

      return {
        insights: parsed.insights || [],
        cost: result.cost,
      };
    } catch (error) {
      this.logger.error(`Insight generation failed: ${error}`);
      return { insights: [], cost: 0 };
    }
  }

  /**
   * Format scorecard for LLM prompt
   */
  private formatScorecardForPrompt(scorecard: QaScorecard): string {
    return scorecard.categories
      .map((cat) => {
        const criteriaList = cat.criteria
          .map((c) => `  - ${c.question} (${c.type}, ${c.points} points)`)
          .join('\n');
        return `### ${cat.name} (Weight: ${cat.weight * 100}%)\n${criteriaList}`;
      })
      .join('\n\n');
  }

  /**
   * Create a simple default scorecard when none is provided
   */
  getDefaultScorecard(): QaScorecard {
    return {
      id: 'default',
      name: 'Default Call Quality Scorecard',
      passingScore: 70,
      categories: [
        {
          name: 'Opening',
          weight: 0.15,
          criteria: [
            { question: 'Agent identified themselves and company', type: 'yes_no', points: 5 },
            { question: 'Verified customer identity appropriately', type: 'yes_no', points: 5 },
            { question: 'Set clear expectations for the call', type: 'yes_no', points: 5 },
          ],
        },
        {
          name: 'Communication Skills',
          weight: 0.25,
          criteria: [
            { question: 'Spoke clearly and professionally', type: 'scale_1_5', points: 10 },
            { question: 'Used active listening', type: 'scale_1_5', points: 10 },
            { question: 'Showed empathy when appropriate', type: 'scale_1_5', points: 5 },
          ],
        },
        {
          name: 'Product Knowledge',
          weight: 0.2,
          criteria: [
            { question: 'Demonstrated knowledge of products/services', type: 'scale_1_5', points: 10 },
            { question: 'Accurately answered customer questions', type: 'scale_1_5', points: 10 },
          ],
        },
        {
          name: 'Objection Handling',
          weight: 0.2,
          criteria: [
            { question: 'Acknowledged customer concerns', type: 'yes_no', points: 5 },
            { question: 'Provided appropriate responses to objections', type: 'scale_1_5', points: 10 },
            { question: 'Attempted to overcome objections professionally', type: 'yes_no', points: 5 },
          ],
        },
        {
          name: 'Closing',
          weight: 0.2,
          criteria: [
            { question: 'Summarized key points of the call', type: 'yes_no', points: 5 },
            { question: 'Confirmed next steps with customer', type: 'yes_no', points: 5 },
            { question: 'Ended call professionally', type: 'yes_no', points: 5 },
          ],
        },
      ],
    };
  }
}
