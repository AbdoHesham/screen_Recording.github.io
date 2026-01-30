import { useEffect, useRef } from 'react';

/**
 * Hook to automatically refresh data at intervals
 * @param callback Function to call on each refresh
 * @param interval Refresh interval in milliseconds (default: 30 seconds)
 * @param enabled Whether auto-refresh is enabled (default: true)
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  interval: number = 30000, // 30 seconds
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);

  // Remember latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up interval
  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      await savedCallback.current();
    };

    const id = setInterval(tick, interval);

    return () => clearInterval(id);
  }, [interval, enabled]);
}

/**
 * Hook to track when user returns to tab (visibility change)
 */
export function useVisibilityRefresh(callback: () => void | Promise<void>) {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await callback();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callback]);
}
