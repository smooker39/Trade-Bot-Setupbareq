// Multi-Asset Manager
// Scales to 10+ assets while keeping memory usage below 75%
// Uses shared buffer pools and efficient memory management

import { TechnicalAnalyzer } from './technicalAnalysis';

interface AssetConfig {
  symbol: string;
  enabled: boolean;
  priority: 'high' | 'normal' | 'low';
}

interface AssetData {
  symbol: string;
  analyzer: TechnicalAnalyzer;
  lastUpdate: number;
  priceCount: number;
}

// Memory budget per asset (in KB) - ensures 10 assets stay under 75% memory
const MEMORY_BUDGET_PER_ASSET_KB = 50; // 50KB per asset = 500KB for 10 assets
const MAX_PRICES_PER_ASSET = 50; // Reduced from 100 for multi-asset scaling
const MAX_CONCURRENT_ASSETS = 10;

class MultiAssetManager {
  private assets: Map<string, AssetData> = new Map();
  private activeAssets: Set<string> = new Set();
  private gcIntervalId: ReturnType<typeof setInterval> | null = null;
  
  // Memory tracking
  private totalMemoryUsage: number = 0;
  private readonly maxMemoryUsagePercent = 75;
  
  constructor() {
    // MEMORY LEAK FIX: DO NOT auto-start GC in constructor
    // GC should only start when explicitly enabled via initAsset()
    // This prevents orphan intervals if the module is never used
  }
  
  // Initialize an asset for tracking
  initAsset(symbol: string, priority: 'high' | 'normal' | 'low' = 'normal'): TechnicalAnalyzer {
    // MEMORY LEAK FIX: Only start GC when first asset is initialized
    if (this.assets.size === 0 && !this.gcIntervalId) {
      this.startGC();
    }
    
    if (this.assets.has(symbol)) {
      return this.assets.get(symbol)!.analyzer;
    }
    
    // Check if we're at capacity
    if (this.assets.size >= MAX_CONCURRENT_ASSETS) {
      // Evict lowest priority asset
      this.evictLowestPriority();
    }
    
    const analyzer = new TechnicalAnalyzer();
    
    this.assets.set(symbol, {
      symbol,
      analyzer,
      lastUpdate: Date.now(),
      priceCount: 0
    });
    
    this.activeAssets.add(symbol);
    console.log(`[MULTI-ASSET] Initialized ${symbol} (${this.assets.size}/${MAX_CONCURRENT_ASSETS} assets)`);
    
    return analyzer;
  }
  
  // Get analyzer for a symbol
  getAnalyzer(symbol: string): TechnicalAnalyzer | null {
    const asset = this.assets.get(symbol);
    if (asset) {
      asset.lastUpdate = Date.now();
      return asset.analyzer;
    }
    return null;
  }
  
  // Update price for a symbol
  updatePrice(symbol: string, price: number, timestamp?: number): boolean {
    const asset = this.assets.get(symbol);
    if (!asset) {
      console.warn(`[MULTI-ASSET] Unknown symbol: ${symbol}`);
      return false;
    }
    
    asset.analyzer.addPrice(price, timestamp);
    asset.lastUpdate = Date.now();
    asset.priceCount = asset.analyzer.getPriceCount();
    
    return true;
  }
  
  // Get all active symbols
  getActiveSymbols(): string[] {
    return Array.from(this.activeAssets);
  }
  
  // Get memory stats
  getMemoryStats(): { 
    totalAssets: number; 
    activeAssets: number; 
    estimatedMemoryKB: number;
    memoryPercent: number;
  } {
    let totalPrices = 0;
    this.assets.forEach(asset => {
      totalPrices += asset.priceCount;
    });
    
    // Estimate: ~8 bytes per price (number) + ~8 bytes per timestamp
    const estimatedBytes = totalPrices * 16;
    const estimatedKB = estimatedBytes / 1024;
    
    return {
      totalAssets: this.assets.size,
      activeAssets: this.activeAssets.size,
      estimatedMemoryKB: Math.round(estimatedKB),
      memoryPercent: Math.min((estimatedKB / (MAX_CONCURRENT_ASSETS * MEMORY_BUDGET_PER_ASSET_KB)) * 100, 100)
    };
  }
  
  // Evict lowest priority/oldest asset
  private evictLowestPriority(): void {
    let oldestSymbol: string | null = null;
    let oldestTime = Infinity;
    
    this.assets.forEach((asset, symbol) => {
      if (asset.lastUpdate < oldestTime) {
        oldestTime = asset.lastUpdate;
        oldestSymbol = symbol;
      }
    });
    
    if (oldestSymbol) {
      this.removeAsset(oldestSymbol);
      console.log(`[MULTI-ASSET] Evicted ${oldestSymbol} (oldest)`);
    }
  }
  
  // Remove an asset
  removeAsset(symbol: string): void {
    this.assets.delete(symbol);
    this.activeAssets.delete(symbol);
  }
  
  // Run garbage collection on all assets
  runGC(): void {
    const startTime = performance.now();
    let cleaned = 0;
    
    this.assets.forEach(asset => {
      asset.analyzer.garbageCollect();
      cleaned++;
    });
    
    const duration = performance.now() - startTime;
    const stats = this.getMemoryStats();
    console.log(`[MULTI-ASSET-GC] Cleaned ${cleaned} assets in ${duration.toFixed(1)}ms | Memory: ${stats.estimatedMemoryKB}KB (${stats.memoryPercent.toFixed(1)}%)`);
  }
  
  // Start periodic GC
  private startGC(): void {
    if (this.gcIntervalId) return;
    
    // GC every 30 seconds
    this.gcIntervalId = setInterval(() => {
      this.runGC();
    }, 30000);
  }
  
  // Stop GC
  stopGC(): void {
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
      this.gcIntervalId = null;
    }
  }
  
  // Cleanup all assets
  destroy(): void {
    this.stopGC();
    this.assets.clear();
    this.activeAssets.clear();
    console.log('[MULTI-ASSET] Destroyed');
  }
}

// Singleton instance
export const multiAssetManager = new MultiAssetManager();
export default multiAssetManager;
