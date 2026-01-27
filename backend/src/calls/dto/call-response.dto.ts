export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'forwarding'
  | 'ended';

export type CallEndedReason =
  | 'completed'
  | 'busy'
  | 'no-answer'
  | 'canceled'
  | 'failed'
  | 'rejected';

export type CallType = 'inbound' | 'outbound';

export class CallCustomerDto {
  number: string;
  name?: string;
}

export class CallPhoneNumberDto {
  number?: string;
  trunkId?: string;
  trunkName?: string;
}

export class CallResponseDto {
  /**
   * Unique identifier for the call
   */
  id: string;

  /**
   * Organization ID (for multi-tenant support)
   */
  orgId?: string;

  /**
   * Type of call
   */
  type: CallType;

  /**
   * Current status of the call
   */
  status: CallStatus;

  /**
   * Reason the call ended (if ended)
   */
  endedReason?: CallEndedReason;

  /**
   * The agent handling this call
   */
  agentId: string;

  /**
   * Customer information
   */
  customer: CallCustomerDto;

  /**
   * Phone number used for caller ID
   */
  phoneNumber?: CallPhoneNumberDto;

  /**
   * Custom metadata attached to the call
   */
  metadata?: Record<string, unknown>;

  /**
   * Name of the call (if provided)
   */
  name?: string;

  /**
   * Timestamp when the call was created
   */
  createdAt: string;

  /**
   * Timestamp when the call started (connected)
   */
  startedAt?: string;

  /**
   * Timestamp when the call ended
   */
  endedAt?: string;

  /**
   * Duration of the call in seconds
   */
  duration?: number;

  /**
   * Cost of the call in USD
   */
  cost?: number;
}

export class CallListResponseDto {
  data: CallResponseDto[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
