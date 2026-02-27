import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { engine } from "./services/engine";
import { okxClient } from "./services/okx";
import { encryptionService } from "./services/encryption";
import { z } from "zod";
import { log } from "./logger";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // 1. تشغيل المحرك بهدوء: منع توقف السيرفر إذا كانت المفاتيح قيد التحديث
  await okxClient.initialize().catch(err => log.error(`[INIT] OKX Startup Wait: ${err.message}`));
  
  // التشغيل التلقائي للمحرك إذا كان المستخدم مخزناً
  const user = await storage.getUser();
  if (user) {
    const { watchdog } = await import("./services/watchdog");
    watchdog.setActiveUser(user.id);
    engine.start();
  }

  // === AUTH ROUTES ===
  app.get(api.auth.check.path, async (req, res) => {
    const user = await storage.getUser();
    // السماح بالدخول إذا وجد مستخدم أو إذا كانت Secrets موجودة (لخدمة الـ APK)
    const hasSecrets = !!(process.env.OKX_API_KEY && process.env.OKX_PASSPHRASE);
    res.json({ hasCredentials: !!user || hasSecrets });
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      log.info(`[AUTH] Login attempt received.`);
      const input = api.auth.login.input.parse(req.body);
      const cleanedCreds = okxClient.cleanCredentials(input.okxApiKey, input.okxSecret, input.okxPassword);
      
      const testResult = await okxClient.testConnection(cleanedCreds.apiKey, cleanedCreds.secret, cleanedCreds.passphrase);
      if (!testResult.success) return res.status(400).json({ success: false, message: testResult.message });

      let encryptedApiKey = cleanedCreds.apiKey, encryptedSecret = cleanedCreds.secret, encryptedPassphrase = cleanedCreds.passphrase;
      if (encryptionService.isConfigured()) {
        encryptedApiKey = encryptionService.encrypt(cleanedCreds.apiKey);
        encryptedSecret = encryptionService.encrypt(cleanedCreds.secret);
        encryptedPassphrase = encryptionService.encrypt(cleanedCreds.passphrase);
        log.info("🔐 [SECURITY] API keys encrypted with AES-256-GCM");
      }

      await storage.createOrUpdateUser({ okxApiKey: encryptedApiKey, okxSecret: encryptedSecret, okxPassword: encryptedPassphrase });
      await okxClient.reinitialize();
      
      const savedUser = await storage.getUser();
      if (savedUser) {
        const { watchdog } = await import("./services/watchdog");
        watchdog.setActiveUser(savedUser.id);
      }
      engine.start();
      res.json({ success: true, message: "Connection Verified" });
    } catch (err) {
      log.error(`Login error: ${err}`);
      res.status(400).json({ success: false, message: 'Failed to process credentials' });
    }
  });

  app.post(api.auth.logout.path, async (req, res) => {
    const { watchdog } = await import("./services/watchdog");
    watchdog.clearActiveUser();
    await storage.deleteUser();
    engine.stop();
    await okxClient.reinitialize();
    res.clearCookie("session", { path: "/" });
    res.json({ success: true });
  });

  // === STATUS & HEALTH ROUTES ===
  app.get("/api/health", async (_req, res) => {
    try {
      const balance = await okxClient.fetchBalance().catch(() => ({ USDT: 0, BTC: 0 }));
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        balance: balance,
        isRunning: engine.isRunning,
        currentPrice: engine.currentPrice || 0,
        lastSignal: engine.lastSignal || 'hold',
        activePositions: engine.activePositions || 0,
        totalTrades: engine.totalTrades || 0,
        totalProfit: engine.totalProfit || 0
      });
    } catch(e) {
      res.json({ status: "OK", balance: {USDT:0,BTC:0}, isRunning: false });
    }
  });

  // === SYSTEM STATUS (Watchdog & Metrics) ===
  app.get("/api/system/status", async (req, res) => {
    const { watchdog } = await import("./services/watchdog");
    const metrics = watchdog.getMetrics();
    const health = watchdog.getHealth();
    res.json({
      health,
      safeMode: watchdog.isSafeMode(),
      uptime: watchdog.getUptimeFormatted(),
      telegramConfigured: watchdog.isTelegramConfigured(),
      encryptionConfigured: encryptionService.isConfigured(),
      metrics: { cpu: metrics.cpuUsage, memory: metrics.memoryUsage, apiLatency: metrics.apiLatency }
    });
  });

  // === MARKET DATA (Tickers) ===
  app.get("/api/market/tickers", async (req, res) => {
    try {
      const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
      const data = await response.json();
      const symbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT'];
      const tickers = data.data.filter((t: any) => symbols.includes(t.instId)).map((t: any) => ({
        symbol: t.instId, price: parseFloat(t.last), volume24h: parseFloat(t.volCcy24h)
      }));
      res.json({ tickers });
    } catch (err) { res.status(500).json({ error: 'Market data failed' }); }
  });

  // === RISK & TELEGRAM SETTINGS ===
  app.get("/api/settings/risk", async (req, res) => {
    const state = await storage.loadState();
    res.json({ maxConcurrentTrades: state.maxConcurrentTrades ?? 2, allocationPercentage: state.allocationPercentage ?? 25 });
  });

  app.post("/api/settings/risk", async (req, res) => {
    const parsed = z.object({ maxConcurrentTrades: z.number().optional(), allocationPercentage: z.number().optional() }).parse(req.body);
    const state = await storage.loadState();
    if (parsed.maxConcurrentTrades) engine.updateMaxConcurrentTrades(parsed.maxConcurrentTrades);
    await storage.saveState({ ...state, ...parsed });
    res.json({ success: true });
  });

  // [ملاحظة: مسارات Telegram و Trades و Logs تعمل تلقائياً مع بقية أجزاء النظام]
  app.get(api.trades.list.path, async (req, res) => res.json(await storage.getTrades()));
  app.get(api.logs.list.path, async (req, res) => res.json(await storage.getLogs(100)));

  return httpServer;
}
