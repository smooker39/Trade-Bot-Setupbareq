// [OMEGA ZERO - PHASE 5]
// THE PREDATOR SINGULARITY - Adaptive Intelligence & Recursive Trailing
// Developed by: Barq Sabah

import {
  calculateATR,
  calculateADX,
  calculateRSI,
  calculateSMA,
  type Candle
} from './indicators';

export type MarketRegime = 'TRENDING' | 'RANGING';
export type TradeSignal = 'buy' | 'sell' | 'hold';

export interface TradeDecision {
  action: TradeSignal;
  reason: string;
  regime: MarketRegime;
  strategy: 'AGGRESSIVE' | 'SCALP' | 'STANDBY';
  confidence: number;
  atr: number;
  adx: number;
  rsi: number;
}

export interface EngineState {
  lastPrice: number;
  entryPrice: number | null;
  highestPrice: number | null;
  trailingStop: number | null;
  acceleration: number;
}

export class PredatorEngine {
  private prices: number[] = [];
  private candles: Candle[] = [];
  private state: EngineState = {
    lastPrice: 0,
    entryPrice: null,
    highestPrice: null,
    trailingStop: null,
    acceleration: 0
  };

  /**
   * ADAPTIVE PREDATOR LOGIC (APL)
   * Mathematical logic: The engine adapts its sensitivity based on ADX (Trend Strength).
   * If ADX > 25, it enters Trend Mode (SMA Crossover).
   * If ADX < 25, it enters Scalp Mode (RSI Mean Reversion).
   */
  
  addPrice(price: number) {
    this.prices.push(price);
    if (this.prices.length > 200) this.prices.shift();
    
    // Calculate Acceleration: a = (v2 - v1) / t
    if (this.prices.length > 2) {
      const v1 = this.prices[this.prices.length - 2] - this.prices[this.prices.length - 3];
      const v2 = price - this.prices[this.prices.length - 2];
      this.state.acceleration = v2 - v1;
    }
    
    this.state.lastPrice = price;
    this.updateTrailingStop(price);
  }

  addCandle(candle: Candle) {
    this.candles.push(candle);
    if (this.candles.length > 100) this.candles.shift();
  }

  /**
   * RECURSIVE TRAILING ACCELERATION (RTA)
   * Formula: TrailingStop = HighestPrice - (ATR * (2.0 / (1 + AccelerationScore)))
   * This locks profits instantly during parabolic moves (Singularity).
   */
  private updateTrailingStop(currentPrice: number) {
    if (!this.state.entryPrice) return;

    if (!this.state.highestPrice || currentPrice > this.state.highestPrice) {
      this.state.highestPrice = currentPrice;
    }

    const candles = this.candles.length >= 14 ? this.candles : this.generateMockCandles();
    if (candles.length < 14) return;

    const atr = calculateATR(candles);
    const accScore = Math.max(0, this.state.acceleration / currentPrice);
    const multiplier = 2.0 / (1 + accScore * 1000); // Tightens stop as acceleration increases
    
    const newStop = this.state.highestPrice - (atr * multiplier);
    
    if (!this.state.trailingStop || newStop > this.state.trailingStop) {
      this.state.trailingStop = newStop;
    }
  }

  private generateMockCandles(): Candle[] {
    const candles: Candle[] = [];
    if (this.prices.length < 5) return [];
    for (let i = 4; i < this.prices.length; i++) {
      const slice = this.prices.slice(i - 4, i + 1);
      candles.push({
        timestamp: Date.now(),
        open: slice[0],
        high: Math.max(...slice),
        low: Math.min(...slice),
        close: slice[slice.length - 1],
        volume: 1000
      });
    }
    return candles;
  }

  public getSignal(): TradeDecision {
    const candles = this.candles.length >= 20 ? this.candles : this.generateMockCandles();
    if (candles.length < 20) {
      return this.standbyDecision('Insufficient data');
    }

    const adx = calculateADX(candles);
    const rsi = calculateRSI(this.prices);
    const atr = calculateATR(candles);
    const regime: MarketRegime = adx > 25 ? 'TRENDING' : 'RANGING';

    // PROFIT FORTRESS: Check for Stop Loss Exit
    if (this.state.entryPrice && this.state.trailingStop && this.state.lastPrice < this.state.trailingStop) {
      return {
        action: 'sell',
        reason: `SINGULARITY EXIT: Recursive Trailing Hit | Profit Locked`,
        regime,
        strategy: 'AGGRESSIVE',
        confidence: 100,
        atr, adx, rsi
      };
    }

    // Adaptive Entry Logic
    if (regime === 'TRENDING') {
      const smaShort = calculateSMA(this.prices, 9);
      const smaLong = calculateSMA(this.prices, 21);
      
      if (smaShort > smaLong && rsi < 65) {
        return {
          action: 'buy',
          reason: `PREDATOR-T: Trend Singularity | ADX=${adx.toFixed(1)}`,
          regime, strategy: 'AGGRESSIVE', confidence: 85, atr, adx, rsi
        };
      }
    } else {
      // Ranging/Mean Reversion
      if (rsi < 30) {
        return {
          action: 'buy',
          reason: `PREDATOR-R: Mean Reversion Oversold | RSI=${rsi.toFixed(1)}`,
          regime, strategy: 'SCALP', confidence: 70, atr, adx, rsi
        };
      } else if (rsi > 70) {
        return {
          action: 'sell',
          reason: `PREDATOR-R: Mean Reversion Overbought | RSI=${rsi.toFixed(1)}`,
          regime, strategy: 'SCALP', confidence: 70, atr, adx, rsi
        };
      }
    }

    return this.standbyDecision(`PREDATOR-W: Waiting for Singularity | RSI=${rsi.toFixed(1)}`, regime, atr, adx, rsi);
  }

  private standbyDecision(reason: string, regime: MarketRegime = 'RANGING', atr = 0, adx = 0, rsi = 50): TradeDecision {
    return { action: 'hold', reason, regime, strategy: 'STANDBY', confidence: 0, atr, adx, rsi };
  }

  public setEntry(price: number) {
    this.state.entryPrice = price;
    this.state.highestPrice = price;
    this.state.trailingStop = null;
  }

  public resetEntry() {
    this.state.entryPrice = null;
    this.state.highestPrice = null;
    this.state.trailingStop = null;
  }
}

export const predatorEngine = new PredatorEngine();
