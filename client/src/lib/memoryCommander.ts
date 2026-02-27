/**
 * GLOBAL MEMORY COMMANDER
 * 20-Asset Scaling Architecture
 * 
 * ABSOLUTE RULES:
 * - Each asset MUST NOT exceed 4% of total heap
 * - Total memory MUST stay below 85%
 * - Trading engine is IMMUNE to throttling
 * - One asset failure MUST NOT impact others
 */

interface AssetMemoryState {
  symbol: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  memoryBudgetKB: number;
  currentUsageKB: number;
  usagePercent: number;
  bufferSizes: {
    priceBuffer: number;
    tickHistory: number;
    candleCache: number;
    renderCache: number;
  };
  updateRate: number; // updates per second
  throttled: boolean;
  analyticsEnabled: boolean;
  lastUpdate: number;
  workerId: string | null;
  wsConnected: boolean;
}

interface GlobalMemoryState {
  totalHeapKB: number;
  usedHeapKB: number;
  usagePercent: number;
  targetMaxPercent: number;
  assets: Map<string, AssetMemoryState>;
  throttledAssets: Set<string>;
  degradedAssets: Set<string>;
}

// HARD LIMITS - NO EXCEPTIONS - NUCLEAR ORDER COMPLIANCE
const HARD_LIMITS = {
  MAX_ASSETS: 10,  // LOCKED: 10-ASSET ERA IS ABSOLUTE
  MAX_TOTAL_MEMORY_PERCENT: 50,  // NUCLEAR ORDER: < 50% MANDATORY
  WARNING_MEMORY_PERCENT: 40,
  PER_ASSET_MAX_PERCENT: 4,  // 4% CEILING PER ASSET - SYSTEM FAULT IF EXCEEDED
  PER_ASSET_BUDGET_KB: 50,
  
  // Buffer caps
  MAX_PRICE_BUFFER: 50,
  MAX_TICK_HISTORY: 30,
  MAX_CANDLE_CACHE: 100,
  MAX_RENDER_CACHE: 20,
  MAX_CLOSED_TRADES: 50,
  
  // Update rates
  NORMAL_UPDATE_HZ: 2,
  THROTTLED_UPDATE_HZ: 0.5,
  DEGRADED_UPDATE_HZ: 0.1,
  
  // Scan interval
  SCAN_INTERVAL_MS: 5000,
};

class MemoryCommander {
  private state: GlobalMemoryState;
  private scanIntervalId: ReturnType<typeof setInterval> | null = null;
  private onThrottleCallbacks: Set<(symbol: string, level: 'normal' | 'throttled' | 'degraded') => void> = new Set();
  
  constructor() {
    this.state = {
      totalHeapKB: 0,
      usedHeapKB: 0,
      usagePercent: 0,
      targetMaxPercent: HARD_LIMITS.MAX_TOTAL_MEMORY_PERCENT,
      assets: new Map(),
      throttledAssets: new Set(),
      degradedAssets: new Set(),
    };
  }
  
  start(): void {
    if (this.scanIntervalId) return;
    
    console.log('[MEM-COMMANDER] NUCLEAR ORDER: 10-Asset Memory Commander ARMED');
    console.log(`[MEM-COMMANDER] HARD LIMITS: ${HARD_LIMITS.MAX_ASSETS} assets | ${HARD_LIMITS.MAX_TOTAL_MEMORY_PERCENT}% max | ${HARD_LIMITS.PER_ASSET_MAX_PERCENT}% per asset`);
    
    this.scanIntervalId = setInterval(() => {
      this.scan();
    }, HARD_LIMITS.SCAN_INTERVAL_MS);
    
    this.scan();
  }
  
  stop(): void {
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
  }
  
  registerAsset(symbol: string, priority: 'critical' | 'high' | 'normal' | 'low' = 'normal'): void {
    if (this.state.assets.size >= HARD_LIMITS.MAX_ASSETS) {
      console.warn(`[MEM-COMMANDER] Cannot add ${symbol}: Max ${HARD_LIMITS.MAX_ASSETS} assets reached`);
      return;
    }
    
    if (this.state.assets.has(symbol)) {
      return;
    }
    
    this.state.assets.set(symbol, {
      symbol,
      priority,
      memoryBudgetKB: HARD_LIMITS.PER_ASSET_BUDGET_KB,
      currentUsageKB: 0,
      usagePercent: 0,
      bufferSizes: {
        priceBuffer: 0,
        tickHistory: 0,
        candleCache: 0,
        renderCache: 0,
      },
      updateRate: HARD_LIMITS.NORMAL_UPDATE_HZ,
      throttled: false,
      analyticsEnabled: true,
      lastUpdate: Date.now(),
      workerId: null,
      wsConnected: false,
    });
    
    console.log(`[MEM-COMMANDER] Registered asset: ${symbol} (priority: ${priority})`);
  }
  
