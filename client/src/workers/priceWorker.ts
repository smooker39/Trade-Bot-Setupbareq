// Web Worker for offloading price/indicator calculations from main UI thread
// This runs in a separate thread to prevent UI blocking

interface PriceData {
  price: number;
  timestamp: number;
}

interface IndicatorResult {
  rsi14: number;
  ema200: number;
  ema50: number;
  sma20: number;
  priceCount: number;
  ready: boolean;
}

// Worker-side price buffer with strict memory limits
const MAX_PRICES = 100; // HARD CAP for memory safety
let prices: number[] = [];
let timestamps: number[] = [];

// Calculate RSI(14) - Relative Strength Index
function calculateRSI(priceArray: number[], period: number = 14): number {
  if (priceArray.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = priceArray.length - period; i < priceArray.length; i++) {
    const change = priceArray[i] - priceArray[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate EMA (Exponential Moving Average)
function calculateEMA(priceArray: number[], period: number): number {
  if (priceArray.length === 0) return 0;
  if (priceArray.length < period) {
    return priceArray.reduce((a, b) => a + b, 0) / priceArray.length;
  }
  
  const multiplier = 2 / (period + 1);
  let ema = priceArray.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < priceArray.length; i++) {
    ema = (priceArray[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

// Calculate SMA (Simple Moving Average)
function calculateSMA(priceArray: number[], period: number): number {
  if (priceArray.length === 0) return 0;
  const slice = priceArray.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// Process new price and calculate all indicators
function processPrice(data: PriceData): IndicatorResult {
  prices.push(data.price);
  timestamps.push(data.timestamp);
  
  // MEMORY HARD CAP: Never exceed 100 prices
  while (prices.length > MAX_PRICES) {
    prices.shift();
    timestamps.shift();
  }
  
  return {
    rsi14: calculateRSI(prices, 14),
    ema200: calculateEMA(prices, Math.min(prices.length, 100)), // Cap at 100 for memory
    ema50: calculateEMA(prices, 50),
    sma20: calculateSMA(prices, 20),
    priceCount: prices.length,
    ready: prices.length >= 14
  };
}

// Aggressive garbage collection - clear old data
function garbageCollect(): void {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes max age
  
  while (timestamps.length > 0 && (now - timestamps[0]) > maxAge) {
    prices.shift();
    timestamps.shift();
  }
  
  // Force cap to 100 prices regardless of age
  while (prices.length > MAX_PRICES) {
    prices.shift();
    timestamps.shift();
  }
}

// Clear all buffers for hard reset
function clearBuffers(): void {
  prices = [];
  timestamps = [];
}

// Message handler
self.onmessage = (event: MessageEvent) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'PRICE_UPDATE':
      const indicators = processPrice(data);
      self.postMessage({ type: 'INDICATORS', data: indicators });
      break;
      
    case 'GARBAGE_COLLECT':
      garbageCollect();
      self.postMessage({ type: 'GC_COMPLETE', data: { priceCount: prices.length } });
      break;
      
    case 'CLEAR_BUFFERS':
      clearBuffers();
      self.postMessage({ type: 'BUFFERS_CLEARED' });
      break;
      
    case 'GET_STATE':
      self.postMessage({ 
        type: 'STATE', 
        data: { 
          priceCount: prices.length, 
          latestPrice: prices[prices.length - 1] || 0 
        } 
      });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};

// Notify main thread that worker is ready
self.postMessage({ type: 'WORKER_READY' });
