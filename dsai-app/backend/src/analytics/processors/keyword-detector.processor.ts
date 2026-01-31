import { Injectable, Logger } from '@nestjs/common';
import { KeywordCategory, Speaker } from '../entities/keyword-match.entity';

export interface KeywordDetectionResult {
  keyword: string;
  category: KeywordCategory;
  speaker: Speaker;
  matchedText: string;
  timestampMs?: number;
  confidence: number;
}

export interface KeywordRule {
  keyword: string;
  category: KeywordCategory;
  isCaseSensitive?: boolean;
  isRegex?: boolean;
}

export interface TranscriptSegmentForKeywords {
  speaker: Speaker;
  text: string;
  startMs?: number;
}

// Default keywords for each category
export const DEFAULT_KEYWORDS: KeywordRule[] = [
  // Compliance keywords
  { keyword: 'do not call', category: 'compliance' },
  { keyword: 'stop calling', category: 'compliance' },
  { keyword: 'remove me', category: 'compliance' },
  { keyword: 'take me off', category: 'compliance' },
  { keyword: 'lawyer', category: 'compliance' },
  { keyword: 'attorney', category: 'compliance' },
  { keyword: 'lawsuit', category: 'compliance' },
  { keyword: 'sue', category: 'compliance' },
  { keyword: 'recording this call', category: 'compliance' },

  // Objection keywords
  { keyword: 'not interested', category: 'objection' },
  { keyword: 'no thank you', category: 'objection' },
  { keyword: 'too expensive', category: 'objection' },
  { keyword: "can't afford", category: 'objection' },
  { keyword: 'call back later', category: 'objection' },
  { keyword: 'bad timing', category: 'objection' },
  { keyword: 'need to think', category: 'objection' },
  { keyword: 'talk to my', category: 'objection' },

  // Positive keywords
  { keyword: 'sounds good', category: 'positive' },
  { keyword: 'interested', category: 'positive' },
  { keyword: 'tell me more', category: 'positive' },
  { keyword: 'sign up', category: 'positive' },
  { keyword: 'sign me up', category: 'positive' },
  { keyword: "let's do it", category: 'positive' },
  { keyword: 'great', category: 'positive' },
  { keyword: 'perfect', category: 'positive' },
  { keyword: 'yes', category: 'positive' },

  // Negative keywords
  { keyword: 'frustrated', category: 'negative' },
  { keyword: 'angry', category: 'negative' },
  { keyword: 'upset', category: 'negative' },
  { keyword: 'terrible', category: 'negative' },
  { keyword: 'horrible', category: 'negative' },
  { keyword: 'worst', category: 'negative' },
  { keyword: 'ridiculous', category: 'negative' },
  { keyword: 'scam', category: 'negative' },
];

@Injectable()
export class KeywordDetectorProcessor {
  private readonly logger = new Logger(KeywordDetectorProcessor.name);

  /**
   * Detect keywords in transcript segments
   */
  detectKeywords(
    segments: TranscriptSegmentForKeywords[],
    customKeywords?: KeywordRule[],
  ): KeywordDetectionResult[] {
    const keywords = [...DEFAULT_KEYWORDS, ...(customKeywords || [])];
    const results: KeywordDetectionResult[] = [];

    for (const segment of segments) {
      const segmentText = segment.text;

      for (const rule of keywords) {
        const matches = this.findMatches(segmentText, rule);

        for (const matchedText of matches) {
          results.push({
            keyword: rule.keyword,
            category: rule.category,
            speaker: segment.speaker,
            matchedText,
            timestampMs: segment.startMs,
            confidence: this.calculateConfidence(rule, matchedText),
          });
        }
      }
    }

    return results;
  }

  /**
   * Detect keywords in plain text
   */
  detectInPlainText(
    text: string,
    speaker: Speaker,
    customKeywords?: KeywordRule[],
  ): KeywordDetectionResult[] {
    return this.detectKeywords(
      [{ speaker, text }],
      customKeywords,
    );
  }

  /**
   * Find all matches of a keyword in text
   */
  private findMatches(text: string, rule: KeywordRule): string[] {
    const matches: string[] = [];

    if (rule.isRegex) {
      try {
        const flags = rule.isCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(rule.keyword, flags);
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push(match[0]);
        }
      } catch (error) {
        this.logger.warn(`Invalid regex: ${rule.keyword}`);
      }
    } else {
      // Simple string matching
      const searchText = rule.isCaseSensitive ? text : text.toLowerCase();
      const searchKeyword = rule.isCaseSensitive
        ? rule.keyword
        : rule.keyword.toLowerCase();

      // Word boundary matching to avoid partial matches
      const regex = new RegExp(
        `\\b${this.escapeRegex(searchKeyword)}\\b`,
        rule.isCaseSensitive ? 'g' : 'gi',
      );

      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push(match[0]);
      }
    }

    return matches;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate confidence score based on match quality
   */
  private calculateConfidence(rule: KeywordRule, matchedText: string): number {
    // Higher confidence for exact matches, lower for partial
    if (rule.isCaseSensitive && matchedText === rule.keyword) {
      return 1.0;
    }
    if (matchedText.toLowerCase() === rule.keyword.toLowerCase()) {
      return 0.95;
    }
    // Regex matches might be partial
    if (rule.isRegex) {
      return 0.85;
    }
    return 0.9;
  }

  /**
   * Get keyword statistics from results
   */
  getKeywordStats(results: KeywordDetectionResult[]): {
    totalMatches: number;
    byCategory: Record<KeywordCategory, number>;
    bySpeaker: Record<Speaker, number>;
    topKeywords: Array<{ keyword: string; count: number }>;
  } {
    const byCategory: Record<KeywordCategory, number> = {
      compliance: 0,
      objection: 0,
      positive: 0,
      negative: 0,
      competitor: 0,
      custom: 0,
    };

    const bySpeaker: Record<Speaker, number> = {
      agent: 0,
      customer: 0,
    };

    const keywordCounts: Record<string, number> = {};

    for (const result of results) {
      byCategory[result.category]++;
      bySpeaker[result.speaker]++;
      keywordCounts[result.keyword] = (keywordCounts[result.keyword] || 0) + 1;
    }

    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalMatches: results.length,
      byCategory,
      bySpeaker,
      topKeywords,
    };
  }
}
