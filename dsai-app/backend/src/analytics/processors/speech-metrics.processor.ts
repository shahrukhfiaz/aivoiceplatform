import { Injectable, Logger } from '@nestjs/common';

export interface TranscriptSegment {
  speaker: 'agent' | 'customer';
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface SpeechMetrics {
  // Talk ratios
  talkRatio: number;
  listenRatio: number;
  agentTalkTimeSeconds: number;
  customerTalkTimeSeconds: number;
  totalCallDurationSeconds: number;

  // Silence
  totalSilenceSeconds: number;
  silenceCount: number;
  avgSilenceDuration: number;
  longestSilenceSeconds: number;

  // Pace
  agentWordsPerMinute: number;
  customerWordsPerMinute: number;
  agentWordCount: number;
  customerWordCount: number;

  // Interruptions
  agentInterruptions: number;
  customerInterruptions: number;
}

@Injectable()
export class SpeechMetricsProcessor {
  private readonly logger = new Logger(SpeechMetricsProcessor.name);

  /**
   * Process transcript segments to extract speech metrics
   */
  processTranscript(
    segments: TranscriptSegment[],
    totalDurationMs?: number,
  ): SpeechMetrics {
    if (!segments || segments.length === 0) {
      return this.getEmptyMetrics();
    }

    // Calculate word counts
    const agentSegments = segments.filter((s) => s.speaker === 'agent');
    const customerSegments = segments.filter((s) => s.speaker === 'customer');

    const agentWordCount = this.countWords(agentSegments);
    const customerWordCount = this.countWords(customerSegments);
    const totalWordCount = agentWordCount + customerWordCount;

    // Calculate talk times (estimate if no timestamps)
    let agentTalkTimeMs = 0;
    let customerTalkTimeMs = 0;
    let totalDuration = totalDurationMs || 0;

    if (segments[0]?.startMs !== undefined && segments[0]?.endMs !== undefined) {
      // Use actual timestamps if available
      for (const segment of agentSegments) {
        agentTalkTimeMs += (segment.endMs || 0) - (segment.startMs || 0);
      }
      for (const segment of customerSegments) {
        customerTalkTimeMs += (segment.endMs || 0) - (segment.startMs || 0);
      }

      // Get total duration from last segment
      const lastSegment = segments[segments.length - 1];
      totalDuration = totalDuration || (lastSegment.endMs || 0);
    } else {
      // Estimate based on word count (average 150 words per minute)
      const avgMsPerWord = 400; // ~150 WPM
      agentTalkTimeMs = agentWordCount * avgMsPerWord;
      customerTalkTimeMs = customerWordCount * avgMsPerWord;
      totalDuration = totalDuration || agentTalkTimeMs + customerTalkTimeMs + 30000; // Add 30s for pauses
    }

    const totalTalkTimeMs = agentTalkTimeMs + customerTalkTimeMs;

    // Calculate silence metrics
    const silenceMetrics = this.calculateSilenceMetrics(segments, totalDuration);

    // Calculate interruptions
    const interruptions = this.calculateInterruptions(segments);

    // Calculate words per minute
    const agentTalkMinutes = agentTalkTimeMs / 60000 || 1;
    const customerTalkMinutes = customerTalkTimeMs / 60000 || 1;

    return {
      talkRatio: totalTalkTimeMs > 0 ? agentTalkTimeMs / totalTalkTimeMs : 0.5,
      listenRatio: totalTalkTimeMs > 0 ? customerTalkTimeMs / totalTalkTimeMs : 0.5,
      agentTalkTimeSeconds: Math.round(agentTalkTimeMs / 1000),
      customerTalkTimeSeconds: Math.round(customerTalkTimeMs / 1000),
      totalCallDurationSeconds: Math.round(totalDuration / 1000),
      ...silenceMetrics,
      agentWordsPerMinute: Math.round(agentWordCount / agentTalkMinutes),
      customerWordsPerMinute: Math.round(customerWordCount / customerTalkMinutes),
      agentWordCount,
      customerWordCount,
      ...interruptions,
    };
  }

