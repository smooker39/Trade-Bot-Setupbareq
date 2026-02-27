import { z } from 'zod';
import { trades, signals, systemLogs, users } from './schema';

// ============================================
// API CONTRACT
// ============================================

export const api = {
  // Auth/Credentials
  auth: {
    check: {
      method: 'GET' as const,
      path: '/api/auth/check',
      responses: {
        200: z.object({
          hasCredentials: z.boolean(),
        }),
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        okxApiKey: z.string().min(1),
        okxSecret: z.string().min(1),
        okxPassword: z.string().min(1),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        400: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },

  // Health and Status
  status: {
    get: {
      method: 'GET' as const,
      path: '/api/health',
      responses: {
        200: z.object({
          status: z.string(),
          timestamp: z.string(),
          botStatus: z.object({
            isRunning: z.boolean(),
            lastCheck: z.string(),
            currentPrice: z.number(),
            lastSignal: z.string(),
            balance: z.record(z.number()),
          })
        }),
      },
    },
  },
  
  // Trade History
  trades: {
    list: {
      method: 'GET' as const,
      path: '/api/trades',
      responses: {
        200: z.array(z.custom<typeof trades.$inferSelect>()),
      },
    },
  },

  // Signals History
  signals: {
    list: {
      method: 'GET' as const,
      path: '/api/signals',
      responses: {
        200: z.array(z.custom<typeof signals.$inferSelect>()),
      },
    },
  },

  // System Logs
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs',
      input: z.object({
        limit: z.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof systemLogs.$inferSelect>()),
      },
    },
  },
  
  // Bot Control
  control: {
    toggle: {
      method: 'POST' as const,
      path: '/api/bot/toggle',
      input: z.object({
        running: z.boolean()
      }),
      responses: {
        200: z.object({ success: z.boolean(), isRunning: z.boolean() }),
      }
    }
  },

  // Trade Execution
  trade: {
    execute: {
      method: 'POST' as const,
      path: '/api/trade/execute',
      input: z.object({
        symbol: z.string(),
        side: z.enum(['buy', 'sell']),
        amount: z.number().positive(),
        strategy: z.string(),
      }),
      responses: {
        200: z.object({ 
          success: z.boolean(), 
          orderId: z.string().optional(),
          price: z.number().optional(),
          message: z.string() 
        }),
        400: z.object({ success: z.boolean(), message: z.string() }),
      }
    }
  },

  // Log Creation (for frontend to persist logs)
  logCreate: {
    create: {
      method: 'POST' as const,
      path: '/api/logs/create',
      input: z.object({
        level: z.enum(['info', 'warning', 'error']),
        message: z.string(),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
      }
    }
  }
};

export const errorSchemas = {
  internal: z.object({
    message: z.string(),
  }),
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
