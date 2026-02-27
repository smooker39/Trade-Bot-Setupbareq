// Technical Indicators for the Predator Engine

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Simple Moving Average
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Exponential Moving Average
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// Average True Range (ATR) - Volatility Indicator
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  // Simple ATR (average of last N true ranges)
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / recentTR.length;
}

// Average Directional Index (ADX) - Trend Strength
export function calculateADX(candles: Candle[], period: number = 14): number {
  if (candles.length < period * 2) return 0;
  
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const highDiff = candles[i].high - candles[i - 1].high;
    const lowDiff = candles[i - 1].low - candles[i].low;
    
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    
    const trueRange = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    tr.push(trueRange);
  }
  
  // Smooth with EMA
  const smoothTR = calculateEMA(tr, period);
  const smoothPlusDM = calculateEMA(plusDM, period);
  const smoothMinusDM = calculateEMA(minusDM, period);
  
  if (smoothTR === 0) return 0;
  
  const plusDI = (smoothPlusDM / smoothTR) * 100;
  const minusDI = (smoothMinusDM / smoothTR) * 100;
  
  const diSum = plusDI + minusDI;
  if (diSum === 0) return 0;
  
  const dx = (Math.abs(plusDI - minusDI) / diSum) * 100;
  return dx;
}

// Relative Strength Index (RSI)
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

// MACD (Moving Average Convergence Divergence)
export function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // Signal line (9-period EMA of MACD) - simplified
  const signal = macd * 0.8; // Approximation for demo
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

// Check Triple Timeframe Trend Alignment
export function checkTripleTrend(
  prices1m: number[],
  prices5m: number[],
  prices15m: number[]
): { aligned: boolean; direction: 'bullish' | 'bearish' | 'neutral' } {
  const sma1m_fast = calculateSMA(prices1m, 5);
  const sma1m_slow = calculateSMA(prices1m, 20);
  
  const sma5m_fast = calculateSMA(prices5m, 5);
  const sma5m_slow = calculateSMA(prices5m, 20);
  
  const sma15m_fast = calculateSMA(prices15m, 5);
  const sma15m_slow = calculateSMA(prices15m, 20);
  
  const trend1m = sma1m_fast > sma1m_slow ? 1 : -1;
  const trend5m = sma5m_fast > sma5m_slow ? 1 : -1;
  const trend15m = sma15m_fast > sma15m_slow ? 1 : -1;
  
  const totalTrend = trend1m + trend5m + trend15m;
  
  if (totalTrend === 3) {
    return { aligned: true, direction: 'bullish' };
  } else if (totalTrend === -3) {
    return { aligned: true, direction: 'bearish' };
  }
  
  return { aligned: false, direction: 'neutral' };
}

// RSI + MACD Confirmation
export function checkRSI_MACD(prices: number[]): { confirmed: boolean; signal: 'buy' | 'sell' | 'hold' } {
  const rsi = calculateRSI(prices);
  const { macd, histogram } = calculateMACD(prices);
  
  // Bullish: RSI < 70 (not overbought) and MACD histogram positive
  if (rsi < 70 && rsi > 30 && histogram > 0 && macd > 0) {
    return { confirmed: true, signal: 'buy' };
  }
  
  // Bearish: RSI > 30 (not oversold) and MACD histogram negative
  if (rsi > 30 && rsi < 70 && histogram < 0 && macd < 0) {
    return { confirmed: true, signal: 'sell' };
  }
  
  // Mean Reversion for ranging markets
  if (rsi < 30) {
    return { confirmed: true, signal: 'buy' }; // Oversold
  }
  if (rsi > 70) {
    return { confirmed: true, signal: 'sell' }; // Overbought
  }
  
  return { confirmed: false, signal: 'hold' };
}
