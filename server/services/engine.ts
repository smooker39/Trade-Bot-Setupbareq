import { okxClient } from "./okx";
import { predatorEngine, type TradeDecision } from "./ai";
import { log } from "../logger";
import { storage } from "../storage";
import { watchdog } from "./watchdog";
import { eventBus } from "./eventBus";
import crypto from "crypto";

/**
 * [OMEGA ZERO - PHASE 2] - FIXED
 * ✅ إصلاحات:
 * - خفض حد الـ confidence من 70 إلى 60 لتفادي الانتظار الأبدي
 * - إضافة خاصية activePositions و totalTrades و totalProfit المطلوبة بـ routes
 * - إصلاح منطق السعر الحي: التحقق من صحة السعر قبل المقارنة
 */

const MIN_TRADE_USDT = 5.0;
const ATR_TP_MULTIPLIER = 2.0;
const ATR_SL_MULTIPLIER = 1.0;

export interface ActivePosition {
  id: string;
  symbol: string;
  side: "buy" | "sell";
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
  executionHash: string;
}

export class TradingEngine {
  public isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private symbol: string = "BTC/USDT";
  private checkInterval: number = 10000; // 10 ثوان

  public lastCheck: string = new Date().toISOString();
  public currentPrice: number = 0;
  public lastSignal: string = "hold";
  public lastDecision: TradeDecision | null = null;

  public allocationPercentage: number = 25;
  public maxConcurrentTrades: number = 2;

  // ✅ FIX: exposed as public for routes.ts /api/health
  public totalTrades: number = 0;
  public totalProfit: number = 0;

  private _activePositions: Map<string, ActivePosition> = new Map();
  private executionLock: boolean = false;

  // ✅ FIX: routes.ts يقرأ engine.activePositions كـ number
  get activePositions(): number {
    return this._activePositions.size;
  }

