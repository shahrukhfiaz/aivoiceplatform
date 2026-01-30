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
}

export interface CallUpdateEvent {
  type: 'connected' | 'call_created' | 'call_updated' | 'call_ended';
  call?: CallUpdatePayload;
  clientId?: string;
}

interface UseCallUpdatesOptions {
  onCallCreated?: (call: CallUpdatePayload) => void;
  onCallUpdated?: (call: CallUpdatePayload) => void;
  onCallEnded?: (call: CallUpdatePayload) => void;
  onConnected?: (clientId: string) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time call updates via Server-Sent Events
 */
export function useCallUpdates(options: UseCallUpdatesOptions = {}) {
  const {
    onCallCreated,
    onCallUpdated,
    onCallEnded,
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
          const data: CallUpdateEvent = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              onConnected?.(data.clientId || '');
              break;
            case 'call_created':
              if (data.call) onCallCreated?.(data.call);
              break;
            case 'call_updated':
              if (data.call) onCallUpdated?.(data.call);
              break;
            case 'call_ended':
              if (data.call) onCallEnded?.(data.call);
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
  }, [enabled, onCallCreated, onCallUpdated, onCallEnded, onConnected, onError]);

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
