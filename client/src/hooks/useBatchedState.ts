import { useRef, useState, useCallback, useEffect } from 'react';

interface BatchConfig {
  intervalMs?: number;
  maxBatchSize?: number;
}

export function useBatchedState<T>(
  initialState: T,
  config: BatchConfig = {}
): [T, (updater: Partial<T> | ((prev: T) => T)) => void] {
  const { intervalMs = 500, maxBatchSize = 10 } = config;
  
  const [state, setState] = useState<T>(initialState);
  const pendingUpdatesRef = useRef<Array<Partial<T> | ((prev: T) => T)>>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const flushUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return;
    
    const updates = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current = [];
    
    setState(prev => {
      let result = prev;
      for (const update of updates) {
        if (typeof update === 'function') {
          result = update(result);
        } else {
          result = { ...result, ...update };
        }
      }
      return result;
    });
  }, []);

  const batchedSetState = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
    pendingUpdatesRef.current.push(updater);
    
    if (pendingUpdatesRef.current.length >= maxBatchSize) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flushUpdates();
      return;
    }
    
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushUpdates();
      }, intervalMs);
    }
  }, [intervalMs, maxBatchSize, flushUpdates]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return [state, batchedSetState];
}

export function useThrottle<T>(value: T, intervalMs: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdateRef = useRef<number>(0);
  const pendingValueRef = useRef<T>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    pendingValueRef.current = value;
    const now = Date.now();
    
    if (now - lastUpdateRef.current >= intervalMs) {
      lastUpdateRef.current = now;
      setThrottledValue(value);
    } else if (!timerRef.current) {
      const remaining = intervalMs - (now - lastUpdateRef.current);
      timerRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        setThrottledValue(pendingValueRef.current);
        timerRef.current = null;
      }, remaining);
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, intervalMs]);

  return throttledValue;
}

export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
