# AI QI Coins - Automated Cryptocurrency Trading Bot

## Overview
AI QI Coins is an automated cryptocurrency trading system that integrates with the OKX exchange. Its core is the "Predator Engine," an AI-powered algorithm that performs technical analysis (SMA, RSI, ATR, ADX) on BTC/USDT markets to generate and execute buy/sell signals automatically. The project aims to provide a robust, automated trading solution with a real-time monitoring dashboard, focusing on reliability, performance, and user-configurable risk management. The system is designed for scalability, supporting up to 20 concurrent assets, and prioritizes efficient resource utilization and a fluid user experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is a dark-themed React 18 application with TypeScript, built using Vite and styled with Tailwind CSS and shadcn/ui. It uses TanStack Query for server state management with 2-second polling, Wouter for routing, Recharts for data visualization, and Framer Motion for animations. The UI is a mobile-first Single Page Application featuring a bottom navigation bar, tab-aware rendering, and strict width control for optimal display on various devices. Performance is optimized through React.memo, batched state updates, tab-aware resource management, and GPU acceleration.

### Backend
The backend is an Express.js application with TypeScript, running on Node.js. It features RESTful APIs with Zod validation, Winston for logging, and integrates with the OKX exchange via the CCXT library. Key services include the "Trading Engine" for market data fetching and AI decision triggering, and the "Predator AI" for technical analysis and signal generation. An EventEmitter-based architecture ensures scalable UI updates with throttled price and batched log emissions.

### Data Storage
PostgreSQL is used for persistent storage, managed with Drizzle ORM. The schema includes tables for users (with encrypted OKX API keys and optional Telegram credentials), trades, AI signals, and system logs.

### Multi-Tenant Telegram Alerts
The system supports per-user Telegram notifications with encrypted credentials and strict user isolation, ensuring alerts are routed only to the authenticated user's Telegram.

### Risk Management
User-configurable risk controls include "Max Concurrent Trades" (1-5) and "Allocation Percentage" (1-100%), with settings persisting across restarts through atomic file storage.

### Performance and Resilience
The system incorporates several features for performance and resilience:
- **WebSocket Gap Recovery**: Detects and backfills missing data during WebSocket disconnects.
- **OKX Rate Limiting**: A priority-based request queue prevents rate limit hits.
- **Zombie Trade Prevention**: Uses unique client order IDs and duplicate detection to prevent erroneous trades.
- **Atomic File Persistence**: Ensures data integrity for critical settings through temporary file strategies, verification, and atomic renaming.
- **Memory Management**: A "Memory Commander" manages resources for 20 concurrent assets, enforcing budgets and prioritizing critical processes. "Direct DOM Injection" bypasses React state for real-time price updates to eliminate UI flickering, and a "Memory Garbage Collector" aggressively cleans up buffers and caches.
- **Web Workers**: Offload indicator calculations to prevent UI blocking.
- **10-Asset Live Feed**: Displays real-time prices for 10 predefined assets (BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, LINK, DOT, POL). Uses a singleton DOM injector with robust binding (requestAnimationFrame retry loop), price caching for persistence across React remounts, and REST polling as primary data source with WebSocket enhancement. Backend proxy `/api/market/tickers` avoids CORS issues.

### ARCHITECTURE OVERRIDE: Dedicated Market Section
- **5-Tab Navigation**: Dashboard, Market, Telegram, Risk, Logs
- **Permanent Mount Strategy**: Market section always mounted (display:block/none toggle), never conditionally rendered
- **Static 10-Slot Grid**: Asset cards rendered once and never destroyed - slots survive all tab switches
- **Pure DOM Selection Updates**: No React state for selection - all visual changes via updateSelectionUI() using direct DOM manipulation
- **Isolated Memory Indicator**: MemoryIndicator is a separate memo component - only it re-renders for memory updates
- **Zero Flicker Guarantee**: Tab switching preserves all prices and selection state with no "Loading..." states

## External Dependencies

### Exchange Integration
- **OKX Exchange**: Integrated for cryptocurrency trading via the CCXT library.

### Third-Party Libraries
- **ccxt**: For interacting with the OKX exchange.
- **drizzle-orm**: For PostgreSQL database interaction.
- **winston**: For robust logging.
- **zod**: For runtime schema validation.
- **date-fns**: For date manipulation.

### Database
- **PostgreSQL**: Used for all persistent data storage.

### Environment Variables & Secrets
- `DATABASE_URL`: PostgreSQL connection string.
- `ENCRYPTION_KEY`: (Recommended) For encrypting sensitive user data.
- `SESSION_SECRET`: (Required) For Express session encryption.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: (Optional) For per-user Telegram notifications.