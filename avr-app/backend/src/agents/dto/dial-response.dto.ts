export type DialCallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed';

export class DialResponseDto {
  id: string;
  uuid: string;
  status: DialCallStatus;
  agentId: string;
  toNumber: string;
  fromNumber: string;
  trunkId: string;
  trunkName: string;
  callType: 'outbound';
  createdAt: string;
  metadata?: Record<string, unknown>;
}
