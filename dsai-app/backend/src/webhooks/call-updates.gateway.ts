import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';

export interface CallUpdatePayload {
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
}

export interface AgentUpdatePayload {
  id: string;
  name: string;
  status: string;
  mode?: string;
}

export interface CallUpdateEvent {
  type: 'call_created' | 'call_updated' | 'call_ended';
  call: CallUpdatePayload;
}

export interface AgentUpdateEvent {
  type: 'agent_started' | 'agent_stopped' | 'agent_updated' | 'agent_created' | 'agent_deleted';
  agent: AgentUpdatePayload;
}

// Generic data change event for configuration entities
export type DataEntityType = 'provider' | 'trunk' | 'number' | 'twilio_number' | 'recording' | 'phone' | 'campaign' | 'lead' | 'disposition' | 'dialer' | 'dnc';
export type DataChangeAction = 'created' | 'updated' | 'deleted' | 'started' | 'paused' | 'stopped' | 'call_result';

export interface DataChangeEvent {
  type: 'data_changed';
  entity: DataEntityType;
  action: DataChangeAction;
  id: string;
}

export type LiveUpdateEvent = CallUpdateEvent | AgentUpdateEvent | DataChangeEvent;

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
   * Broadcast any event to all connected SSE clients
   */
  private broadcast(event: LiveUpdateEvent): void {
    if (this.clients.length === 0) {
      return; // No clients connected, skip
    }
    this.logger.debug(`Broadcasting ${event.type} to ${this.clients.length} SSE clients`);

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

  // ============ Call Events ============

  /**
   * Broadcast that a new call was created
   */
  notifyCallCreated(call: CallUpdatePayload): void {
    this.broadcast({ type: 'call_created', call });
  }

  /**
   * Broadcast that a call was updated (e.g., started, metadata changed)
   */
  notifyCallUpdated(call: CallUpdatePayload): void {
    this.broadcast({ type: 'call_updated', call });
  }

  /**
   * Broadcast that a call has ended
   */
  notifyCallEnded(call: CallUpdatePayload): void {
    this.broadcast({ type: 'call_ended', call });
  }

  // ============ Agent Events ============

  /**
   * Broadcast that an agent was started
   */
  notifyAgentStarted(agent: AgentUpdatePayload): void {
    this.broadcast({ type: 'agent_started', agent });
  }

  /**
   * Broadcast that an agent was stopped
   */
  notifyAgentStopped(agent: AgentUpdatePayload): void {
    this.broadcast({ type: 'agent_stopped', agent });
  }

  /**
   * Broadcast that an agent was updated
   */
  notifyAgentUpdated(agent: AgentUpdatePayload): void {
    this.broadcast({ type: 'agent_updated', agent });
  }

  /**
   * Broadcast that an agent was created
   */
  notifyAgentCreated(agent: AgentUpdatePayload): void {
    this.broadcast({ type: 'agent_created', agent });
  }

  /**
   * Broadcast that an agent was deleted
   */
  notifyAgentDeleted(agent: AgentUpdatePayload): void {
    this.broadcast({ type: 'agent_deleted', agent });
  }

  // ============ Generic Data Change Events ============

  /**
   * Broadcast that a data entity was changed (created, updated, or deleted)
   */
  notifyDataChanged(entity: DataEntityType, action: DataChangeAction, id: string): void {
    this.broadcast({ type: 'data_changed', entity, action, id });
  }

  /**
   * Get the number of connected clients
   */
  getConnectedClientCount(): number {
    return this.clients.length;
  }
}
