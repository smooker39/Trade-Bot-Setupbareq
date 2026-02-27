import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { log as winstonLog } from "./logger";
import { watchdog } from "./services/watchdog";
import { engine } from "./services/engine";
import { okxClient } from "./services/okx";
import { autoSetup } from "./autoSetup";

export interface ExecutionContract {
  id: string;
  module: string;
  status: "ACTIVE" | "ISOLATED" | "CIRCUIT_OPEN";
  latencyPattern: number[];
  failureCount: number;
}

const MODULE_REGISTRY = new Map<string, ExecutionContract>();

["TRADING_ENGINE", "EXCHANGE_CLIENT", "WATCHDOG", "EXPRESS_CORE"].forEach(
  (name) => {
    MODULE_REGISTRY.set(name, {
      id: `mod-${Date.now()}-${name}`,
      module: name,
      status: "ACTIVE",
      latencyPattern: [],
      failureCount: 0,
    });
  }
);

function categorizeError(error: Error): "MINOR" | "MODERATE" | "CRITICAL" {
  const msg = error.message.toLowerCase();
  if (msg.includes("fatal") || msg.includes("heap") || msg.includes("memory"))
    return "CRITICAL";
  if (
    msg.includes("timeout") ||
    msg.includes("connection") ||
    msg.includes("econnrefused")
  )
    return "MODERATE";
  return "MINOR";
}

async function handleFailure(module: string, error: Error) {
  const contract = MODULE_REGISTRY.get(module);
  if (!contract) return;
  contract.failureCount++;
  winstonLog.error(
    `⚠️ [FAULT] ${module} failure #${contract.failureCount}: ${error.message}`
  );
}

async function performSafeRestart(reason: string): Promise<void> {
  winstonLog.error(`🔄 [SAFE RESTART] Initiating: ${reason}`);
  try {
    engine.stop();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await okxClient.reinitialize();
    await engine.start();
    winstonLog.info("✅ [SAFE RESTART] Complete");
  } catch (e) {
    winstonLog.error(`❌ [SAFE RESTART] Failed: ${e}`);
    watchdog.enterSafeMode(`Safe restart failed: ${reason}`);
  }
}

process.on("uncaughtException", async (error: Error) => {
  winstonLog.error(`🚨 [UNCAUGHT EXCEPTION] ${error.message}`);
  await handleFailure("EXPRESS_CORE", error);
  if (categorizeError(error) === "CRITICAL") {
    await performSafeRestart(`Critical uncaught exception: ${error.message}`);
  }
});

process.on("unhandledRejection", async (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  winstonLog.error(`🚨 [UNHANDLED REJECTION] ${error.message}`);
  await handleFailure("EXPRESS_CORE", error);
});

process.on("SIGTERM", () => {
  winstonLog.info("📴 [SHUTDOWN] SIGTERM received");
  engine.stop();
  process.exit(0);
});

const app = express();
// ✅ FIX: httpServer واحد يحمل Express + WebSocket
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      winstonLog.info(`[API] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

(async () => {
  try {
    // 1. Auto-setup credentials from environment
    await autoSetup();

    // 2. Register API routes (بداخلها تشغيل المحرك)
    await registerRoutes(httpServer, app);

    // 3. Serve static frontend
    serveStatic(app);

    // 4. Global error handler
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      handleFailure("EXPRESS_CORE", err);
      if (res.headersSent) return next(err);
      return res.status(status).json({ message });
    });

    // ✅ FIX: httpServer.listen() بدل app.listen() لدعم WebSocket
    const PORT = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      watchdog.heartbeat("SERVER_START");
    });
  } catch (error) {
    winstonLog.error(`💀 [FATAL STARTUP] ${error}`);
    process.exit(1);
  }
})();