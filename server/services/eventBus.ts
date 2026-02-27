import { EventEmitter } from 'events';
import { log } from '../logger';

export interface PriceUpdateEvent {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface BalanceUpdateEvent {
  usdt: number;
  btc: number;
  timestamp: number;
}

export interface SignalEvent {
  action: 'buy' | 'sell' | 'hold';
  strategy: string;
  regime: string;
  confidence: number;
  reason: string;
  timestamp: number;
}

export interface LogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface EngineStateEvent {
  isRunning: boolean;
  currentPrice: number;
  lastSignal: string;
  activePositions: number;
  timestamp: number;
}

export type TradingEventType = 
  | 'price:update'
  | 'balance:update'
  | 'signal:new'
  | 'log:new'
  | 'log:batch'
  | 'engine:state'
  | 'trade:executed'
  | 'position:opened'
  | 'position:closed';

class TradingEventBus extends EventEmitter {
  private static instance: TradingEventBus;
  private lastEmitTimes: Map<string, number> = new Map();
  private throttleMs: number = 500; // 2Hz max for price updates
  private batchedLogs: LogEvent[] = [];
  private logBatchTimer: NodeJS.Timeout | null = null;
  private logBatchInterval: number = 1000; // Batch logs every 1 second

  private constructor() {
    super();
    this.setMaxListeners(100); // Support 50+ users with buffer
    log.info('[EVENT-BUS] TradingEventBus initialized');
  }

  static getInstance(): TradingEventBus {
    if (!TradingEventBus.instance) {
      TradingEventBus.instance = new TradingEventBus();
    }
    return TradingEventBus.instance;
  }

  emitPriceUpdate(data: PriceUpdateEvent): void {
    const now = Date.now();
    const lastEmit = this.lastEmitTimes.get('price:update') || 0;
    
    if (now - lastEmit >= this.throttleMs) {
      this.lastEmitTimes.set('price:update', now);
      this.emit('price:update', data);
    }
  }

  emitBalanceUpdate(data: BalanceUpdateEvent): void {
    this.emit('balance:update', data);
  }

  emitSignal(data: SignalEvent): void {
    this.emit('signal:new', data);
  }

  emitLog(data: LogEvent): void {
    this.batchedLogs.push(data);
    
    if (!this.logBatchTimer) {
      this.logBatchTimer = setTimeout(() => {
        if (this.batchedLogs.length > 0) {
          this.emit('log:batch', [...this.batchedLogs]);
          this.batchedLogs = [];
        }
        this.logBatchTimer = null;
      }, this.logBatchInterval);
    }
  }

  emitEngineState(data: EngineStateEvent): void {
    const now = Date.now();
    const lastEmit = this.lastEmitTimes.get('engine:state') || 0;
    
    if (now - lastEmit >= this.throttleMs) {
      this.lastEmitTimes.set('engine:state', now);
      this.emit('engine:state', data);
    }
  }

  emitTradeExecuted(data: { symbol: string; side: string; price: number; amount: number }): void {
    this.emit('trade:executed', { ...data, timestamp: Date.now() });
  }

  emitPositionOpened(data: { id: string; symbol: string; entryPrice: number; side: string }): void {
    this.emit('position:opened', { ...data, timestamp: Date.now() });
  }

  emitPositionClosed(data: { id: string; pnl: number; reason: string }): void {
    this.emit('position:closed', { ...data, timestamp: Date.now() });
  }

  getSubscriberCount(event: TradingEventType): number {
    return this.listenerCount(event);
  }

  setThrottleMs(ms: number): void {
    this.throttleMs = Math.max(100, ms); // Minimum 100ms
  }

  setLogBatchInterval(ms: number): void {
    this.logBatchInterval = Math.max(500, ms); // Minimum 500ms
  }
}

export const eventBus = TradingEventBus.getInstance();
