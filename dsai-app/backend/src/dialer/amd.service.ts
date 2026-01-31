import { Injectable, Logger } from '@nestjs/common';
import { Campaign, AmdSettings, AmdMode } from '../campaigns/campaign.entity';

/**
 * AMD (Answering Machine Detection) Service
 *
 * Handles AMD configuration and result processing for predictive dialing.
 * Works with Asterisk's AMD() application or external AMD providers.
 */

export interface AmdConfig {
  initialSilence: number; // ms before detecting silence (machine if too long)
  greeting: number; // ms max greeting length (machine typically > 1500ms)
  afterGreetingSilence: number; // ms silence after greeting
  totalAnalysisTime: number; // ms max total analysis time
  minWordLength: number; // ms minimum word length
  betweenWordsSilence: number; // ms silence between words
  maximumWordLength: number; // ms max word length
  silenceThreshold: number; // 0-32767 noise threshold
}

export type AmdResult = 'HUMAN' | 'MACHINE' | 'NOTSURE' | 'HANGUP';
export type AmdCause =
  | 'TOOLONG' // Analysis took too long
  | 'INITIALSILENCE' // Too much initial silence
  | 'HUMAN' // Human speech detected
  | 'LONGGREETING' // Greeting too long (machine)
  | 'MAXWORDLENGTH' // Single word too long (machine)
  | 'UNKNOWN'; // Unknown cause

export interface AmdResultPayload {
  callId: string;
  campaignId: string;
  leadId: string;
  result: AmdResult;
  cause: AmdCause;
  analysisTime: number; // ms
}

@Injectable()
export class AmdService {
  private readonly logger = new Logger(AmdService.name);

  /**
   * AMD preset configurations
   *
   * - fast: Quick detection, more false positives
   * - balanced: Default, good accuracy/speed tradeoff
   * - accurate: Slower but more accurate
   */
  private readonly AMD_PRESETS: Record<AmdMode, AmdConfig> = {
    fast: {
      initialSilence: 1500,
      greeting: 1000,
      afterGreetingSilence: 600,
      totalAnalysisTime: 3000,
      minWordLength: 80,
      betweenWordsSilence: 50,
      maximumWordLength: 4000,
      silenceThreshold: 256,
    },
    balanced: {
      initialSilence: 2500,
      greeting: 1500,
      afterGreetingSilence: 800,
      totalAnalysisTime: 5000,
      minWordLength: 100,
      betweenWordsSilence: 50,
      maximumWordLength: 5000,
      silenceThreshold: 256,
    },
    accurate: {
      initialSilence: 3500,
      greeting: 2500,
      afterGreetingSilence: 1000,
      totalAnalysisTime: 8000,
      minWordLength: 120,
      betweenWordsSilence: 75,
      maximumWordLength: 6000,
      silenceThreshold: 200,
    },
  };

  /**
   * Default AMD configuration (balanced preset)
   */
  private readonly DEFAULT_CONFIG: AmdConfig = this.AMD_PRESETS.balanced;

  /**
   * Get AMD configuration for a campaign
   * Merges preset with any custom settings
   */
  getAmdConfig(campaign: Campaign): AmdConfig {
    if (!campaign.amdEnabled) {
      return this.DEFAULT_CONFIG;
    }

    const preset = this.AMD_PRESETS[campaign.amdMode] || this.DEFAULT_CONFIG;

    // Merge custom settings over preset
    if (campaign.amdSettings) {
      return {
        initialSilence: campaign.amdSettings.initialSilence ?? preset.initialSilence,
        greeting: campaign.amdSettings.greeting ?? preset.greeting,
        afterGreetingSilence: campaign.amdSettings.afterGreetingSilence ?? preset.afterGreetingSilence,
        totalAnalysisTime: campaign.amdSettings.totalAnalysisTime ?? preset.totalAnalysisTime,
        minWordLength: campaign.amdSettings.minWordLength ?? preset.minWordLength,
        betweenWordsSilence: campaign.amdSettings.betweenWordsSilence ?? preset.betweenWordsSilence,
        maximumWordLength: campaign.amdSettings.maximumWordLength ?? preset.maximumWordLength,
        silenceThreshold: campaign.amdSettings.silenceThreshold ?? preset.silenceThreshold,
      };
    }

    return preset;
  }

