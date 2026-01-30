/**
 * Twilio IP Ranges for Elastic SIP Trunking
 *
 * These IP ranges are used to identify incoming SIP traffic from Twilio.
 * Reference: https://www.twilio.com/docs/sip-trunking/ip-addresses
 *
 * Last updated: January 2026
 */

// Twilio Signaling IPs (SIP) - North America
// Official Elastic SIP Trunking IPs from https://www.twilio.com/docs/sip-trunking/ip-addresses
export const TWILIO_SIGNALING_IPS_NA = [
  // Virginia (us1)
  '54.172.60.0/30',
  // Oregon (us2)
  '54.244.51.0/30',
];

// Twilio Signaling IPs (SIP) - Europe
export const TWILIO_SIGNALING_IPS_EU = [
  // Ireland (ie1)
  '54.171.127.192/30',
  // Frankfurt (de1)
  '35.156.191.128/30',
];

// Twilio Signaling IPs (SIP) - Asia Pacific
export const TWILIO_SIGNALING_IPS_APAC = [
  // Sydney (au1)
  '54.252.254.64/30',
  // Tokyo (jp1)
  '54.65.63.192/30',
  // Singapore (sg1)
  '54.169.127.128/30',
];

// Twilio Signaling IPs (SIP) - South America
export const TWILIO_SIGNALING_IPS_SA = [
  // São Paulo (br1)
  '177.71.206.192/30',
];

// All Twilio Signaling IPs combined
export const TWILIO_SIGNALING_IPS = [
  ...TWILIO_SIGNALING_IPS_NA,
  ...TWILIO_SIGNALING_IPS_EU,
  ...TWILIO_SIGNALING_IPS_APAC,
  ...TWILIO_SIGNALING_IPS_SA,
];

// Twilio Media IPs (RTP) - for firewall rules
// Note: These are the IP ranges Twilio uses for RTP media
export const TWILIO_MEDIA_IPS_NA = [
  '54.172.60.0/23',
  '34.203.250.0/23',
  '168.86.128.0/18',
];

export const TWILIO_MEDIA_IPS_EU = [
  '54.171.127.192/26',
  '52.215.127.0/24',
  '35.156.191.128/25',
];

export const TWILIO_MEDIA_IPS_APAC = [
  '54.252.254.64/26',
  '54.65.63.192/26',
  '54.169.127.128/26',
];

export const TWILIO_MEDIA_IPS_SA = [
  '177.71.206.192/26',
];

export const TWILIO_MEDIA_IPS = [
  ...TWILIO_MEDIA_IPS_NA,
  ...TWILIO_MEDIA_IPS_EU,
  ...TWILIO_MEDIA_IPS_APAC,
  ...TWILIO_MEDIA_IPS_SA,
];

// Twilio Edge Locations for Elastic SIP Trunking
export const TWILIO_SIP_DOMAINS = {
  // US regions
  'us1': 'sip.us1.twilio.com',
  'us2': 'sip.us2.twilio.com',
  // Europe
  'ie1': 'sip.ie1.twilio.com',
  'de1': 'sip.de1.twilio.com',
  // Asia Pacific
  'au1': 'sip.au1.twilio.com',
  'jp1': 'sip.jp1.twilio.com',
  'sg1': 'sip.sg1.twilio.com',
  // South America
  'br1': 'sip.br1.twilio.com',
};

// Default Twilio SIP domain (US)
export const DEFAULT_TWILIO_SIP_DOMAIN = 'sip.us1.twilio.com';

/**
 * Get all Twilio IPs as a comma-separated string
 * Useful for allowedIps field in trunk entity
 */
export function getTwilioIpsAsString(): string {
  return TWILIO_SIGNALING_IPS.join(',');
}

/**
 * Check if an IP is from Twilio
 */
export function isTwilioIp(ip: string): boolean {
  // Simple check - for production, use proper CIDR matching
  return TWILIO_SIGNALING_IPS.some(cidr => {
    const [network] = cidr.split('/');
    return ip.startsWith(network.split('.').slice(0, 2).join('.'));
  });
}