  unregisterAsset(symbol: string): void {
    this.state.assets.delete(symbol);
    this.state.throttledAssets.delete(symbol);
    this.state.degradedAssets.delete(symbol);
    console.log(`[MEM-COMMANDER] Unregistered asset: ${symbol}`);
  }
  
  updateAssetBuffers(symbol: string, buffers: Partial<AssetMemoryState['bufferSizes']>): void {
    const asset = this.state.assets.get(symbol);
    if (!asset) return;
    
    Object.assign(asset.bufferSizes, buffers);
    
    // Enforce hard caps immediately
    if (asset.bufferSizes.priceBuffer > HARD_LIMITS.MAX_PRICE_BUFFER) {
      asset.bufferSizes.priceBuffer = HARD_LIMITS.MAX_PRICE_BUFFER;
    }
    if (asset.bufferSizes.tickHistory > HARD_LIMITS.MAX_TICK_HISTORY) {
      asset.bufferSizes.tickHistory = HARD_LIMITS.MAX_TICK_HISTORY;
    }
    if (asset.bufferSizes.candleCache > HARD_LIMITS.MAX_CANDLE_CACHE) {
      asset.bufferSizes.candleCache = HARD_LIMITS.MAX_CANDLE_CACHE;
    }
    if (asset.bufferSizes.renderCache > HARD_LIMITS.MAX_RENDER_CACHE) {
      asset.bufferSizes.renderCache = HARD_LIMITS.MAX_RENDER_CACHE;
    }
    
    // Estimate memory usage
    const estimatedKB = 
      (asset.bufferSizes.priceBuffer * 0.1) +
      (asset.bufferSizes.tickHistory * 0.2) +
      (asset.bufferSizes.candleCache * 0.5) +
      (asset.bufferSizes.renderCache * 0.3);
    
    asset.currentUsageKB = estimatedKB;
    asset.lastUpdate = Date.now();
  }
  
  setWorkerStatus(symbol: string, workerId: string | null): void {
    const asset = this.state.assets.get(symbol);
    if (asset) {
      asset.workerId = workerId;
    }
  }
  
  setWebSocketStatus(symbol: string, connected: boolean): void {
    const asset = this.state.assets.get(symbol);
    if (asset) {
      asset.wsConnected = connected;
    }
  }
  
  getUpdateRate(symbol: string): number {
    const asset = this.state.assets.get(symbol);
    if (!asset) return HARD_LIMITS.NORMAL_UPDATE_HZ;
    return asset.updateRate;
  }
  
  isThrottled(symbol: string): boolean {
    return this.state.throttledAssets.has(symbol);
  }
  
  isDegraded(symbol: string): boolean {
    return this.state.degradedAssets.has(symbol);
  }
  
  onThrottleChange(callback: (symbol: string, level: 'normal' | 'throttled' | 'degraded') => void): () => void {
    this.onThrottleCallbacks.add(callback);
    return () => this.onThrottleCallbacks.delete(callback);
  }
  
  private scan(): void {
    this.updateGlobalMemory();
    
    const { usagePercent } = this.state;
    
    if (usagePercent >= HARD_LIMITS.MAX_TOTAL_MEMORY_PERCENT) {
      this.enforceEmergencyThrottling();
    } else if (usagePercent >= HARD_LIMITS.WARNING_MEMORY_PERCENT) {
      this.enforceWarningThrottling();
    } else {
      this.relaxThrottling();
    }
    
    this.enforcePerAssetLimits();
    this.logStatus();
  }
  
