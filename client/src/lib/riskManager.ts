// Risk Management Module - النسخة المطورة
// Controls trade sizing, TP/SL, concurrent trade limits, and emergency functions

// --- Configuration Types ---
export type TradeSizeMode = 'manual' | 'percentage';

export interface TradeSizeConfig {
  mode: TradeSizeMode;
  manualAmountUSDT: number; 
  percentage: number; 
}

export const QUICK_SELECT_PERCENTAGES: number[] = [25, 50, 75, 100];
export const MIN_ORDER_USDT = 5;
export const API_PREVIEW_TRADE = '/api/trade/preview';
export const API_EXECUTE_TRADE = '/api/trade/execute';

export interface RiskConfig {
  tradeAmountUSDT: number;      
  takeProfitPercent: number;    
  stopLossPercent: number;      
  maxConcurrentTrades: number;  
  allocationPercentage: number;
  mode: TradeSizeMode;
}

export interface ActiveTrade {
  id: string;
  strategy: string;
  entryPrice: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
  takeProfitPrice: number;
  stopLossPrice: number;
}

// Emergency close result type
export interface EmergencyCloseResult {
  success: boolean;
  closedPositions: number;
  totalPnL: number;
  errors: string[];
  timestamp: number;
}

// Trade close result
export interface TradeCloseResult {
  trade: ActiveTrade;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  reason: 'EMERGENCY' | 'TP' | 'SL' | 'MANUAL';
}

export class RiskManager {
  private config: RiskConfig = {
    tradeAmountUSDT: 5,
    takeProfitPercent: 1.5,
    stopLossPercent: 0.8,
    maxConcurrentTrades: 2,
    allocationPercentage: 10,
    mode: 'manual'
  };

  private activeTrades: ActiveTrade[] = [];
  private closedTrades: TradeCloseResult[] = [];
  private isEmergencyMode: boolean = false;
  
  // MEMORY LEAK FIX: Hard cap on closed trades history
  private readonly MAX_CLOSED_TRADES = 50;

  // === Configuration Methods ===

