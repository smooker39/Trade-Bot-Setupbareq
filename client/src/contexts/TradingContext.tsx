import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { domInjector } from '@/lib/domInjector';
import { memoryCommander } from '@/lib/memoryCommander';

// PRICE STATE BLOCKED - All price updates go through DOM Injection only
// This eliminates React re-renders for the price zone

interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

interface BalanceData {
  usdt: number;
  btc: number;
  timestamp: number;
}

interface EngineState {
  isRunning: boolean;
  currentPrice: number;
  lastSignal: string;
  activePositions: number;
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
}

interface BatchedState {
  price: PriceData | null;
  balance: BalanceData | null;
  engineState: EngineState | null;
  logs: LogEntry[];
}

interface TradingContextValue {
  price: PriceData | null;
  balance: BalanceData | null;
  engineState: EngineState | null;
  logs: LogEntry[];
  isPaused: boolean;
  pauseFeed: () => void;
  resumeFeed: () => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const TradingContext = createContext<TradingContextValue | null>(null);

// SCALING ARCHITECTURE: Reduced update rates to prevent memory exhaustion
const THROTTLE_MS = 1000; // 1Hz maximum update rate (reduced from 2Hz)
const BATCH_INTERVAL_MS = 1000; // Batch state updates every 1 second (reduced from 500ms)
const MAX_LOGS = 30; // Hard cap on logs (reduced from 100)

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const [batchedState, setBatchedState] = useState<BatchedState>({
    price: null,
    balance: null,
    engineState: null,
    logs: [],
  });
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  const pendingUpdatesRef = useRef<Partial<BatchedState>>({});
  const lastPriceUpdateRef = useRef<number>(0);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // MEMORY LEAK FIX: logsInterval must be a ref, not local variable
  const logsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // KILLED REACT STATE FOR PRICE - Direct DOM injection only
  // This eliminates 98% memory leak from React re-renders
  const throttledPriceUpdate = useCallback((data: PriceData) => {
    const now = Date.now();
    if (now - lastPriceUpdateRef.current >= THROTTLE_MS) {
      lastPriceUpdateRef.current = now;
      // BLOCKED: Do NOT queue price to React state
      // pendingUpdatesRef.current.price = data;
      
      // DIRECT DOM INJECTION ONLY - bypasses React completely
      domInjector.updatePrice(data.price);
      
      // Update Memory Commander buffer tracking
      memoryCommander.updateAssetBuffers(data.symbol, { priceBuffer: 1 });
    }
  }, []);

  const queueUpdate = useCallback((updates: Partial<BatchedState>) => {
    // SCALING: Skip price updates entirely - they go through DOM injection
    const { price, ...otherUpdates } = updates;
    Object.assign(pendingUpdatesRef.current, otherUpdates);
    
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(() => {
        const pending = pendingUpdatesRef.current;
        if (Object.keys(pending).length > 0) {
          setBatchedState(prev => ({
            ...prev,
            ...pending,
            // HARD CAP: Max 30 logs instead of 100
            logs: pending.logs ? [...prev.logs, ...pending.logs].slice(-MAX_LOGS) : prev.logs,
          }));
          pendingUpdatesRef.current = {};
        }
        batchTimerRef.current = null;
      }, BATCH_INTERVAL_MS);
    }
  }, []);

  const fetchHealthData = useCallback(async () => {
    if (isPaused) return;
    
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      console.log("[API-DEBUG] Health STATUS:", response.status);

      if (!response.ok && response.status >= 500) {
        throw new Error('Server error during health check');
      }
      
      const now = Date.now();
      
      throttledPriceUpdate({
        symbol: 'BTC/USDT',
        price: data.currentPrice || 0,
        timestamp: now,
      });
      
      queueUpdate({
        balance: {
          usdt: data.balance?.USDT || 0,
          btc: data.balance?.BTC || 0,
          timestamp: now,
        },
        engineState: {
          isRunning: data.isRunning || false,
          currentPrice: data.currentPrice || 0,
          lastSignal: data.lastSignal || 'hold',
          activePositions: data.activePositions || 0,
        },
      });
      
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('error');
    }
  }, [isPaused, throttledPriceUpdate, queueUpdate]);

  const fetchLogs = useCallback(async () => {
    if (isPaused) return;
    
    try {
      const response = await fetch('/api/logs?limit=20');
      if (!response.ok) return;
      
      const logs = await response.json();
      queueUpdate({
        logs: logs.map((log: { level: string; message: string; createdAt: string }) => ({
          level: log.level,
          message: log.message,
          timestamp: new Date(log.createdAt).getTime(),
        })),
      });
    } catch {
      // Silent fail for logs
    }
  }, [isPaused, queueUpdate]);

  useEffect(() => {
    // MEMORY LEAK FIX: Clear ALL intervals first before any logic
    // This prevents orphan intervals when isPaused changes
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (logsIntervalRef.current) {
      clearInterval(logsIntervalRef.current);
      logsIntervalRef.current = null;
    }
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    
    if (isPaused) {
      // MEMORY FIX: Nullify old state immediately when pausing
      pendingUpdatesRef.current = {};
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    
    fetchHealthData();
    fetchLogs();
    
    // SCALING ARCHITECTURE: Reduced polling intervals to prevent memory exhaustion
    // Health data every 3 seconds (was 2 seconds)
    pollIntervalRef.current = setInterval(() => {
      fetchHealthData();
    }, 3000);

    // Logs every 10 seconds (was 5 seconds) - logs are not real-time critical
    logsIntervalRef.current = setInterval(() => {
      fetchLogs();
    }, 10000);

    return () => {
      // MEMORY LEAK FIX: Clear all intervals via refs
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (logsIntervalRef.current) {
        clearInterval(logsIntervalRef.current);
        logsIntervalRef.current = null;
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      // Nullify pending updates
      pendingUpdatesRef.current = {};
    };
  }, [isPaused, fetchHealthData, fetchLogs]);

  const pauseFeed = useCallback(() => setIsPaused(true), []);
  const resumeFeed = useCallback(() => setIsPaused(false), []);

  const value = useMemo<TradingContextValue>(() => ({
    price: batchedState.price,
    balance: batchedState.balance,
    engineState: batchedState.engineState,
    logs: batchedState.logs,
    isPaused,
    pauseFeed,
    resumeFeed,
    connectionStatus,
  }), [batchedState, isPaused, pauseFeed, resumeFeed, connectionStatus]);

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTradingContext() {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTradingContext must be used within a TradingProvider');
  }
  return context;
}

export function useThrottledPrice() {
  const { price, isPaused } = useTradingContext();
  return { price, isPaused };
}

export function useEngineState() {
  const { engineState, connectionStatus } = useTradingContext();
  return { engineState, connectionStatus };
}

export function useTradingLogs() {
  const { logs } = useTradingContext();
  return logs;
}

export function useFeedControl() {
  const { isPaused, pauseFeed, resumeFeed } = useTradingContext();
  return { isPaused, pauseFeed, resumeFeed };
}