  /**
   * Format AMD config for Asterisk AMD() application
   * Returns parameters in the order expected by AMD()
   */
  formatForAsterisk(config: AmdConfig): string {
    // AMD(initialSilence,greeting,afterGreetingSilence,totalAnalysisTime,
    //     minWordLength,betweenWordsSilence,maximumWordLength,silenceThreshold)
    return [
      config.initialSilence,
      config.greeting,
      config.afterGreetingSilence,
      config.totalAnalysisTime,
      config.minWordLength,
      config.betweenWordsSilence,
      config.maximumWordLength,
      config.silenceThreshold,
    ].join(',');
  }

  /**
   * Determine the recommended action based on AMD result
   */
  getRecommendedAction(
    result: AmdResult,
    campaign: Campaign,
  ): 'connect_agent' | 'voicemail_drop' | 'hangup' {
    switch (result) {
      case 'HUMAN':
        return 'connect_agent';

      case 'MACHINE':
        if (campaign.voicemailDropEnabled && campaign.voicemailDropRecordingId) {
          return 'voicemail_drop';
        }
        return 'hangup';

      case 'NOTSURE':
        // When unsure, treat as human to avoid missing real contacts
        return 'connect_agent';

      case 'HANGUP':
        // Callee hung up during detection
        return 'hangup';

      default:
        return 'connect_agent';
    }
  }

  /**
   * Process AMD result callback from Asterisk
   *
   * This method handles the callback from Asterisk after AMD analysis
   * and returns the recommended action.
   */
  async processAmdResult(payload: AmdResultPayload): Promise<{
    action: 'connect_agent' | 'voicemail_drop' | 'hangup';
    recordingId?: string;
  }> {
    this.logger.log(
      `AMD Result for call ${payload.callId}: ${payload.result} (${payload.cause}) in ${payload.analysisTime}ms`,
    );

    // Note: In a real implementation, you would fetch the campaign
    // and determine the action. For now, return a default.
    return {
      action: payload.result === 'HUMAN' ? 'connect_agent' : 'hangup',
    };
  }

  /**
   * Get AMD statistics summary for a campaign
   */
  getAmdModeDescription(mode: AmdMode): {
    name: string;
    description: string;
    accuracy: string;
    speed: string;
  } {
    const descriptions: Record<AmdMode, { name: string; description: string; accuracy: string; speed: string }> = {
      fast: {
        name: 'Fast',
        description: 'Quick detection with ~75% accuracy. Best for high-volume campaigns.',
        accuracy: '~75%',
        speed: '< 3 seconds',
      },
      balanced: {
        name: 'Balanced',
        description: 'Good balance of speed and accuracy. Recommended for most campaigns.',
        accuracy: '~85%',
        speed: '3-5 seconds',
      },
      accurate: {
        name: 'Accurate',
        description: 'High accuracy with longer detection time. Best for high-value leads.',
        accuracy: '~95%',
        speed: '5-8 seconds',
      },
    };

    return descriptions[mode] || descriptions.balanced;
  }

  /**
   * Validate AMD settings are within acceptable ranges
   */
  validateSettings(settings: Partial<AmdSettings>): string[] {
    const errors: string[] = [];

    if (settings.initialSilence !== undefined) {
      if (settings.initialSilence < 500 || settings.initialSilence > 10000) {
        errors.push('initialSilence must be between 500-10000ms');
      }
    }

    if (settings.greeting !== undefined) {
      if (settings.greeting < 500 || settings.greeting > 5000) {
        errors.push('greeting must be between 500-5000ms');
      }
    }

    if (settings.afterGreetingSilence !== undefined) {
      if (settings.afterGreetingSilence < 200 || settings.afterGreetingSilence > 3000) {
        errors.push('afterGreetingSilence must be between 200-3000ms');
      }
    }

    if (settings.totalAnalysisTime !== undefined) {
      if (settings.totalAnalysisTime < 2000 || settings.totalAnalysisTime > 15000) {
        errors.push('totalAnalysisTime must be between 2000-15000ms');
      }
    }

    if (settings.silenceThreshold !== undefined) {
      if (settings.silenceThreshold < 64 || settings.silenceThreshold > 1024) {
        errors.push('silenceThreshold must be between 64-1024');
      }
    }

    return errors;
  }
}
