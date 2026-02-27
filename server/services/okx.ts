import ccxt, { type okx } from "ccxt";
import { log } from "../logger";
import { storage } from "../storage";
import { watchdog } from "./watchdog";
import { encryptionService } from "./encryption";

/**
 * [OMEGA ZERO - PRO VERSION 2026] - FIXED
 * ✅ أضفنا الدوال المفقودة: executeTrade, cancelOrder, createStopLossOrder,
 *    roundToLotStep, cleanCredentials, emergencyCloseAllPositions
 */

export class OKXClient {
  private exchange: okx | null = null;
  public isMock: boolean = false;

  // ✅ تنظيف صارم للمفاتيح من أي فراغات أو رموز مخفية
  private clean(val: string | undefined): string {
    return (val || "").trim().replace(/[\u200b-\u200d\ufeff]/g, "");
  }

  // ✅ دالة عامة لتنظيف credentials مستخدمة في routes.ts
  cleanCredentials(apiKey: string, secret: string, passphrase: string) {
    return {
      apiKey: this.clean(apiKey),
      secret: this.clean(secret),
      passphrase: this.clean(passphrase),
    };
  }

  async initialize(): Promise<void> {
    try {
      // 1. القراءة من Environment Variables أولاً
      let apiKey = this.clean(process.env.OKX_API_KEY);
      let secret = this.clean(process.env.OKX_API_SECRET);
      let passphrase = this.clean(process.env.OKX_PASSPHRASE);

      // 2. الرجوع لقاعدة البيانات إن لم تكن ENV موجودة
      if (!apiKey || !secret || !passphrase) {
        const user = await storage.getUser();
        if (user) {
          apiKey = this.clean(
            encryptionService.isConfigured()
              ? encryptionService.decrypt(user.okxApiKey)
              : user.okxApiKey
          );
          secret = this.clean(
            encryptionService.isConfigured()
              ? encryptionService.decrypt(user.okxSecret)
              : user.okxSecret
          );
          passphrase = this.clean(
            encryptionService.isConfigured()
              ? encryptionService.decrypt(user.okxPassword)
              : user.okxPassword
          );
        }
      }

      if (!apiKey || !secret || !passphrase) {
        throw new Error("OKX credentials not found in environment or database");
      }

      this.exchange = new ccxt.okx({
        apiKey,
        secret,
        password: passphrase,
        enableRateLimit: true,
        options: {
          defaultType: "spot",
          adjustForTimeDifference: true,
          recvWindow: 10000,
        },
      });

      // انتظر قبل الاختبار لتجنب خطأ 50119
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await this.exchange.fetchTime();
      this.isMock = false;
      log.info("🚀 [REAL-MODE] ✅ OKX متصل ويعمل بشكل حقيقي");
    } catch (error: any) {
      this.isMock = true;
      log.error(`❌ [OKX-INIT] فشل الاتصال: ${error.message}`);
    }
    watchdog.heartbeat("OKX_INIT");
  }

  async fetchBalance(): Promise<Record<string, number>> {
    if (!this.exchange || this.isMock) {
      return { USDT: 0, STATUS: 0 };
    }
    try {
      const balance = await this.exchange.fetchBalance();
      const result: Record<string, number> = {};
      if (balance?.total) {
        Object.entries(balance.total).forEach(([coin, amount]) => {
          if (typeof amount === "number" && amount > 0) result[coin] = amount;
        });
      }
      return result;
    } catch (error: any) {
      log.warn(`⚠️ [BALANCE] ${error.message}`);
      return { USDT: 0, SYNCING: 1 };
    }
  }

  async fetchTicker(symbol: string): Promise<{ last: number }> {
    if (!this.exchange || this.isMock) return { last: 0 };
    try {
      const t = await this.exchange.fetchTicker(symbol);
      return { last: t.last || 0 };
    } catch {
      return { last: 0 };
    }
  }

  // ✅ FIX: دالة تنفيذ الصفقات (كانت مفقودة)
  async executeTrade(params: {
    symbol: string;
    side: "buy" | "sell";
    amount: number;
    strategy: string;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> {
    if (!this.exchange || this.isMock) {
      log.warn(`🤖 [MOCK-TRADE] ${params.side.toUpperCase()} ${params.amount} ${params.symbol}`);
      return { success: true, orderId: `mock_${Date.now()}` };
    }
    try {
      const order = await this.exchange.createMarketOrder(
        params.symbol,
        params.side,
        params.amount
      );
      log.info(
        `✅ [TRADE-EXEC] ${params.side.toUpperCase()} ${params.amount} ${params.symbol} | OrderID: ${order.id}`
      );
      return { success: true, orderId: order.id };
    } catch (error: any) {
      log.error(`❌ [TRADE-EXEC] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ✅ FIX: إلغاء أمر (كان مفقوداً)
  async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
    if (!this.exchange || this.isMock) return true;
    try {
      await this.exchange.cancelOrder(orderId, symbol);
      log.info(`🔕 [CANCEL] Order ${orderId} cancelled`);
      return true;
    } catch (error: any) {
      log.warn(`⚠️ [CANCEL] Failed to cancel ${orderId}: ${error.message}`);
      return false;
    }
  }

  // ✅ FIX: وضع Stop-Loss على البورصة (كان مفقوداً)
  async createStopLossOrder(
    symbol: string,
    side: "buy" | "sell",
    amount: number,
    stopPrice: number
  ): Promise<{ id: string }> {
    if (!this.exchange || this.isMock) {
      return { id: `mock_sl_${Date.now()}` };
    }
    try {
      const order = await this.exchange.createOrder(
        symbol,
        "stop_market" as any,
        side,
        amount,
        undefined,
        { stopLossPrice: stopPrice, triggerPrice: stopPrice }
      );
      log.info(`🛡️ [SL-ORDER] ${side} SL placed at $${stopPrice} | ID: ${order.id}`);
      return { id: order.id };
    } catch (error: any) {
      log.error(`❌ [SL-ORDER] Failed: ${error.message}`);
      throw error;
    }
  }

  // ✅ FIX: تدوير الكمية وفق lot size (كانت مفقودة)
  roundToLotStep(qty: number, symbol: string): number {
    // OKX BTC/USDT minimum lot: 0.00001 BTC
    const precision = symbol.includes("BTC") ? 5 : 4;
    return parseFloat(qty.toFixed(precision));
  }

  // ✅ FIX: إغلاق طارئ لكل المراكز (كانت مفقودة)
  async emergencyCloseAllPositions(): Promise<boolean> {
    if (!this.exchange || this.isMock) return true;
    try {
      const positions = await this.exchange.fetchPositions();
      for (const pos of positions) {
        if (pos.contracts && pos.contracts > 0) {
          await this.exchange.createMarketOrder(
            pos.symbol,
            pos.side === "long" ? "sell" : "buy",
            Math.abs(pos.contracts)
          );
        }
      }
      log.info("🚨 [EMERGENCY] All positions closed");
      return true;
    } catch (error: any) {
      log.error(`❌ [EMERGENCY] Failed: ${error.message}`);
      return false;
    }
  }

  async testConnection(apiKey: string, secret: string, passphrase: string) {
    const testExchange = new ccxt.okx({
      apiKey: this.clean(apiKey),
      secret: this.clean(secret),
      password: this.clean(passphrase),
      timeout: 15000,
    });
    try {
      await testExchange.fetchBalance();
      return { success: true, message: "Verified" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  isRealMode(): boolean {
    return !this.isMock;
  }

  async reinitialize() {
    this.exchange = null;
    this.isMock = false;
    await this.initialize();
  }
}

export const okxClient = new OKXClient();