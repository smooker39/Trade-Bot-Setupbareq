// Direct DOM Injection System
// Bypasses React state completely for zero-flicker price updates
// This is the ONLY way to eliminate UI flickering permanently

type ElementRef = HTMLElement | null;

interface DOMInjectorConfig {
  priceElementId: string;
  rsiElementId?: string;
  emaElementId?: string;
  balanceUsdtId?: string;
  balanceBtcId?: string;
}

class DirectDOMInjector {
  private priceElement: ElementRef = null;
  private rsiElement: ElementRef = null;
  private emaElement: ElementRef = null;
  private balanceUsdtElement: ElementRef = null;
  private balanceBtcElement: ElementRef = null;
  
  // Animation frame handle for cleanup
  private animationFrameId: number | null = null;
  
  // Last values to prevent unnecessary DOM writes
  private lastPrice: number = 0;
  private lastRsi: number = 0;
  private lastEma: number = 0;
  
  // Throttle settings
  private readonly THROTTLE_MS = 100; // 10 updates/sec max
  private lastUpdateTime: number = 0;

  // Initialize with element IDs
  init(config: DOMInjectorConfig): void {
    this.priceElement = document.getElementById(config.priceElementId);
    if (config.rsiElementId) {
      this.rsiElement = document.getElementById(config.rsiElementId);
    }
    if (config.emaElementId) {
      this.emaElement = document.getElementById(config.emaElementId);
    }
    if (config.balanceUsdtId) {
      this.balanceUsdtElement = document.getElementById(config.balanceUsdtId);
    }
    if (config.balanceBtcId) {
      this.balanceBtcElement = document.getElementById(config.balanceBtcId);
    }
  }

  // Update price with requestAnimationFrame for smooth rendering
  updatePrice(price: number): void {
    if (!this.priceElement || price === this.lastPrice) return;
    
    const now = performance.now();
    if (now - this.lastUpdateTime < this.THROTTLE_MS) return;
    this.lastUpdateTime = now;
    
    // Cancel any pending frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Schedule update on next paint
    this.animationFrameId = requestAnimationFrame(() => {
      if (this.priceElement) {
        this.priceElement.textContent = `$${price.toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
        this.lastPrice = price;
      }
      this.animationFrameId = null;
    });
  }

  // Update RSI indicator
  updateRSI(rsi: number): void {
    if (!this.rsiElement || Math.abs(rsi - this.lastRsi) < 0.1) return;
    
    requestAnimationFrame(() => {
      if (this.rsiElement) {
        this.rsiElement.textContent = rsi.toFixed(1);
        // Update color based on RSI value
        if (rsi < 30) {
          this.rsiElement.style.color = '#4ade80'; // green
        } else if (rsi > 70) {
          this.rsiElement.style.color = '#f87171'; // red
        } else {
          this.rsiElement.style.color = '#ffffff'; // white
        }
        this.lastRsi = rsi;
      }
    });
  }

  // Update EMA indicator
  updateEMA(ema: number): void {
    if (!this.emaElement || Math.abs(ema - this.lastEma) < 1) return;
    
    requestAnimationFrame(() => {
      if (this.emaElement) {
        this.emaElement.textContent = `$${ema.toFixed(0)}`;
        this.lastEma = ema;
      }
    });
  }

  // Batch update multiple values in single animation frame
  batchUpdate(updates: {
    price?: number;
    rsi?: number;
    ema?: number;
    balanceUsdt?: number;
    balanceBtc?: number;
  }): void {
    const now = performance.now();
    if (now - this.lastUpdateTime < this.THROTTLE_MS) return;
    this.lastUpdateTime = now;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.animationFrameId = requestAnimationFrame(() => {
      if (updates.price !== undefined && this.priceElement && updates.price !== this.lastPrice) {
        this.priceElement.textContent = `$${updates.price.toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
        this.lastPrice = updates.price;
      }
      
      if (updates.rsi !== undefined && this.rsiElement) {
        this.rsiElement.textContent = updates.rsi.toFixed(1);
      }
      
      if (updates.ema !== undefined && this.emaElement) {
        this.emaElement.textContent = `$${updates.ema.toFixed(0)}`;
      }
      
      if (updates.balanceUsdt !== undefined && this.balanceUsdtElement) {
        this.balanceUsdtElement.textContent = updates.balanceUsdt.toLocaleString(undefined, { 
          minimumFractionDigits: 2 
        });
      }
      
      if (updates.balanceBtc !== undefined && this.balanceBtcElement) {
        this.balanceBtcElement.textContent = updates.balanceBtc.toFixed(8);
      }
      
      this.animationFrameId = null;
    });
  }

  // Cleanup
  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.priceElement = null;
    this.rsiElement = null;
    this.emaElement = null;
    this.balanceUsdtElement = null;
    this.balanceBtcElement = null;
    this.lastPrice = 0;
    this.lastRsi = 0;
    this.lastEma = 0;
  }
}

// Singleton instance for global access
export const domInjector = new DirectDOMInjector();
export default domInjector;
