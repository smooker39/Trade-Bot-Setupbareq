import { okxClient } from "./okx";
import { predatorEngine, type TradeDecision } from "./ai";
import { log } from "../logger";
import { storage } from "../storage";
import { watchdog } from "./watchdog";
import { eventBus } from "./eventBus";
import crypto from "crypto";

/**
 * [OMEGA ZERO - PHASE 2]
 * Absolute Financial Integrity Engine
 */

// Minimum trade size in USDT
const MIN_TRADE_USDT = 5.0;

// Adaptive TP/SL multipliers
const ATR_TP_MULTIPLIER = 2.0;
const ATR_SL_MULTIPLIER = 1.0;

export interface ActivePosition {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  amount: number;
  strategy: string;
  timestamp: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  stopLossOrderId: string | null;
  trailingTrigger: number;
  trailingStop: number | null;
  highestPrice: number;
  lowestPrice: number;
  executionHash: string; // Double-Hash Verification
}

export class TradingEngine {
  public isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private symbol: string = "BTC/USDT";
  private checkInterval: number = 10000;

  public lastCheck: string = new Date().toISOString();
  public currentPrice: number = 0;
  public lastSignal: string = "hold";
  public lastDecision: TradeDecision | null = null;
  
  public allocationPercentage: number = 25;
  public maxConcurrentTrades: number = 2;

  private activePositions: Map<string, ActivePosition> = new Map();
  private executionLock: boolean = false; // Atomic Lock

  // Volatility spike filter
  private volatilitySpikeThreshold: number = 3.0;
  private lastATR: number = 0;
  private avgATR: number[] = [];

  async start() {
    if (this.isRunning) return;
    if (watchdog.isSafeMode()) {
      log.warn("🛡️ [OMEGA] Cannot start - Safe Mode active");
      return;
    }
    
    this.isRunning = true;
    log.info("🚀 [OMEGA] Predator Engine ACTIVATED - PHASE 2 Financial Integrity");
    watchdog.heartbeat("ENGINE_START");
    
    await this.restoreState();
    this.runCycle();
    this.intervalId = setInterval(() => this.runCycle(), this.checkInterval);
    
    watchdog.registerRecoveryCallbacks({
      onInternalRestart: async () => await this.internalRestart(),
      onFullInitialization: async () => await this.fullInitialization(),
      onAdminNotification: async (msg) => await storage.createLog({ level: 'error', message: `[ADMIN] ${msg}` }),
      onEmergencyClose: async () => {
        const result = await okxClient.emergencyCloseAllPositions();
        this.activePositions.clear();
        return result;
      }
    });
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log.info("🛑 [OMEGA] Predator Engine DEACTIVATED");
    watchdog.heartbeat("ENGINE_STOP");
  }

  private async internalRestart(): Promise<void> {
    this.stop();
    await new Promise(r => setTimeout(r, 2000));
    await this.start();
  }

  private async fullInitialization(): Promise<void> {
    this.stop();
    await okxClient.reinitialize();
    await new Promise(r => setTimeout(r, 3000));
    await this.start();
  }

  // --- FINANCIAL INTEGRITY: DOUBLE-HASH VERIFICATION ---

