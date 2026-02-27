import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer, IncomingMessage } from "http";
import { log as winstonLog } from "./logger";
import { watchdog } from "./services/watchdog";
import { engine } from "./services/engine";
import { okxClient } from "./services/okx";
import { autoSetup } from "./autoSetup";

/**
 * [OMEGA ZERO - PHASE 1]
 * Quantum-Resilient Backend Architecture
 */

// --- CONTRACT INTERFACES ---

export interface ExecutionContract {
  id: string;
  module: string;
  status: 'ACTIVE' | 'ISOLATED' | 'CIRCUIT_OPEN';
  latencyPattern: number[];
  failureCount: number;
}

export interface CircuitBreaker {
  module: string;
  threshold: number;
  onTrip: (reason: string) => Promise<void>;
}

// --- QUANTUM RESILIENCE MAPPING ---

const MODULE_REGISTRY = new Map<string, ExecutionContract>();

function registerModule(name: string) {
  MODULE_REGISTRY.set(name, {
    id: `mod-${Date.now()}-${name}`,
    module: name,
    status: 'ACTIVE',
    latencyPattern: [],
    failureCount: 0
  });
}

['TRADING_ENGINE', 'EXCHANGE_CLIENT', 'WATCHDOG', 'EXPRESS_CORE'].forEach(registerModule);

// --- CIRCUIT BREAKERS ---

const breakers: CircuitBreaker[] = [
  {
    module: 'EXCHANGE_CLIENT',
    threshold: 3,
    onTrip: async (reason) => {
      winstonLog.error(`🚨 [CIRCUIT BREAKER] Tripped on EXCHANGE_CLIENT: ${reason}`);
      await watchdog.enterSafeMode(`Exchange client circuit tripped: ${reason}`);
    }
  },
  {
    module: 'TRADING_ENGINE',
    threshold: 5,
    onTrip: async (reason) => {
      winstonLog.error(`🚨 [CIRCUIT BREAKER] Tripped on TRADING_ENGINE: ${reason}`);
      engine.stop();
      await performSafeRestart(`Engine circuit tripped: ${reason}`);
    }
  }
];

// --- PREDICTIVE DIAGNOSTICS ---

function updateLatencyPattern(module: string, duration: number) {
  const contract = MODULE_REGISTRY.get(module);
  if (contract) {
    contract.latencyPattern.push(duration);
    if (contract.latencyPattern.length > 50) contract.latencyPattern.shift();
    
    // Predictive check: if last 5 requests show exponential latency growth
    const pattern = contract.latencyPattern.slice(-5);
    if (pattern.length === 5 && pattern.every((val, i) => i === 0 || val > pattern[i-1] * 1.5)) {
      winstonLog.warn(`🧠 [DIAGNOSTICS] Predictive failure detected for ${module}: Exponential latency growth`);
      handleFailure(module, new Error('Predictive latency violation'));
    }
  }
}

async function handleFailure(module: string, error: Error) {
  const contract = MODULE_REGISTRY.get(module);
  if (!contract) return;

  contract.failureCount++;
  winstonLog.error(`⚠️ [FAULT] ${module} failure count: ${contract.failureCount} | Error: ${error.message}`);

  const breaker = breakers.find(b => b.module === module);
  if (breaker && contract.failureCount >= breaker.threshold) {
    contract.status = 'CIRCUIT_OPEN';
    await breaker.onTrip(error.message);
  }
}

// --- CORE SERVER INFRASTRUCTURE ---

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// categorizeError logic kept for legacy compatibility but integrated into OMEGA logic
function categorizeError(error: Error): 'MINOR' | 'MODERATE' | 'CRITICAL' {
  const msg = error.message.toLowerCase();
  if (msg.includes('fatal') || msg.includes('heap') || msg.includes('memory')) return 'CRITICAL';
  if (msg.includes('timeout') || msg.includes('connection') || msg.includes('econnrefused')) return 'MODERATE';
  return 'MINOR';
}

async function performSafeRestart(reason: string): Promise<void> {
  winstonLog.error(`🔄 [SAFE RESTART] Initiating: ${reason}`);
  try {
    engine.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await okxClient.reinitialize();
    await engine.start();
    winstonLog.info('✅ [SAFE RESTART] Complete');
  } catch (e) {
    winstonLog.error(`❌ [SAFE RESTART] Failed: ${e}`);
    watchdog.enterSafeMode(`Safe restart failed: ${reason}`);
  }
}

// --- ZERO-FAILURE AUTONOMY HANDLERS ---

process.on('uncaughtException', async (error: Error) => {
  winstonLog.error(`🚨 [UNCAUGHT EXCEPTION] ${error.message}`);
  await handleFailure('EXPRESS_CORE', error);
  if (categorizeError(error) === 'CRITICAL') {
    await performSafeRestart(`Critical uncaught exception: ${error.message}`);
  }
});

process.on('unhandledRejection', async (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  winstonLog.error(`🚨 [UNHANDLED REJECTION] ${error.message}`);
  await handleFailure('EXPRESS_CORE', error);
});

process.on('SIGTERM', () => {
  winstonLog.info('📴 [SHUTDOWN] SIGTERM');
  engine.stop();
  process.exit(0);
});

// --- EXPRESS SETUP WITH LATENCY TRACKING ---

app.use(cors());
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    updateLatencyPattern('EXPRESS_CORE', duration);
    
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      winstonLog.info(`[API] ${logLine}`);
    }
  });

  next();
});

(async () => {
  try {
    // 🚀 AUTO-SETUP: Configure credentials from environment on first run
    await autoSetup();
    
    // 1. API routes FIRST
    await registerRoutes(httpServer, app);

    // 2. Static frontend serving (Production Mode)
    serveStatic(app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      handleFailure('EXPRESS_CORE', err);
      if (res.headersSent) return next(err);
      return res.status(status).json({ message });
    });

    const PORT = parseInt(process.env.PORT || "5000", 10);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      watchdog.heartbeat("SERVER_START");
    });
  } catch (error) {
    winstonLog.error(`💀 [FATAL STARTUP] ${error}`);
    process.exit(1);
  }
})();