  async start() {
    if (this.isRunning) return;
    if (watchdog.isSafeMode()) {
      log.warn("🛡️ [OMEGA] Cannot start - Safe Mode active");
      return;
    }

    this.isRunning = true;
    log.info("🚀 [OMEGA] Predator Engine ACTIVATED");
    watchdog.heartbeat("ENGINE_START");

    await this.restoreState();
    // ✅ ابدأ الدورة مباشرة بدون انتظار
    this.runCycle();
    this.intervalId = setInterval(() => this.runCycle(), this.checkInterval);

    watchdog.registerRecoveryCallbacks({
      onInternalRestart: async () => await this.internalRestart(),
      onFullInitialization: async () => await this.fullInitialization(),
      onAdminNotification: async (msg) =>
        await storage.createLog({ level: "error", message: `[ADMIN] ${msg}` }),
      onEmergencyClose: async () => {
        const result = await okxClient.emergencyCloseAllPositions();
        this._activePositions.clear();
        return result;
      },
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
    await new Promise((r) => setTimeout(r, 2000));
    await this.start();
  }

  private async fullInitialization(): Promise<void> {
    this.stop();
    await okxClient.reinitialize();
    await new Promise((r) => setTimeout(r, 3000));
    await this.start();
  }

  private generateExecutionHash(
    decision: TradeDecision,
    price: number
  ): string {
    const payload = `${decision.strategy}-${decision.action}-${price}-${Date.now()}`;
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  private async restoreState() {
    try {
      const state = await storage.loadState();
      this.maxConcurrentTrades = Math.min(
        5,
        Math.max(1, state.maxConcurrentTrades || 2)
      );
      this.allocationPercentage = Math.min(
        100,
        Math.max(1, state.allocationPercentage || 25)
      );

      const trades = await storage.getTrades();
      this.totalTrades = trades.length;

      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      for (const trade of trades.slice(0, 10)) {
        const tradeTime = new Date(
          trade.createdAt || Date.now()
        ).getTime();
        if (tradeTime > oneHourAgo && trade.side === "buy") {
          const entryPrice = parseFloat(trade.price);
          const amount = parseFloat(trade.amount);
          const positionId = `restored_${trade.id}`;

          this._activePositions.set(positionId, {
            id: positionId,
            symbol: trade.symbol,
            side: trade.side as "buy" | "sell",
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
            executionHash: "RESTORED",
          });
        }
      }

      log.info(
        `✅ [OMEGA] State restored: ${this._activePositions.size} active positions, ${this.totalTrades} total trades`
      );
    } catch (error) {
      log.error(`❌ [OMEGA] State restore failed: ${error}`);
    }
  }

  private async closePosition(
    positionId: string,
    reason: string,
    exitPrice: number
  ): Promise<void> {
    const position = this._activePositions.get(positionId);
    if (!position) return;

    if (this.executionLock) return;
    this.executionLock = true;

    try {
      log.info(
        `🔒 [OMEGA-CLOSE] ${position.strategy} | ${reason} | Price: $${exitPrice}`
      );

      if (position.stopLossOrderId) {
        await okxClient.cancelOrder(position.symbol, position.stopLossOrderId);
      }

      await okxClient.executeTrade({
        symbol: position.symbol,
        side: position.side === "buy" ? "sell" : "buy",
        amount: position.amount,
        strategy: `CLOSE_${position.strategy}`,
      });

      // ✅ حساب الربح/الخسارة
      const pnl =
        position.side === "buy"
          ? (exitPrice - position.entryPrice) * position.amount
          : (position.entryPrice - exitPrice) * position.amount;
      this.totalProfit += pnl;

      this._activePositions.delete(positionId);
      eventBus.emitPositionClosed({ id: positionId, pnl, reason });
      watchdog.heartbeat("POSITION_CLOSE");

      log.info(
        `💰 [PnL] Position ${positionId} closed. PnL: $${pnl.toFixed(4)}`
      );
    } catch (error) {
      log.error(`❌ [OMEGA] Close failed: ${error}`);
    } finally {
      this.executionLock = false;
    }
  }

  private async runCycle() {
    if (!this.isRunning || watchdog.isSafeMode()) return;
    watchdog.heartbeat("CYCLE_START");
    this.lastCheck = new Date().toISOString();

    try {
      // ✅ FIX: جلب السعر الحي أولاً والتحقق من صحته
      const ticker = await okxClient.fetchTicker(this.symbol);
      if (!ticker || !ticker.last || ticker.last <= 0) {
        log.warn("⚠️ [CYCLE] Invalid price from ticker, skipping cycle");
        return;
      }
      this.currentPrice = ticker.last;
      predatorEngine.addPrice(this.currentPrice);

      // جلب الرصيد
      const balanceData = await okxClient.fetchBalance();
      const usdtBalance = balanceData["USDT"] || 0;
      const btcBalance = balanceData["BTC"] || 0;

      // إرسال تحديث الرصيد للواجهة
      eventBus.emitBalanceUpdate({
        usdt: usdtBalance,
        btc: btcBalance,
        timestamp: Date.now(),
      });

      // مراقبة المراكز المفتوحة
      for (const pos of Array.from(this._activePositions.values())) {
        if (pos.side === "buy") {
          if (this.currentPrice >= pos.takeProfitPrice)
            await this.closePosition(pos.id, "TP_HIT", this.currentPrice);
          else if (this.currentPrice <= pos.stopLossPrice)
            await this.closePosition(pos.id, "SL_INTERNAL", this.currentPrice);
        }
      }

      // الحصول على إشارة المحرك
      const decision = predatorEngine.getSignal();
      this.lastDecision = decision;
      this.lastSignal = decision.action;

      log.info(
        `📊 [CYCLE] Price: $${this.currentPrice} | Signal: ${decision.action} | Confidence: ${decision.confidence}% | Balance: $${usdtBalance.toFixed(2)}`
      );

      // ✅ FIX: خفض حد الـ confidence إلى 60 بدل 70 لضمان الدخول
      // ✅ FIX: التحقق من الرصيد الحقيقي >= MIN_TRADE_USDT
      if (
        usdtBalance >= MIN_TRADE_USDT &&
        decision.action !== "hold" &&
        decision.confidence >= 60
      ) {
        log.info(
          `🎯 [PREDATOR] Signal confirmed: ${decision.action.toUpperCase()} | Confidence: ${decision.confidence}% | Balance: $${usdtBalance}`
        );
        await this.executeTrade(decision);
      }

      watchdog.heartbeat("CYCLE_COMPLETE");
    } catch (error) {
      log.error(`❌ [OMEGA-CYCLE] Error: ${error}`);
    }
  }

  private async executeTrade(decision: TradeDecision) {
    if (this.executionLock) {
      log.warn("⚠️ [OMEGA] Execution Lock Active - Skipping");
      return;
    }
    this.executionLock = true;

    try {
      if (this._activePositions.size >= this.maxConcurrentTrades) {
        log.info(
          `⚠️ [OMEGA] Max concurrent trades (${this.maxConcurrentTrades}) reached`
        );
        return;
      }

      const balanceData = await okxClient.fetchBalance();
      const freeBalance = balanceData["USDT"] || 0;
      let tradeAmountUSDT = (freeBalance * this.allocationPercentage) / 100;

      if (tradeAmountUSDT < MIN_TRADE_USDT) {
        log.warn(
          `⚠️ [OMEGA] Trade amount $${tradeAmountUSDT.toFixed(2)} < minimum $${MIN_TRADE_USDT}`
        );
        return;
      }

      // ✅ FIX: التحقق من أن السعر الحالي ليس صفراً قبل القسمة
      if (this.currentPrice <= 0) {
        log.warn("⚠️ [OMEGA] Current price is 0, cannot execute trade");
        return;
      }

      const finalQty = okxClient.roundToLotStep(
        tradeAmountUSDT / this.currentPrice,
        this.symbol
      );
      const hash = this.generateExecutionHash(decision, this.currentPrice);

      log.info(
        `🎯 [OMEGA-EXEC] ${decision.action.toUpperCase()} | Qty: ${finalQty} | Price: $${this.currentPrice} | Hash: ${hash.substring(0, 8)}`
      );

      const result = await okxClient.executeTrade({
        symbol: this.symbol,
        side: decision.action as "buy" | "sell",
        amount: finalQty,
        strategy: decision.strategy,
      });

      if (result.success) {
        const posId = `pos_${Date.now()}`;
        const slPrice =
          decision.action === "buy"
            ? this.currentPrice * 0.99
            : this.currentPrice * 1.01;
        const tpPrice =
          decision.action === "buy"
            ? this.currentPrice * 1.02
            : this.currentPrice * 0.98;

        const position: ActivePosition = {
          id: posId,
          symbol: this.symbol,
          side: decision.action as "buy" | "sell",
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
          executionHash: hash,
        };

        // ✅ وضع Stop-Loss على البورصة
        try {
          const slResult = await okxClient.createStopLossOrder(
            this.symbol,
            decision.action === "buy" ? "sell" : "buy",
            finalQty,
            slPrice
          );
          position.stopLossOrderId = slResult.id;
          log.info(`🛡️ [OMEGA] Exchange SL Armed: ${slResult.id}`);
        } catch (slError) {
          log.error(
            `❌ [OMEGA] SL placement failed. Emergency closing position.`
          );
          await okxClient.executeTrade({
            symbol: this.symbol,
            side: decision.action === "buy" ? "sell" : "buy",
            amount: finalQty,
            strategy: "EMERGENCY_EXIT_NO_SL",
          });
          return;
        }

        this._activePositions.set(posId, position);
        this.totalTrades++;
        predatorEngine.setEntry(this.currentPrice);

        // ✅ حفظ الصفقة في قاعدة البيانات فوراً
        await storage.createTrade({
          symbol: this.symbol,
          side: decision.action,
          price: this.currentPrice.toString(),
          amount: finalQty.toString(),
          cost: tradeAmountUSDT.toString(),
          strategy: decision.strategy,
        });

        log.info(
          `✅ [TRADE SAVED] ${decision.action.toUpperCase()} ${finalQty} ${this.symbol} @ $${this.currentPrice}`
        );
      }
    } catch (error) {
      log.error(`❌ [OMEGA] Execution failed: ${error}`);
    } finally {
      this.executionLock = false;
    }
  }

  public setAllocationPercentage(p: number) {
    this.allocationPercentage = p;
  }
  public getAllocationPercentage(): number {
    return this.allocationPercentage;
  }
  public getMaxConcurrentTrades(): number {
    return this.maxConcurrentTrades;
  }
  public updateMaxConcurrentTrades(v: number) {
    this.maxConcurrentTrades = v;
  }
  public canOpenNewPosition(): boolean {
    return this._activePositions.size < this.maxConcurrentTrades;
  }
}

export const engine = new TradingEngine();