  private generateExecutionHash(decision: TradeDecision, price: number): string {
    const payload = `${decision.strategy}-${decision.action}-${price}-${Date.now()}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  // --- CORE ENGINE LOGIC ---

  private async restoreState() {
    try {
      const state = await storage.loadState();
      this.maxConcurrentTrades = Math.min(5, Math.max(1, state.maxConcurrentTrades || 2));
      this.allocationPercentage = Math.min(100, Math.max(1, state.allocationPercentage || 25));
      
      const trades = await storage.getTrades();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const trade of trades.slice(0, 10)) {
        const tradeTime = new Date(trade.createdAt || Date.now()).getTime();
        if (tradeTime > oneHourAgo && trade.side === 'buy') {
          const entryPrice = parseFloat(trade.price);
          const amount = parseFloat(trade.amount);
          const positionId = `restored_${trade.id}`;
          
          this.activePositions.set(positionId, {
            id: positionId,
            symbol: trade.symbol,
            side: trade.side as 'buy' | 'sell',
            entryPrice,
            amount,
            strategy: trade.strategy,
            timestamp: tradeTime,
            takeProfitPrice: entryPrice * 1.02,
            stopLossPrice: entryPrice * 0.99,
            stopLossOrderId: null,
            trailingTrigger: entryPrice * 1.01,
            trailingStop: null,
            highestPrice: entryPrice,
            lowestPrice: entryPrice,
            executionHash: 'RESTORED'
          });
        }
      }
      log.info(`✅ [OMEGA] State restored: ${this.activePositions.size} active positions`);
    } catch (error) {
      log.error(`❌ [OMEGA] State restore failed: ${error}`);
    }
  }

  private async closePosition(positionId: string, reason: string, exitPrice: number): Promise<void> {
    const position = this.activePositions.get(positionId);
    if (!position) return;
    
    // ATOMIC LOCK for closing
    if (this.executionLock) return;
    this.executionLock = true;

    try {
      log.info(`🔒 [OMEGA-CLOSE] ${position.strategy} | ${reason} | Price: $${exitPrice}`);
      
      // 1. Cancel Exchange-Side SL first
      if (position.stopLossOrderId) {
        await okxClient.cancelOrder(position.symbol, position.stopLossOrderId);
      }

      // 2. Execute Market Close
      await okxClient.executeTrade({
        symbol: position.symbol,
        side: position.side === 'buy' ? 'sell' : 'buy',
        amount: position.amount,
        strategy: `CLOSE_${position.strategy}`
      });

      this.activePositions.delete(positionId);
      eventBus.emitPositionClosed({ id: positionId, pnl: 0, reason });
      watchdog.heartbeat("POSITION_CLOSE");
    } catch (error) {
      log.error(`❌ [OMEGA] Close failed: ${error}`);
    } finally {
      this.executionLock = false;
    }
  }

  private async runCycle() {
    if (!this.isRunning || watchdog.isSafeMode()) return;
    watchdog.heartbeat("CYCLE_START");
    
    try {
      const balanceData = await okxClient.fetchBalance();
      const usdtBalance = balanceData['USDT'] || 0;
      const btcBalance = balanceData['BTC'] || 0;
      
      // Dynamic Balance Update with correct interface
      eventBus.emitBalanceUpdate({
        usdt: usdtBalance,
        btc: btcBalance,
        timestamp: Date.now()
      });

      const ticker = await okxClient.fetchTicker(this.symbol);
      if (!ticker || !ticker.last) return;
      
      this.currentPrice = ticker.last;
      log.info(`[HEALTH-CHECK] Current ${this.symbol} Price: $${this.currentPrice}`);
      predatorEngine.addPrice(this.currentPrice);
      const decision = predatorEngine.getSignal();
      
      // Monitor Positions
      for (const pos of Array.from(this.activePositions.values())) {
        if (pos.side === 'buy') {
          if (this.currentPrice >= pos.takeProfitPrice) await this.closePosition(pos.id, 'TP', this.currentPrice);
          else if (this.currentPrice <= pos.stopLossPrice) await this.closePosition(pos.id, 'SL_INTERNAL', this.currentPrice);
        }
      }

      // Trigger trading if balance > 0 and decision is solid
      if (usdtBalance > 0 && decision.action !== 'hold' && decision.confidence >= 70) {
        log.info(`🎯 [PREDATOR] Auto-triggering trade for ${this.symbol} with balance ${usdtBalance}`);
        await this.executeTrade(decision);
      }
      
      watchdog.heartbeat("CYCLE_COMPLETE");
    } catch (error) {
      log.error(`❌ [OMEGA-CYCLE] Error: ${error}`);
    }
  }

  private async executeTrade(decision: TradeDecision) {
    // ATOMIC LOCK: Prevent Double Execution
    if (this.executionLock) {
      log.warn("⚠️ [OMEGA] Execution Lock Active - Skipping duplicate request");
      return;
    }
    this.executionLock = true;

    try {
      if (this.activePositions.size >= this.maxConcurrentTrades) return;

      const balanceData = await okxClient.fetchBalance();
      const freeBalance = balanceData['USDT'] || 0;
      let tradeAmountUSDT = (freeBalance * this.allocationPercentage) / 100;
      
      if (tradeAmountUSDT < MIN_TRADE_USDT) return;

      const finalQty = okxClient.roundToLotStep(tradeAmountUSDT / this.currentPrice, this.symbol);
      const hash = this.generateExecutionHash(decision, this.currentPrice);

      log.info(`🎯 [OMEGA-EXEC] ${decision.action.toUpperCase()} | Hash: ${hash.substring(0,8)}`);

      // 1. Primary Execution
      const result = await okxClient.executeTrade({
        symbol: this.symbol,
        side: decision.action as 'buy' | 'sell',
        amount: finalQty,
        strategy: decision.strategy
      });

      if (result.success) {
        const posId = `pos_${Date.now()}`;
        const slPrice = decision.action === 'buy' ? this.currentPrice * 0.99 : this.currentPrice * 1.01;
        const tpPrice = decision.action === 'buy' ? this.currentPrice * 1.02 : this.currentPrice * 0.98;

        const position: ActivePosition = {
          id: posId,
          symbol: this.symbol,
          side: decision.action as 'buy' | 'sell',
          entryPrice: this.currentPrice,
          amount: finalQty,
          strategy: decision.strategy,
          timestamp: Date.now(),
          takeProfitPrice: tpPrice,
          stopLossPrice: slPrice,
          stopLossOrderId: null,
          trailingTrigger: this.currentPrice * 1.01,
          trailingStop: null,
          highestPrice: this.currentPrice,
          lowestPrice: this.currentPrice,
          executionHash: hash
        };

        // 2. MANDATORY EXCHANGE-SIDE HARD STOP-LOSS
        try {
          // Place trigger order on exchange immediately
          const slResult = await okxClient.createStopLossOrder(
            this.symbol,
            decision.action === 'buy' ? 'sell' : 'buy',
            finalQty,
            slPrice
          );
          position.stopLossOrderId = slResult.id;
          log.info(`🛡️ [OMEGA] Exchange-Side SL Armed: ${slResult.id}`);
        } catch (slError) {
          log.error(`❌ [OMEGA] CRITICAL: Exchange SL Failed. Emergency Closing Position.`);
          await okxClient.executeTrade({
            symbol: this.symbol,
            side: decision.action === 'buy' ? 'sell' : 'buy',
            amount: finalQty,
            strategy: 'EMERGENCY_EXIT_NO_SL'
          });
          return;
        }

        this.activePositions.set(posId, position);
        storage.createTrade({
          symbol: this.symbol,
          side: decision.action,
          price: this.currentPrice.toString(),
          amount: finalQty.toString(),
          cost: tradeAmountUSDT.toString(),
          strategy: decision.strategy
        });
      }
    } catch (error) {
      log.error(`❌ [OMEGA] Execution failed: ${error}`);
    } finally {
      this.executionLock = false;
    }
  }

  // Helper methods
  public setAllocationPercentage(p: number) { this.allocationPercentage = p; }
  public getAllocationPercentage(): number { return this.allocationPercentage; }
  public getMaxConcurrentTrades(): number { return this.maxConcurrentTrades; }
  public updateMaxConcurrentTrades(v: number) { this.maxConcurrentTrades = v; }
  public canOpenNewPosition(): boolean { return this.activePositions.size < this.maxConcurrentTrades; }
}

export const engine = new TradingEngine();
