/**
 * TCPA State-Specific Calling Rules
 *
 * These rules define the legal calling hours for each US state.
 * Most states follow the federal TCPA rule (8am-9pm local time),
 * but some states have stricter requirements.
 *
 * Format:
 * - weekday: [startTime, endTime] in 24h format
 * - saturday: [startTime, endTime] or null if no calls allowed
 * - sunday: [startTime, endTime] or null if no calls allowed
 *
 * Times are in local time for each state.
 */

export interface StateCallingRule {
  weekday: [string, string]; // [start, end] in HH:mm format
  saturday: [string, string] | null;
  sunday: [string, string] | null;
}

// State abbreviation to timezone mapping (primary timezone for each state)
export const STATE_TIMEZONES: Record<string, string> = {
  // Eastern Time
  CT: 'America/New_York',
  DC: 'America/New_York',
  DE: 'America/New_York',
  FL: 'America/New_York', // Most of FL is Eastern
  GA: 'America/New_York',
  IN: 'America/Indiana/Indianapolis',
  KY: 'America/New_York', // Most of KY is Eastern
  MA: 'America/New_York',
  MD: 'America/New_York',
  ME: 'America/New_York',
  MI: 'America/Detroit', // Most of MI is Eastern
  NC: 'America/New_York',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NY: 'America/New_York',
  OH: 'America/New_York',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  VA: 'America/New_York',
  VT: 'America/New_York',
  WV: 'America/New_York',

  // Central Time
  AL: 'America/Chicago',
  AR: 'America/Chicago',
  IA: 'America/Chicago',
  IL: 'America/Chicago',
  KS: 'America/Chicago', // Most of KS is Central
  LA: 'America/Chicago',
  MN: 'America/Chicago',
  MO: 'America/Chicago',
  MS: 'America/Chicago',
  ND: 'America/Chicago', // Most of ND is Central
  NE: 'America/Chicago', // Most of NE is Central
  OK: 'America/Chicago',
  SD: 'America/Chicago', // Most of SD is Central
  TN: 'America/Chicago', // Most of TN is Central
  TX: 'America/Chicago', // Most of TX is Central
  WI: 'America/Chicago',

  // Mountain Time
  AZ: 'America/Phoenix', // No DST
  CO: 'America/Denver',
  ID: 'America/Boise', // Most of ID is Mountain
  MT: 'America/Denver',
  NM: 'America/Denver',
  UT: 'America/Denver',
  WY: 'America/Denver',

  // Pacific Time
  CA: 'America/Los_Angeles',
  NV: 'America/Los_Angeles', // Most of NV is Pacific
  OR: 'America/Los_Angeles', // Most of OR is Pacific
  WA: 'America/Los_Angeles',

  // Alaska Time
  AK: 'America/Anchorage',

  // Hawaii Time
  HI: 'Pacific/Honolulu',
};

/**
 * State-specific calling rules
 *
 * Sources:
 * - Federal TCPA: 8am-9pm local time, 7 days/week
 * - State variations documented below
 */
export const STATE_CALLING_RULES: Record<string, StateCallingRule> = {
  // Default rule (federal TCPA minimum)
  default: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['08:00', '21:00'],
  },

  // California - stricter rules
  CA: {
    weekday: ['08:00', '21:00'],
    saturday: ['09:00', '17:00'],
    sunday: null, // No calls on Sunday
  },

  // Florida - stricter Sunday rules
  FL: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['12:00', '21:00'], // No calls before noon on Sunday
  },

  // Connecticut - stricter rules
  CT: {
    weekday: ['09:00', '21:00'], // 9am start
    saturday: ['09:00', '21:00'],
    sunday: ['10:00', '19:00'], // Limited Sunday hours
  },

  // Massachusetts - stricter rules
  MA: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['12:00', '21:00'],
  },

  // Indiana - stricter rules
  IN: {
    weekday: ['08:00', '20:00'], // 8pm end instead of 9pm
    saturday: ['08:00', '18:00'],
    sunday: ['10:00', '18:00'],
  },

  // Wisconsin - stricter rules
  WI: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '18:00'],
    sunday: null, // No calls on Sunday
  },

  // New York - follow federal
  NY: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Texas - follow federal
  TX: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['08:00', '21:00'],
  },

  // Pennsylvania - stricter rules
  PA: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '18:00'],
    sunday: ['12:00', '18:00'],
  },

  // Michigan - stricter rules
  MI: {
    weekday: ['09:00', '21:00'],
    saturday: ['09:00', '21:00'],
    sunday: ['09:00', '17:00'],
  },

  // Louisiana - stricter rules
  LA: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '18:00'],
    sunday: ['12:00', '18:00'],
  },

  // Arizona - follow federal but no DST
  AZ: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Georgia - follow federal
  GA: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // North Carolina - follow federal
  NC: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // New Jersey - stricter rules
  NJ: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['11:00', '21:00'],
  },

  // Ohio - follow federal
  OH: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Virginia - follow federal
  VA: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Washington - follow federal
  WA: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Colorado - follow federal
  CO: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Oregon - follow federal
  OR: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Nevada - follow federal
  NV: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Utah - follow federal
  UT: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['12:00', '21:00'], // Later start on Sunday
  },

  // Minnesota - follow federal
  MN: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['10:00', '21:00'],
  },

  // Missouri - follow federal
  MO: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Tennessee - follow federal
  TN: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['12:00', '21:00'],
  },

  // Maryland - follow federal
  MD: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },

  // Illinois - follow federal
  IL: {
    weekday: ['08:00', '21:00'],
    saturday: ['08:00', '21:00'],
    sunday: ['09:00', '21:00'],
  },
};

/**
 * Get the calling rules for a specific state
 * Falls back to default federal rules if state not found
 */
export function getStateCallingRules(stateAbbr: string): StateCallingRule {
  const upperState = stateAbbr.toUpperCase();
  return STATE_CALLING_RULES[upperState] || STATE_CALLING_RULES.default;
}

/**
 * Get the primary timezone for a state
 * Falls back to America/New_York if state not found
 */
export function getStateTimezone(stateAbbr: string): string {
  const upperState = stateAbbr.toUpperCase();
  return STATE_TIMEZONES[upperState] || 'America/New_York';
}

/**
 * Infer timezone from state abbreviation
 */
export function inferTimezoneFromState(state?: string | null): string {
  if (!state) return 'America/New_York'; // Default to Eastern
  return getStateTimezone(state);
}

/**
 * Check if a given time is within calling hours for a state
 *
 * @param state State abbreviation (e.g., 'CA', 'NY')
 * @param currentTime Current time as Date object (in any timezone)
 * @returns boolean indicating if calls are allowed
 */
export function isWithinStateCallingHours(
  state: string,
  currentTime: Date,
): boolean {
  const rules = getStateCallingRules(state);
  const timezone = getStateTimezone(state);

  // Convert current time to state's local time
  const localTimeStr = currentTime.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });

  const dayOfWeek = new Date(
    currentTime.toLocaleString('en-US', { timeZone: timezone }),
  ).getDay();

  let allowedHours: [string, string] | null;

  if (dayOfWeek === 0) {
    // Sunday
    allowedHours = rules.sunday;
  } else if (dayOfWeek === 6) {
    // Saturday
    allowedHours = rules.saturday;
  } else {
    // Weekday
    allowedHours = rules.weekday;
  }

  // If no hours defined, calls not allowed
  if (!allowedHours) {
    return false;
  }

  // Compare times as strings (HH:mm format)
  const [startTime, endTime] = allowedHours;
  return localTimeStr >= startTime && localTimeStr < endTime;
}
