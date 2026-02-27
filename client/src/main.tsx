import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { memoryCommander } from "./lib/memoryCommander";
import { memoryGC } from "./lib/memoryGC";
import { domInjector } from "./lib/domInjector";

// GLOBAL SYSTEM INITIALIZATION - SCALING ARCHITECTURE
console.log('[GLOBAL-SYSTEM] Initializing 20-Asset Scaling Architecture');

// Start Memory Commander for global memory oversight
memoryCommander.start();

// Start Memory GC for aggressive cleanup
memoryGC.start();

// Register primary trading asset
memoryCommander.registerAsset('BTC/USDT', 'critical');

console.log('[GLOBAL-SYSTEM] Memory Commander and DOM Injector initialized');

createRoot(document.getElementById("root")!).render(<App />);
