import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface FeatureWeights {
  dialAttempts: number; // Penalty for many attempts (negative)
  recencyDays: number; // Boost for recent contacts (positive)
  previousOutcomes: number; // Weight for disposition history
  timeOfDay: number; // Optimal calling time boost
  dayOfWeek: number; // Weekday patterns
  areaCodeMatch: number; // Local presence boost
  timezone: number; // Timezone optimization
  callDuration: number; // Previous call duration weight
  totalContacts: number; // Total contact history
  positiveOutcomeRatio: number; // Ratio of positive outcomes
}

export interface DispositionScores {
  [dispositionCode: string]: number; // -100 to 100
}

export interface TimeSlotMultipliers {
  [hour: string]: number; // 0-23 hour -> multiplier
}

export interface DayOfWeekMultipliers {
  [day: string]: number; // 0-6 day -> multiplier
}

@Entity('scoring_models')
@Index(['isActive', 'isDefault'])
@Index(['organizationId'])
export class ScoringModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '1.0.0' })
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  organizationId?: string;

  // ==================== Feature Weights ====================

  @Column({ type: 'simple-json' })
  featureWeights: FeatureWeights;

  // ==================== Disposition Impact ====================

  @Column({ type: 'simple-json' })
  dispositionScores: DispositionScores;

  // ==================== Time Multipliers ====================

  @Column({ type: 'simple-json' })
  timeSlotMultipliers: TimeSlotMultipliers;

  @Column({ type: 'simple-json' })
  dayOfWeekMultipliers: DayOfWeekMultipliers;

  // ==================== Scoring Thresholds ====================

  @Column({ type: 'integer', default: 70 })
  highPriorityThreshold: number; // Score >= this = high priority

  @Column({ type: 'integer', default: 30 })
  lowPriorityThreshold: number; // Score <= this = low priority

  @Column({ type: 'integer', default: 5 })
  maxDialAttempts: number; // Stop scoring after this many attempts

  // ==================== Performance Metrics ====================

  @Column({ type: 'real', nullable: true })
  accuracy?: number; // Actual vs predicted correlation

  @Column({ type: 'real', nullable: true })
  precision?: number;

  @Column({ type: 'real', nullable: true })
  recall?: number;

  @Column({ type: 'integer', default: 0 })
  leadsScored: number;

  // ==================== Status ====================

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'datetime', nullable: true })
  trainedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Default model configuration
export const DEFAULT_FEATURE_WEIGHTS: FeatureWeights = {
  dialAttempts: -5, // Penalize many attempts
  recencyDays: 2, // Boost recent contacts
  previousOutcomes: 15, // Weight disposition history
  timeOfDay: 10, // Optimal calling time
  dayOfWeek: 5, // Weekday patterns
  areaCodeMatch: 5, // Local presence
  timezone: 10, // Timezone optimization
  callDuration: 3, // Previous call duration
  totalContacts: -2, // Many contacts = slightly negative
  positiveOutcomeRatio: 20, // Historical positive outcomes
};

export const DEFAULT_DISPOSITION_SCORES: DispositionScores = {
  // Positive outcomes
  SALE: 100,
  APPOINTMENT: 80,
  INTERESTED: 60,
  CALLBACK: 40,

  // Neutral
  NOT_HOME: 0,
  NO_ANSWER: -5,
  BUSY: -5,
  VOICEMAIL: -10,

  // Negative outcomes
  NOT_INTERESTED: -30,
  DO_NOT_CALL: -100,
  WRONG_NUMBER: -100,
  DISCONNECTED: -100,
  DECEASED: -100,
};

export const DEFAULT_TIME_SLOT_MULTIPLIERS: TimeSlotMultipliers = {
  '0': 0.1, '1': 0.1, '2': 0.1, '3': 0.1, '4': 0.1, '5': 0.2,
  '6': 0.3, '7': 0.5, '8': 0.7, '9': 1.0, '10': 1.2, '11': 1.2,
  '12': 0.8, '13': 1.0, '14': 1.1, '15': 1.1, '16': 1.2, '17': 1.3,
  '18': 1.2, '19': 1.0, '20': 0.8, '21': 0.5, '22': 0.2, '23': 0.1,
};

export const DEFAULT_DAY_OF_WEEK_MULTIPLIERS: DayOfWeekMultipliers = {
  '0': 0.3, // Sunday
  '1': 1.0, // Monday
  '2': 1.1, // Tuesday
  '3': 1.2, // Wednesday
  '4': 1.1, // Thursday
  '5': 0.9, // Friday
  '6': 0.4, // Saturday
};