  private updateGlobalMemory(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        this.state.totalHeapKB = Math.round(memory.jsHeapSizeLimit / 1024);
        this.state.usedHeapKB = Math.round(memory.usedJSHeapSize / 1024);
        this.state.usagePercent = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
      }
    }
  }
  
  private enforceEmergencyThrottling(): void {
    console.warn(`[MEM-COMMANDER] EMERGENCY: Memory at ${this.state.usagePercent}% - throttling top consumers`);
    
    // Find top 3 memory consumers (excluding critical assets)
    const sortedAssets = Array.from(this.state.assets.entries())
      .filter(([_, asset]) => asset.priority !== 'critical')
      .sort((a, b) => b[1].currentUsageKB - a[1].currentUsageKB)
      .slice(0, 3);
    
    sortedAssets.forEach(([symbol]) => {
      this.degradeAsset(symbol);
    });
  }
  
  private enforceWarningThrottling(): void {
    console.warn(`[MEM-COMMANDER] WARNING: Memory at ${this.state.usagePercent}% - throttling non-critical assets`);
    
    // Throttle all normal/low priority assets
    this.state.assets.forEach((asset, symbol) => {
      if (asset.priority === 'normal' || asset.priority === 'low') {
        this.throttleAsset(symbol);
      }
    });
  }
  
  private relaxThrottling(): void {
    // Memory is safe - gradually restore throttled assets
    Array.from(this.state.throttledAssets).forEach(symbol => {
      const asset = this.state.assets.get(symbol);
      if (asset && !this.state.degradedAssets.has(symbol)) {
        asset.updateRate = HARD_LIMITS.NORMAL_UPDATE_HZ;
        asset.throttled = false;
        asset.analyticsEnabled = true;
        this.state.throttledAssets.delete(symbol);
        this.notifyThrottleChange(symbol, 'normal');
      }
    });
    
    Array.from(this.state.degradedAssets).forEach(symbol => {
      const asset = this.state.assets.get(symbol);
      if (asset) {
        asset.updateRate = HARD_LIMITS.THROTTLED_UPDATE_HZ;
        asset.throttled = true;
        this.state.degradedAssets.delete(symbol);
        this.state.throttledAssets.add(symbol);
        this.notifyThrottleChange(symbol, 'throttled');
      }
    });
  }
  
  private throttleAsset(symbol: string): void {
    const asset = this.state.assets.get(symbol);
    if (!asset || this.state.throttledAssets.has(symbol)) return;
    
    asset.updateRate = HARD_LIMITS.THROTTLED_UPDATE_HZ;
    asset.throttled = true;
    this.state.throttledAssets.add(symbol);
    this.notifyThrottleChange(symbol, 'throttled');
    
    console.log(`[MEM-COMMANDER] Throttled: ${symbol} (${HARD_LIMITS.THROTTLED_UPDATE_HZ}Hz)`);
  }
  
  private degradeAsset(symbol: string): void {
    const asset = this.state.assets.get(symbol);
    if (!asset || this.state.degradedAssets.has(symbol)) return;
    
    asset.updateRate = HARD_LIMITS.DEGRADED_UPDATE_HZ;
    asset.throttled = true;
    asset.analyticsEnabled = false;
    this.state.throttledAssets.delete(symbol);
    this.state.degradedAssets.add(symbol);
    this.notifyThrottleChange(symbol, 'degraded');
    
    console.warn(`[MEM-COMMANDER] DEGRADED: ${symbol} - analytics disabled, ${HARD_LIMITS.DEGRADED_UPDATE_HZ}Hz`);
  }
  
  private enforcePerAssetLimits(): void {
    this.state.assets.forEach((asset, symbol) => {
      const usagePercent = this.state.totalHeapKB > 0 
        ? (asset.currentUsageKB / this.state.totalHeapKB) * 100 
        : 0;
      
      asset.usagePercent = usagePercent;
      
      if (usagePercent > HARD_LIMITS.PER_ASSET_MAX_PERCENT && asset.priority !== 'critical') {
        this.throttleAsset(symbol);
      }
    });
  }
  
  private notifyThrottleChange(symbol: string, level: 'normal' | 'throttled' | 'degraded'): void {
    this.onThrottleCallbacks.forEach(cb => {
      try {
        cb(symbol, level);
      } catch (e) {
        console.error('[MEM-COMMANDER] Callback error:', e);
      }
    });
  }
  
  private logStatus(): void {
    const { usagePercent, assets, throttledAssets, degradedAssets } = this.state;
    
    console.log(
      `[MEM-COMMANDER] Memory: ${usagePercent}% | Assets: ${assets.size}/${HARD_LIMITS.MAX_ASSETS} | Throttled: ${throttledAssets.size} | Degraded: ${degradedAssets.size}`
    );
  }
  
  getReport(): {
    global: { usagePercent: number; usedKB: number; totalKB: number };
    assets: Array<{
      symbol: string;
      priority: string;
      usageKB: number;
      usagePercent: number;
      throttled: boolean;
      degraded: boolean;
      updateRate: number;
      hasWorker: boolean;
      wsConnected: boolean;
    }>;
    throttledCount: number;
    degradedCount: number;
  } {
    return {
      global: {
        usagePercent: this.state.usagePercent,
        usedKB: this.state.usedHeapKB,
        totalKB: this.state.totalHeapKB,
      },
      assets: Array.from(this.state.assets.values()).map(a => ({
        symbol: a.symbol,
        priority: a.priority,
        usageKB: a.currentUsageKB,
        usagePercent: a.usagePercent,
        throttled: this.state.throttledAssets.has(a.symbol),
        degraded: this.state.degradedAssets.has(a.symbol),
        updateRate: a.updateRate,
        hasWorker: a.workerId !== null,
        wsConnected: a.wsConnected,
      })),
      throttledCount: this.state.throttledAssets.size,
      degradedCount: this.state.degradedAssets.size,
    };
  }
  
  forceGC(): void {
    console.log('[MEM-COMMANDER] Forcing global garbage collection');
    
    // Clear all render caches
    this.state.assets.forEach((asset) => {
      asset.bufferSizes.renderCache = 0;
    });
    
    // Force browser GC hint
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
      } catch (e) {
        // Silent fail
      }
    }
    
    // Create pressure then release
    try {
      const pressure = new Array(10000);
      pressure.length = 0;
    } catch (e) {
      // Silent fail
    }
  }
}

export const memoryCommander = new MemoryCommander();
export { HARD_LIMITS };
export default memoryCommander;
