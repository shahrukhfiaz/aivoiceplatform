'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getApiUrl, getStoredToken } from '@/lib/api';

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
  twilioCallSid?: string | null;
}

export interface AgentUpdatePayload {
  id: string;
  name: string;
  status: string;
  mode?: string;
}

// Generic data change types
export type DataEntityType = 'provider' | 'trunk' | 'number' | 'twilio_number' | 'recording' | 'phone';
export type DataChangeAction = 'created' | 'updated' | 'deleted';

export interface DataChangePayload {
  entity: DataEntityType;
  action: DataChangeAction;
  id: string;
}

export type LiveUpdateEventType =
  | 'connected'
  | 'call_created'
  | 'call_updated'
  | 'call_ended'
  | 'agent_started'
  | 'agent_stopped'
  | 'agent_updated'
  | 'agent_created'
  | 'agent_deleted'
  | 'data_changed';

export interface LiveUpdateEvent {
  type: LiveUpdateEventType;
  call?: CallUpdatePayload;
  agent?: AgentUpdatePayload;
  entity?: DataEntityType;
  action?: DataChangeAction;
  id?: string;
  clientId?: string;
}

// Keep CallUpdateEvent for backward compatibility
export interface CallUpdateEvent {
  type: 'connected' | 'call_created' | 'call_updated' | 'call_ended';
  call?: CallUpdatePayload;
  clientId?: string;
}

interface UseLiveUpdatesOptions {
  // Call events
  onCallCreated?: (call: CallUpdatePayload) => void;
  onCallUpdated?: (call: CallUpdatePayload) => void;
  onCallEnded?: (call: CallUpdatePayload) => void;
  // Agent events
  onAgentStarted?: (agent: AgentUpdatePayload) => void;
  onAgentStopped?: (agent: AgentUpdatePayload) => void;
  onAgentUpdated?: (agent: AgentUpdatePayload) => void;
  onAgentCreated?: (agent: AgentUpdatePayload) => void;
  onAgentDeleted?: (agent: AgentUpdatePayload) => void;
  // Data change events (for configuration entities)
  onDataChanged?: (payload: DataChangePayload) => void;
  // Connection events
  onConnected?: (clientId: string) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

// Keep the old interface name for backward compatibility
interface UseCallUpdatesOptions extends UseLiveUpdatesOptions {}

/**
 * Hook to subscribe to real-time call updates via Server-Sent Events
 */
export function useCallUpdates(options: UseCallUpdatesOptions = {}) {
  const {
    onCallCreated,
    onCallUpdated,
    onCallEnded,
    onAgentStarted,
    onAgentStopped,
    onAgentUpdated,
    onAgentCreated,
    onAgentDeleted,
    onDataChanged,
    onConnected,
    onError,
    enabled = true,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const baseUrl = getApiUrl();
      const token = getStoredToken();

      // Build SSE URL with auth token as query param (since EventSource doesn't support headers)
      // Ensure we append to the API path, not replace it
      let sseUrlString = baseUrl.endsWith('/') ? `${baseUrl}webhooks/stream` : `${baseUrl}/webhooks/stream`;
      if (token) {
        sseUrlString += `?token=${encodeURIComponent(token)}`;
      }

      const eventSource = new EventSource(sseUrlString);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: LiveUpdateEvent = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              onConnected?.(data.clientId || '');
              break;
            // Call events
            case 'call_created':
              if (data.call) onCallCreated?.(data.call);
              break;
            case 'call_updated':
              if (data.call) onCallUpdated?.(data.call);
              break;
            case 'call_ended':
              if (data.call) onCallEnded?.(data.call);
              break;
            // Agent events
            case 'agent_started':
              if (data.agent) onAgentStarted?.(data.agent);
              break;
            case 'agent_stopped':
              if (data.agent) onAgentStopped?.(data.agent);
              break;
            case 'agent_updated':
              if (data.agent) onAgentUpdated?.(data.agent);
              break;
            case 'agent_created':
              if (data.agent) onAgentCreated?.(data.agent);
              break;
            case 'agent_deleted':
              if (data.agent) onAgentDeleted?.(data.agent);
              break;
            // Data change events
            case 'data_changed':
              if (data.entity && data.action && data.id) {
                onDataChanged?.({ entity: data.entity, action: data.action, id: data.id });
              }
              break;
          }
        } catch (parseError) {
          console.error('Failed to parse SSE message:', parseError);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          onError?.(new Error('Failed to connect to call updates stream after multiple attempts'));
        }
      };
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to connect to SSE'));
    }
  }, [enabled, onCallCreated, onCallUpdated, onCallEnded, onAgentStarted, onAgentStopped, onAgentUpdated, onAgentCreated, onAgentDeleted, onDataChanged, onConnected, onError]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect, enabled]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return { reconnect };
}
