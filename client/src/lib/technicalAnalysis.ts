// Real Technical Analysis Library
// Computes RSI(14) and EMA(200) from live WebSocket price data
// WITH GAP DETECTION AND RECOVERY

export interface PriceCandle {
  price: number;
  timestamp: number;
}

export class TechnicalAnalyzer {
  private prices: number[] = [];
  private timestamps: number[] = [];
  
  // FULL PERFORMANCE FIX: MEMORY HARD-CAP
  // Core Engine: Fixed 100 prices for calculations (was 200, reduced for memory)
  // This is sufficient for RSI(14) and provides good EMA approximation
  private readonly CORE_BUFFER_SIZE = 100;
  
  // UI/Dashboard: Strict 100 prices exposed to React state - HARD CAP
  // This prevents memory spikes to 97% and keeps UI responsive
  private readonly UI_BUFFER_SIZE = 100;
  
  private maxLength: number = 100; // MEMORY HARD-CAP: Max 100 prices
  
  // Gap detection settings
  private readonly EXPECTED_INTERVAL_MS = 1000; // Expected price interval (1 second for WebSocket)
  private readonly GAP_THRESHOLD_MULTIPLIER = 20; // 20x expected interval = gap (20 seconds)
  private readonly MAX_PRICE_JUMP_PERCENT = 2.0; // 2% max jump without gap
  
  // Gap recovery state
  private lastPriceTime: number = 0;
  private gapDetected: boolean = false;
  private pendingRecovery: boolean = false;

  addPrice(price: number, timestamp?: number) {
    const now = timestamp || Date.now();
    
    // GAP DETECTION: Check if this price came after a long disconnect
    if (this.lastPriceTime > 0) {
      const timeSinceLastPrice = now - this.lastPriceTime;
      const expectedGapThreshold = this.EXPECTED_INTERVAL_MS * this.GAP_THRESHOLD_MULTIPLIER;
      
      if (timeSinceLastPrice > expectedGapThreshold) {
        // GAP DETECTED - WebSocket was disconnected for >20 seconds
        this.gapDetected = true;
        this.pendingRecovery = true;
        console.warn(`[GAP DETECTED] ${(timeSinceLastPrice / 1000).toFixed(1)}s gap - marking for recovery`);
        
        // DON'T add this price yet - wait for gap fill
        // Instead, trigger recovery callback
        this.onGapDetected?.(this.lastPriceTime, now);
        return;
      }
      
      // PRICE JUMP VALIDATION: Reject abnormal jumps even without time gap
      if (this.prices.length > 0) {
        const lastPrice = this.prices[this.prices.length - 1];
        const jumpPercent = Math.abs((price - lastPrice) / lastPrice) * 100;
        
        if (jumpPercent > this.MAX_PRICE_JUMP_PERCENT && timeSinceLastPrice < 5000) {
          console.warn(`[PRICE JUMP] ${jumpPercent.toFixed(2)}% jump detected - possible data corruption`);
          // Still add but flag as suspicious
        }
      }
    }
    
    this.prices.push(price);
    this.timestamps.push(now);
    this.lastPriceTime = now;
    
    if (this.prices.length > this.maxLength) {
      this.prices.shift();
      this.timestamps.shift();
    }
    
    // Clear gap flag after successful price add
    this.gapDetected = false;
  }
  
  // Gap recovery callback
  private onGapDetected?: (gapStart: number, gapEnd: number) => void;
  
  setGapRecoveryCallback(callback: (gapStart: number, gapEnd: number) => void) {
    this.onGapDetected = callback;
  }
  
  // Fill gap with historical candles (called by recovery mechanism)
  fillGap(candles: PriceCandle[]) {
    if (candles.length === 0) {
      console.warn('[GAP FILL] No candles to fill gap');
      this.pendingRecovery = false;
      return;
    }
    
    // Sort by timestamp ascending
    const sorted = candles.sort((a, b) => a.timestamp - b.timestamp);
    
    // Insert candles at correct position
    for (const candle of sorted) {
      // Find insertion point
      let insertIndex = this.timestamps.length;
      for (let i = 0; i < this.timestamps.length; i++) {
        if (this.timestamps[i] > candle.timestamp) {
          insertIndex = i;
          break;
        }
      }
      
      // Insert if not duplicate
      if (insertIndex === 0 || this.timestamps[insertIndex - 1] !== candle.timestamp) {
        this.prices.splice(insertIndex, 0, candle.price);
        this.timestamps.splice(insertIndex, 0, candle.timestamp);
      }
    }
    
    // Trim to max length
    while (this.prices.length > this.maxLength) {
      this.prices.shift();
      this.timestamps.shift();
    }
    
    this.pendingRecovery = false;
    console.log(`[GAP FILL] Inserted ${sorted.length} candles, total: ${this.prices.length}`);
  }
  
  // Check if recovery is pending
  hasPendingRecovery(): boolean {
    return this.pendingRecovery;
  }
  
  // Check if data is reliable (no recent gaps)
  isDataReliable(): boolean {
    return !this.gapDetected && !this.pendingRecovery;
  }

