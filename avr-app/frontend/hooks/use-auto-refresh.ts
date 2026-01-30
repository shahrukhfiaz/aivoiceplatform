'use client';

import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
  refreshFn: () => void;
  intervalMs?: number;         // Default: 30000 (30s)
  refreshOnFocus?: boolean;    // Default: true
  refreshOnVisibility?: boolean; // Default: true
  enabled?: boolean;           // Default: true
}

/**
 * Hook for automatic data refresh with multiple triggers:
 * - Interval-based polling
 * - Window focus events
 * - Tab visibility changes
 */
export function useAutoRefresh(options: UseAutoRefreshOptions) {
  const {
    refreshFn,
    intervalMs = 30000,
    refreshOnFocus = true,
    refreshOnVisibility = true,
    enabled = true,
  } = options;

  // Use ref to avoid stale closure issues with refreshFn
  const refreshFnRef = useRef(refreshFn);
  refreshFnRef.current = refreshFn;

  // Track last refresh time to debounce rapid triggers
  const lastRefreshRef = useRef<number>(0);
  const debounceMs = 1000; // Minimum 1 second between refreshes

  const debouncedRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshRef.current >= debounceMs) {
      lastRefreshRef.current = now;
      refreshFnRef.current();
    }
  };

  // Interval-based refresh
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      refreshFnRef.current();
      lastRefreshRef.current = Date.now();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, enabled]);

  // Refresh on window focus
  useEffect(() => {
    if (!enabled || !refreshOnFocus) return;

    const handleFocus = () => {
      debouncedRefresh();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshOnFocus, enabled]);

  // Refresh on visibility change (tab becomes visible)
  useEffect(() => {
    if (!enabled || !refreshOnVisibility) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        debouncedRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshOnVisibility, enabled]);
}