  /**
   * Process plain text transcript (when no structured segments available)
   */
  processPlainTextTranscript(
    transcript: string,
    totalDurationMs?: number,
  ): SpeechMetrics {
    const segments = this.parseTranscriptText(transcript);
    return this.processTranscript(segments, totalDurationMs);
  }

  /**
   * Parse plain text transcript into segments
   * Expects format like:
   * Agent: Hello, how can I help you?
   * Customer: I have a question about my account.
   */
  private parseTranscriptText(transcript: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const lines = transcript.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Match patterns like "Agent:", "Customer:", "AI:", "User:"
      const agentMatch = trimmedLine.match(/^(agent|ai|assistant|rep|representative):\s*(.+)/i);
      const customerMatch = trimmedLine.match(/^(customer|user|caller|client):\s*(.+)/i);

      if (agentMatch) {
        segments.push({ speaker: 'agent', text: agentMatch[2] });
      } else if (customerMatch) {
        segments.push({ speaker: 'customer', text: customerMatch[2] });
      }
    }

    return segments;
  }

  /**
   * Count words in segments
   */
  private countWords(segments: TranscriptSegment[]): number {
    return segments.reduce((count, segment) => {
      const words = segment.text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);
      return count + words.length;
    }, 0);
  }

  /**
   * Calculate silence metrics from segments with timestamps
   */
  private calculateSilenceMetrics(
    segments: TranscriptSegment[],
    totalDurationMs: number,
  ): {
    totalSilenceSeconds: number;
    silenceCount: number;
    avgSilenceDuration: number;
    longestSilenceSeconds: number;
  } {
    const silences: number[] = [];

    // Only calculate if we have timestamps
    if (segments.length > 1 && segments[0]?.startMs !== undefined) {
      for (let i = 1; i < segments.length; i++) {
        const prevEnd = segments[i - 1].endMs || 0;
        const currStart = segments[i].startMs || 0;
        const gap = currStart - prevEnd;

        // Count gaps > 500ms as silence
        if (gap > 500) {
          silences.push(gap);
        }
      }
    }

    const totalSilenceMs = silences.reduce((sum, s) => sum + s, 0);
    const longestSilenceMs = silences.length > 0 ? Math.max(...silences) : 0;

    return {
      totalSilenceSeconds: Math.round(totalSilenceMs / 1000),
      silenceCount: silences.length,
      avgSilenceDuration: silences.length > 0
        ? Math.round(totalSilenceMs / silences.length / 1000 * 10) / 10
        : 0,
      longestSilenceSeconds: Math.round(longestSilenceMs / 1000),
    };
  }

  /**
   * Calculate interruptions (when one speaker starts before the other finishes)
   */
  private calculateInterruptions(segments: TranscriptSegment[]): {
    agentInterruptions: number;
    customerInterruptions: number;
  } {
    let agentInterruptions = 0;
    let customerInterruptions = 0;

    if (segments.length < 2 || segments[0]?.startMs === undefined) {
      return { agentInterruptions: 0, customerInterruptions: 0 };
    }

    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];

      // Check for overlap (current starts before previous ends)
      if (
        prev.endMs !== undefined &&
        curr.startMs !== undefined &&
        curr.startMs < prev.endMs
      ) {
        if (curr.speaker === 'agent') {
          agentInterruptions++;
        } else {
          customerInterruptions++;
        }
      }
    }

    return { agentInterruptions, customerInterruptions };
  }

  /**
   * Return empty metrics object
   */
  private getEmptyMetrics(): SpeechMetrics {
    return {
      talkRatio: 0,
      listenRatio: 0,
      agentTalkTimeSeconds: 0,
      customerTalkTimeSeconds: 0,
      totalCallDurationSeconds: 0,
      totalSilenceSeconds: 0,
      silenceCount: 0,
      avgSilenceDuration: 0,
      longestSilenceSeconds: 0,
      agentWordsPerMinute: 0,
      customerWordsPerMinute: 0,
      agentWordCount: 0,
      customerWordCount: 0,
      agentInterruptions: 0,
      customerInterruptions: 0,
    };
  }
}
