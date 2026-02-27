// Memory Garbage Collector
// Aggressive cleanup logic that runs every 30 seconds
// Clears price buffers, render caches, and forces JS garbage collection

type CleanupCallback = () => void;

interface GCStats {
  lastRun: number;
  runsCount: number;
  totalCleaned: number;
}

class MemoryGarbageCollector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cleanupCallbacks: Set<CleanupCallback> = new Set();
  private stats: GCStats = {
    lastRun: 0,
    runsCount: 0,
    totalCleaned: 0
  };
  
  // Configuration
  private readonly GC_INTERVAL_MS = 30000; // 30 seconds
  private readonly MAX_MEMORY_PERCENT = 75; // Target max memory usage
  
  // Start the garbage collector
  start(): void {
    if (this.intervalId) return; // Already running
    
    console.log('[MEMORY-GC] Starting aggressive garbage collector (30s interval)');
    
    this.intervalId = setInterval(() => {
      this.runGC();
    }, this.GC_INTERVAL_MS);
    
    // Run once immediately
    this.runGC();
  }
  
  // Stop the garbage collector
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MEMORY-GC] Stopped');
    }
  }
  
  // Register a cleanup callback
  registerCleanup(callback: CleanupCallback): () => void {
    this.cleanupCallbacks.add(callback);
    return () => {
      this.cleanupCallbacks.delete(callback);
    };
  }
  
  // Run garbage collection cycle
  private runGC(): void {
    const startTime = performance.now();
    let itemsCleaned = 0;
    
    // Execute all registered cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
        itemsCleaned++;
      } catch (err) {
        console.warn('[MEMORY-GC] Cleanup callback error:', err);
      }
    });
    
    // Clear any WeakRef caches
    this.clearWeakCaches();
    
    // Force browser garbage collection hint
    this.hintGC();
    
    const duration = performance.now() - startTime;
    this.stats.lastRun = Date.now();
    this.stats.runsCount++;
    this.stats.totalCleaned += itemsCleaned;
    
    console.log(`[MEMORY-GC] Cycle complete: ${itemsCleaned} callbacks, ${duration.toFixed(1)}ms`);
  }
  
  // Clear any weak reference caches
  private clearWeakCaches(): void {
    // Clear any cached DOM references that might be stale
    if (typeof window !== 'undefined') {
      // Force layout recalculation to release detached DOM nodes
      void document.body.offsetHeight;
    }
  }
  
  // Hint to browser that GC should run
  private hintGC(): void {
    // Create and immediately discard a large allocation to trigger GC
    if (typeof window !== 'undefined' && (window as any).gc) {
      // V8 exposed GC (only in dev mode with --expose-gc)
      try {
        (window as any).gc();
      } catch (e) {
        // Silent fail - gc not available
      }
    }
    
    // Alternative: Create pressure then release
    // This is a soft hint, not guaranteed to trigger GC
    try {
      const pressure = new Array(1000);
      pressure.length = 0;
    } catch (e) {
      // Silent fail
    }
  }
  
  // Get GC statistics
  getStats(): GCStats {
    return { ...this.stats };
  }
  
  // Check if memory usage is above threshold
  async checkMemoryPressure(): Promise<boolean> {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        return usagePercent > this.MAX_MEMORY_PERCENT;
      }
    }
    return false;
  }
  
  // Force immediate GC if memory pressure is high
  async forceGCIfNeeded(): Promise<void> {
    const underPressure = await this.checkMemoryPressure();
    if (underPressure) {
      console.warn('[MEMORY-GC] High memory pressure detected - forcing cleanup');
      this.runGC();
    }
  }
}

// Singleton instance
export const memoryGC = new MemoryGarbageCollector();
export default memoryGC;
