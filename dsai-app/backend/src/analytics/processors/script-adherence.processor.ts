import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../ai-common/services/llm-gateway.service';
import { ScriptMatch } from '../entities/call-analytics.entity';

export interface ScriptElement {
  id: string;
  text: string;
  required: boolean;
  order?: number;
}

export interface ScriptAdherenceResult {
  score: number; // 0-100
  matches: ScriptMatch[];
  missedElements: string[];
  analysis: string;
  cost: number;
}

@Injectable()
export class ScriptAdherenceProcessor {
  private readonly logger = new Logger(ScriptAdherenceProcessor.name);

  constructor(private readonly llmGateway: LlmGatewayService) {}

  /**
   * Analyze transcript for script adherence using LLM
   */
  async analyzeScriptAdherence(
    transcript: string,
    scriptElements: ScriptElement[],
    metadata?: {
      callId?: string;
      campaignId?: string;
      organizationId?: string;
    },
  ): Promise<ScriptAdherenceResult> {
    if (!scriptElements || scriptElements.length === 0) {
      return {
        score: 100,
        matches: [],
        missedElements: [],
        analysis: 'No script elements defined',
        cost: 0,
      };
    }

    const scriptList = scriptElements
      .map((e, i) => `${i + 1}. [${e.required ? 'REQUIRED' : 'OPTIONAL'}] ${e.text}`)
      .join('\n');

    const prompt = `Analyze this call transcript for script adherence.

SCRIPT ELEMENTS TO CHECK:
${scriptList}

TRANSCRIPT:
${transcript}

Return a JSON object with the following structure:
{
  "score": <number 0-100 representing overall adherence>,
  "matches": [
    {
      "element": "<script element text>",
      "matched": <true/false>,
      "matchedText": "<exact text from transcript that matches, or null if not found>",
      "notes": "<brief explanation>"
    }
  ],
  "missedElements": ["<list of required script elements that were not found>"],
  "analysis": "<brief overall analysis of script adherence>"
}

Be lenient with paraphrasing - if the agent conveyed the same meaning as the script element, count it as matched.
Focus on whether the key information was communicated, not exact wording.`;

    try {
      const result = await this.llmGateway.complete({
        messages: [
          {
            role: 'system',
            content:
              'You are a call quality analyst. Analyze transcripts for script adherence. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        featureType: 'speech_analytics',
        responseFormat: 'json',
        temperature: 0.3,
        maxTokens: 1500,
        metadata,
      });

      const parsed = JSON.parse(result.content);

      return {
        score: parsed.score || 0,
        matches: (parsed.matches || []).map((m: any) => ({
          element: m.element,
          matched: m.matched,
          matchedText: m.matchedText || undefined,
        })),
        missedElements: parsed.missedElements || [],
        analysis: parsed.analysis || '',
        cost: result.cost,
      };
    } catch (error) {
      this.logger.error(`Script adherence analysis failed: ${error}`);

      // Return a fallback result
      return {
        score: 0,
        matches: scriptElements.map((e) => ({
          element: e.text,
          matched: false,
        })),
        missedElements: scriptElements.filter((e) => e.required).map((e) => e.text),
        analysis: 'Analysis failed - please retry',
        cost: 0,
      };
    }
  }

  /**
   * Parse campaign script into elements
   */
  parseScriptText(scriptText: string): ScriptElement[] {
    const elements: ScriptElement[] = [];
    const lines = scriptText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check for required marker (e.g., "[REQUIRED]" or "*")
      const isRequired =
        line.includes('[REQUIRED]') ||
        line.includes('[REQ]') ||
        line.startsWith('*') ||
        line.startsWith('!');

      // Clean up the line
      const cleanText = line
        .replace(/\[REQUIRED\]/gi, '')
        .replace(/\[REQ\]/gi, '')
        .replace(/\[OPTIONAL\]/gi, '')
        .replace(/^[*!-]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim();

      if (cleanText) {
        elements.push({
          id: `script-${i}`,
          text: cleanText,
          required: isRequired,
          order: i,
        });
      }
    }

    return elements;
  }

  /**
   * Calculate adherence score without LLM (basic matching)
   */
  calculateBasicAdherence(
    transcript: string,
    scriptElements: ScriptElement[],
  ): { score: number; matches: ScriptMatch[] } {
    const lowerTranscript = transcript.toLowerCase();
    const matches: ScriptMatch[] = [];
    let requiredMatched = 0;
    let requiredTotal = 0;

    for (const element of scriptElements) {
      const lowerElement = element.text.toLowerCase();

      // Simple word-based matching
      const words = lowerElement.split(/\s+/).filter((w) => w.length > 3);
      const matchingWords = words.filter((word) =>
        lowerTranscript.includes(word),
      );
      const matchRatio = words.length > 0 ? matchingWords.length / words.length : 0;

      const matched = matchRatio >= 0.6; // 60% word match threshold

      matches.push({
        element: element.text,
        matched,
      });

      if (element.required) {
        requiredTotal++;
        if (matched) requiredMatched++;
      }
    }

    const score = requiredTotal > 0
      ? Math.round((requiredMatched / requiredTotal) * 100)
      : 100;

    return { score, matches };
  }
}
