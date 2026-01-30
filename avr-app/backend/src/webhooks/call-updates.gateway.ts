import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';

export interface CallUpdateEvent {
  type: 'call_created' | 'call_updated' | 'call_ended';
  call: {
    id: string;
    uuid: string;
    agentId?: string | null;
    agentName?: string | null;
    callType?: string | null;
    fromNumber?: string | null;
    toNumber?: string | null;
    providerId?: string | null;
    providerName?: string | null;
    endReason?: string | null;
    cost?: number | null;
    startedAt?: string | null;
    endedAt?: string | null;
    createdAt?: string | null;
    hasRecording?: boolean;
  };
}

interface SSEClient {
  id: string;
  response: Response;
}

@Injectable()
export class CallUpdatesGateway {
  private readonly logger = new Logger(CallUpdatesGateway.name);
  private clients: SSEClient[] = [];
  private clientIdCounter = 0;

  /**
   * Register a new SSE client
   */
  addClient(response: Response): string {
    const clientId = `sse-${++this.clientIdCounter}`;
    this.clients.push({ id: clientId, response });
    this.logger.log(`SSE client connected: ${clientId} (total: ${this.clients.length})`);
    return clientId;
  }

  /**
   * Remove an SSE client
   */
  removeClient(clientId: string): void {
    const index = this.clients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      this.clients.splice(index, 1);
      this.logger.log(`SSE client disconnected: ${clientId} (total: ${this.clients.length})`);
    }
  }

  /**
   * Broadcast a call update to all connected SSE clients
   */
  private broadcastCallUpdate(event: CallUpdateEvent): void {
    if (this.clients.length === 0) {
      return; // No clients connected, skip
    }
    this.logger.debug(`Broadcasting ${event.type} for call ${event.call.uuid} to ${this.clients.length} SSE clients`);

    const data = JSON.stringify(event);
    const message = `data: ${data}\n\n`;

    // Send to all clients, remove any that have disconnected
    this.clients = this.clients.filter(client => {
      try {
        client.response.write(message);
        return true;
      } catch (error) {
        this.logger.warn(`Failed to send to client ${client.id}, removing`);
        return false;
      }
    });
  }

  /**
   * Broadcast that a new call was created
   */
  notifyCallCreated(call: CallUpdateEvent['call']): void {
    this.broadcastCallUpdate({
      type: 'call_created',
      call,
    });
  }

  /**
   * Broadcast that a call was updated (e.g., started, metadata changed)
   */
  notifyCallUpdated(call: CallUpdateEvent['call']): void {
    this.broadcastCallUpdate({
      type: 'call_updated',
      call,
    });
  }

  /**
   * Broadcast that a call has ended
   */
  notifyCallEnded(call: CallUpdateEvent['call']): void {
    this.broadcastCallUpdate({
      type: 'call_ended',
      call,
    });
  }

  /**
   * Get the number of connected clients
   */
  getConnectedClientCount(): number {
    return this.clients.length;
  }
}