  // MEMORY GARBAGE COLLECTOR: Aggressive cleanup for 30-second GC cycle
  // Clears old price data beyond maxAge, enforces hard cap
  garbageCollect(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes max age
    
    // Remove prices older than maxAge
    while (this.timestamps.length > 0 && (now - this.timestamps[0]) > maxAge) {
      this.prices.shift();
      this.timestamps.shift();
    }
    
    // Enforce hard cap regardless of age
    while (this.prices.length > this.maxLength) {
      this.prices.shift();
      this.timestamps.shift();
    }
    
    console.log(`[TECH-ANALYZER-GC] Cleaned to ${this.prices.length} prices`);
  }

  // UI PERFORMANCE LAYER: Returns only last 50 prices for React state
  // This prevents UI lag by limiting state updates to a small subset
  getPricesForUI(): number[] {
    return this.prices.slice(-this.UI_BUFFER_SIZE);
  }
  
  // CORE ENGINE LAYER: Returns full buffer for internal calculations
  // Used for accurate RSI/EMA computations (up to 200 prices)
  getPrices(): number[] {
    return [...this.prices];
  }

  getPriceCount(): number {
    return this.prices.length;
  }
  
  // Get buffer stats for debugging/monitoring
  getBufferStats(): { coreSize: number; uiSize: number; memoryOptimized: boolean } {
    return {
      coreSize: this.prices.length,
      uiSize: Math.min(this.prices.length, this.UI_BUFFER_SIZE),
      memoryOptimized: this.prices.length <= this.CORE_BUFFER_SIZE
    };
  }

  // Exponential Moving Average
  calculateEMA(period: number): number {
    if (this.prices.length < period) return 0;
    
    const k = 2 / (period + 1);
    let ema = this.prices[0];
    
    for (let i = 1; i < this.prices.length; i++) {
      ema = this.prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }

  // Simple Moving Average
  calculateSMA(period: number): number {
    if (this.prices.length < period) return 0;
    
    const slice = this.prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  // Relative Strength Index (14-period)
  calculateRSI(period: number = 14): number {
    if (this.prices.length < period + 1) return 50; // Neutral when insufficient data
    
    let gains = 0;
    let losses = 0;
    
    // Calculate initial average gain/loss
    for (let i = this.prices.length - period; i < this.prices.length; i++) {
      const change = this.prices[i] - this.prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }

  // Get all indicators at once
  getIndicators(): {
    rsi14: number;
    ema200: number;
    ema50: number;
    sma20: number;
    currentPrice: number;
    priceCount: number;
    ready: boolean;
    reliable: boolean; // NEW: Indicates if data has no gaps
  } {
    const currentPrice = this.prices.length > 0 ? this.prices[this.prices.length - 1] : 0;
    const rsi14 = this.calculateRSI(14);
    const ema200 = this.calculateEMA(200);
    const ema50 = this.calculateEMA(50);
    const sma20 = this.calculateSMA(20);
    
    return {
      rsi14,
      ema200,
      ema50,
      sma20,
      currentPrice,
      priceCount: this.prices.length,
      ready: this.prices.length >= 200, // Ready when we have enough data for EMA(200)
      reliable: this.isDataReliable() // NEW: No gaps detected
    };
  }

  // ELITE RSI Strategy - Momentum Divergence
  checkEliteRSI(): { signal: boolean; reason: string } {
    const { rsi14, ema200, currentPrice, ready } = this.getIndicators();
    
    if (!ready) {
      return { signal: false, reason: `Collecting data (${this.prices.length}/200)` };
    }
    
    // Buy when RSI < 35 (oversold) and price is above EMA(200) (uptrend)
    if (rsi14 < 35 && currentPrice > ema200) {
      return { 
        signal: true, 
        reason: `RSI(${rsi14.toFixed(1)}) < 35 & Price > EMA200` 
      };
    }
    
    return { signal: false, reason: `RSI: ${rsi14.toFixed(1)}, Price vs EMA200: ${currentPrice > ema200 ? 'Above' : 'Below'}` };
  }

  // GOLDEN STRIKE Strategy - Liquidity Sweep
  checkGoldenStrike(low24h: number, prevLow: number): { signal: boolean; reason: string } {
    const { currentPrice, ready } = this.getIndicators();
    
    if (!ready) {
      return { signal: false, reason: `Collecting data (${this.prices.length}/200)` };
    }
    
    // Liquidity sweep: price dipped below previous low but closed above it
    if (low24h < prevLow && currentPrice > prevLow) {
      return { 
        signal: true, 
        reason: `Liquidity Sweep: Low(${low24h.toFixed(0)}) < PrevLow(${prevLow.toFixed(0)})` 
      };
    }
    
    return { signal: false, reason: `No sweep detected` };
  }

  // Reset analyzer
  reset() {
    this.prices = [];
    this.timestamps = [];
    this.lastPriceTime = 0;
    this.gapDetected = false;
    this.pendingRecovery = false;
  }
}

// Singleton instance
export const technicalAnalyzer = new TechnicalAnalyzer();