  getConfig(): RiskConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RiskConfig>) {
    this.config = { ...this.config, ...updates };
  }

  // === Trade Permission ===

  canOpenTrade(): { allowed: boolean; reason: string } {
    if (this.isEmergencyMode) {
      return {
        allowed: false,
        reason: 'Emergency mode active - trading disabled'
      };
    }
    
    if (this.activeTrades.length >= this.config.maxConcurrentTrades) {
      return {
        allowed: false,
        reason: `Max concurrent trades reached (${this.config.maxConcurrentTrades})`
      };
    }
    return { allowed: true, reason: 'Trade allowed' };
  }

  // === Active Trade Management ===

  getActiveTradeCount(): number {
    return this.activeTrades.length;
  }

  getActiveTrades(): ActiveTrade[] {
    return [...this.activeTrades];
  }

  getClosedTrades(): TradeCloseResult[] {
    return [...this.closedTrades];
  }

  isInEmergencyMode(): boolean {
    return this.isEmergencyMode;
  }

  // === PnL Calculations ===

  calculatePnL(trade: ActiveTrade, currentPrice: number): number {
    const priceDiff = currentPrice - trade.entryPrice;
    const pnlPercent = (priceDiff / trade.entryPrice) * 100;
    return trade.side === 'buy' ? pnlPercent : -pnlPercent;
  }

  calculateAbsolutePnL(trade: ActiveTrade, currentPrice: number): number {
    const priceDiff = currentPrice - trade.entryPrice;
    const pnlPerUnit = trade.side === 'buy' ? priceDiff : -priceDiff;
    return pnlPerUnit * trade.amount;
  }

  // === Trade Amount Calculation ===

  calculateTradeAmount(currentPrice: number): number {
    return this.config.tradeAmountUSDT / currentPrice;
  }

  // === TP/SL Calculation ===

  calculateTPSL(entryPrice: number, side: 'buy' | 'sell') {
    if (side === 'buy') {
      return {
        takeProfitPrice: entryPrice * (1 + this.config.takeProfitPercent / 100),
        stopLossPrice: entryPrice * (1 - this.config.stopLossPercent / 100)
      };
    } else {
      return {
        takeProfitPrice: entryPrice * (1 - this.config.takeProfitPercent / 100),
        stopLossPrice: entryPrice * (1 + this.config.stopLossPercent / 100)
      };
    }
  }

  // === Trade Opening ===

  openTrade(params: { strategy: string; entryPrice: number; side: 'buy' | 'sell'; }): ActiveTrade | null {
    const canOpen = this.canOpenTrade();
    if (!canOpen.allowed) return null;
    
    const { takeProfitPrice, stopLossPrice } = this.calculateTPSL(params.entryPrice, params.side);
    const amount = this.calculateTradeAmount(params.entryPrice);
    
    const trade: ActiveTrade = {
      id: `trade_${Date.now()}`,
      strategy: params.strategy,
      entryPrice: params.entryPrice,
      amount,
      side: params.side,
      timestamp: Date.now(),
      takeProfitPrice,
      stopLossPrice
    };
    
    this.activeTrades.push(trade);
    return trade;
  }

  // === Trade Exit Checks ===

  checkTradesForExit(currentPrice: number) {
    const tradesToClose: ActiveTrade[] = [];
    const reasons = new Map<string, 'TP' | 'SL'>();
    
    for (const trade of this.activeTrades) {
      if (trade.side === 'buy') {
        if (currentPrice >= trade.takeProfitPrice) { 
          tradesToClose.push(trade); 
          reasons.set(trade.id, 'TP'); 
        } else if (currentPrice <= trade.stopLossPrice) { 
          tradesToClose.push(trade); 
          reasons.set(trade.id, 'SL'); 
        }
      } else {
        if (currentPrice <= trade.takeProfitPrice) { 
          tradesToClose.push(trade); 
          reasons.set(trade.id, 'TP'); 
        } else if (currentPrice >= trade.stopLossPrice) { 
          tradesToClose.push(trade); 
          reasons.set(trade.id, 'SL'); 
        }
      }
    }
    
    return { tradesToClose, reasons };
  }

  // === Regular Trade Close ===

  closeTrade(tradeId: string, exitPrice?: number, reason: 'TP' | 'SL' | 'MANUAL' = 'MANUAL'): ActiveTrade | null {
    const index = this.activeTrades.findIndex(t => t.id === tradeId);
    if (index === -1) return null;
    
    const trade = this.activeTrades.splice(index, 1)[0];
    
    // Record closed trade with PnL
    if (exitPrice) {
      const pnl = this.calculateAbsolutePnL(trade, exitPrice);
      const pnlPercent = this.calculatePnL(trade, exitPrice);
      
      this.closedTrades.push({
        trade,
        exitPrice,
        pnl,
        pnlPercent,
        reason
      });
      
      // MEMORY LEAK FIX: Enforce hard cap - truncate oldest entries
      if (this.closedTrades.length > this.MAX_CLOSED_TRADES) {
        this.closedTrades = this.closedTrades.slice(-this.MAX_CLOSED_TRADES);
      }
    }
    
    return trade;
  }

  // === EMERGENCY PANIC BUTTON ===

  /**
   * Emergency Close All - Panic Button
   * Immediately closes all open positions at current market price.
   * Called by Watchdog when system health is compromised.
   */
  emergencyCloseAll(currentPrice: number): EmergencyCloseResult {
    console.warn('🚨 [PANIC BUTTON] Emergency close initiated');
    
    this.isEmergencyMode = true;
    
    const errors: string[] = [];
    let closedPositions = 0;
    let totalPnL = 0;
    
    // Close all active trades
    const tradesToClose = [...this.activeTrades];
    
    for (const trade of tradesToClose) {
      try {
        const pnl = this.calculateAbsolutePnL(trade, currentPrice);
        const pnlPercent = this.calculatePnL(trade, currentPrice);
        
        // Record the emergency close
        this.closedTrades.push({
          trade,
          exitPrice: currentPrice,
          pnl,
          pnlPercent,
          reason: 'EMERGENCY'
        });
        
        // MEMORY LEAK FIX: Enforce hard cap after each push
        if (this.closedTrades.length > this.MAX_CLOSED_TRADES) {
          this.closedTrades = this.closedTrades.slice(-this.MAX_CLOSED_TRADES);
        }
        
        totalPnL += pnl;
        closedPositions++;
        
        console.warn(`🚨 [EMERGENCY CLOSE] ${trade.strategy} ${trade.side.toUpperCase()} @ ${currentPrice} | PnL: $${pnl.toFixed(2)}`);
      } catch (error: any) {
        errors.push(`Failed to close ${trade.id}: ${error.message}`);
      }
    }
    
    // Clear all active trades
    this.activeTrades = [];
    
    const result: EmergencyCloseResult = {
      success: errors.length === 0,
      closedPositions,
      totalPnL,
      errors,
      timestamp: Date.now()
    };
    
    console.warn(`🚨 [PANIC BUTTON] Complete: ${closedPositions} positions closed, Total PnL: $${totalPnL.toFixed(2)}`);
    
    return result;
  }

  /**
   * Reset emergency mode - allows trading to resume
   */
  resetEmergencyMode(): void {
    this.isEmergencyMode = false;
    console.info('✅ [RISK] Emergency mode deactivated');
  }

  /**
   * Get emergency close summary for display
   */
  getEmergencySummary(): {
    isActive: boolean;
    lastCloses: TradeCloseResult[];
    totalEmergencyPnL: number;
  } {
    const emergencyCloses = this.closedTrades.filter(t => t.reason === 'EMERGENCY');
    const totalEmergencyPnL = emergencyCloses.reduce((sum, t) => sum + t.pnl, 0);
    
    return {
      isActive: this.isEmergencyMode,
      lastCloses: emergencyCloses.slice(-5),
      totalEmergencyPnL
    };
  }

  // === Statistics ===

  getTradingStats(): {
    activeCount: number;
    closedCount: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    totalPnL: number;
    emergencyCloseCount: number;
  } {
    const winTrades = this.closedTrades.filter(t => t.pnl > 0);
    const lossTrades = this.closedTrades.filter(t => t.pnl <= 0);
    const emergencyCloses = this.closedTrades.filter(t => t.reason === 'EMERGENCY');
    const totalPnL = this.closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = this.closedTrades.length > 0 
      ? (winTrades.length / this.closedTrades.length) * 100 
      : 0;
    
    return {
      activeCount: this.activeTrades.length,
      closedCount: this.closedTrades.length,
      winCount: winTrades.length,
      lossCount: lossTrades.length,
      winRate,
      totalPnL,
      emergencyCloseCount: emergencyCloses.length
    };
  }

  // === Reset ===

  reset(): void {
    this.activeTrades = [];
    this.closedTrades = [];
    this.isEmergencyMode = false;
    console.info('🔄 [RISK] Manager reset');
  }
}

export const riskManager = new RiskManager();
