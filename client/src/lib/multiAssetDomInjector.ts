/**
 * FINAL RECOVERY: MULTI-ASSET DOM INJECTOR
 * 
 * ABSOLUTE RULES:
 * - Direct DOM manipulation ONLY - React NEVER participates in price updates
 * - EXACTLY 10 fixed slots - slots NEVER remount, reorder, or change structure
 * - User can select 1, multiple, or all 10 assets
 * - Clean subscribe/unsubscribe when switching assets
 * - ZERO flickering - price injection is atomic via requestAnimationFrame
 * - Data pipeline is OUTSIDE React lifecycle
 * 
 * THE FLICKER IS DEAD. USER CONTROL IS ABSOLUTE.
 */

import { memoryCommander } from './memoryCommander';

interface AssetDOMElements {
  priceElement: HTMLElement | null;
  changeElement: HTMLElement | null;
  volumeElement: HTMLElement | null;
  statusElement: HTMLElement | null;
  nameElement: HTMLElement | null;
}

interface SlotState {
  slotIndex: number;
  boundAsset: string | null;
  lastPrice: number;
  lastChange: number;
  lastVolume: number;
  lastUpdate: number;
  elements: AssetDOMElements;
  animationFrameId: number | null;
  isSubscribed: boolean;
}

export interface TradingAsset {
  symbol: string;
  displayName: string;
  priority: 'critical' | 'high' | 'normal';
}

// 10 PREDEFINED ASSETS - Major trading pairs
export const TRADING_ASSETS: TradingAsset[] = [
  { symbol: 'BTC-USDT', displayName: 'BTC', priority: 'critical' },
  { symbol: 'ETH-USDT', displayName: 'ETH', priority: 'high' },
  { symbol: 'SOL-USDT', displayName: 'SOL', priority: 'high' },
  { symbol: 'XRP-USDT', displayName: 'XRP', priority: 'normal' },
  { symbol: 'DOGE-USDT', displayName: 'DOGE', priority: 'normal' },
  { symbol: 'ADA-USDT', displayName: 'ADA', priority: 'normal' },
  { symbol: 'AVAX-USDT', displayName: 'AVAX', priority: 'normal' },
  { symbol: 'LINK-USDT', displayName: 'LINK', priority: 'normal' },
  { symbol: 'DOT-USDT', displayName: 'DOT', priority: 'normal' },
  { symbol: 'POL-USDT', displayName: 'POL', priority: 'normal' },
];

// Price cache to persist across remounts
interface PriceCache {
  price: number;
  change: number;
  volume: number;
  timestamp: number;
}
const priceCache = new Map<string, PriceCache>();

// Selection state - persists across remounts
let selectedAssets: Set<string> = new Set(TRADING_ASSETS.map(a => a.symbol));
let selectionChangeCallbacks: Array<(selected: string[]) => void> = [];

class MultiAssetDOMInjector {
  // STATIC 10-SLOT ARCHITECTURE - slots never change, only data bindings
  private slots: Map<number, SlotState> = new Map();
  private readonly SLOT_COUNT = 10;
  private readonly THROTTLE_MS = 100;
  
  private sharedWebSocket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private isConnecting = false;
  private wsConnected = false;

  // ========== SLOT MANAGEMENT ==========
  
  init(): void {
    if (this.isInitialized) {
      console.log('[DOM-INJECTOR] Already initialized, will rebind slots');
      return;
    }
    
    console.log('[DOM-INJECTOR] Initializing 10-slot static architecture');
    
    // Create exactly 10 slots - NEVER changes
    for (let i = 0; i < this.SLOT_COUNT; i++) {
      const asset = TRADING_ASSETS[i];
      
      this.slots.set(i, {
        slotIndex: i,
        boundAsset: asset.symbol,
        lastPrice: 0,
        lastChange: 0,
        lastVolume: 0,
        lastUpdate: 0,
        elements: {
          priceElement: null,
          changeElement: null,
          volumeElement: null,
          statusElement: null,
          nameElement: null,
        },
        animationFrameId: null,
        isSubscribed: selectedAssets.has(asset.symbol),
      });
      
      memoryCommander.registerAsset(asset.symbol, asset.priority);
    }
    
    memoryCommander.start();
    this.isInitialized = true;
    
    console.log(`[DOM-INJECTOR] Created ${this.SLOT_COUNT} static slots`);
  }

  bindSlotElements(): number {
    let boundCount = 0;
    let restoredCount = 0;
    
    for (let i = 0; i < this.SLOT_COUNT; i++) {
      const slot = this.slots.get(i);
      if (!slot) continue;
      
      // Bind DOM elements for this slot
      slot.elements = {
        priceElement: document.getElementById(`slot-price-${i}`),
        changeElement: document.getElementById(`slot-change-${i}`),
        volumeElement: document.getElementById(`slot-volume-${i}`),
        statusElement: document.getElementById(`slot-status-${i}`),
        nameElement: document.getElementById(`slot-name-${i}`),
      };
      
      if (slot.elements.priceElement) {
        boundCount++;
        
        // Reset tracking for fresh DOM update
        slot.lastPrice = 0;
        slot.lastChange = 0;
        slot.lastVolume = 0;
        slot.lastUpdate = 0;
        
        // Restore cached prices if available
        if (slot.boundAsset) {
          const cached = priceCache.get(slot.boundAsset);
          if (cached && Date.now() - cached.timestamp < 60000) {
            this.updateSlot(i, cached.price, cached.change, cached.volume);
            restoredCount++;
          }
          
          // Update name element
          const asset = TRADING_ASSETS.find(a => a.symbol === slot.boundAsset);
          if (asset && slot.elements.nameElement) {
            slot.elements.nameElement.textContent = asset.displayName;
          }
        }
        
        // Update visibility based on selection
        this.updateSlotVisibility(i);
      }
    }
    
    console.log(`[DOM-INJECTOR] Bound ${boundCount}/${this.SLOT_COUNT} slots, restored ${restoredCount} from cache`);
    return boundCount;
  }

  // ========== ASSET SELECTION (USER CONTROL) ==========

  getSelectedAssets(): string[] {
    return Array.from(selectedAssets);
  }

  isAssetSelected(symbol: string): boolean {
    return selectedAssets.has(symbol);
  }

  selectAsset(symbol: string): void {
    if (!TRADING_ASSETS.find(a => a.symbol === symbol)) return;
    if (selectedAssets.has(symbol)) return;
    
    selectedAssets.add(symbol);
    
    // Find slot for this asset and update visibility
    const slotIndex = TRADING_ASSETS.findIndex(a => a.symbol === symbol);
    if (slotIndex >= 0) {
      const slot = this.slots.get(slotIndex);
      if (slot) {
        slot.isSubscribed = true;
        this.updateSlotVisibility(slotIndex);
      }
    }
    
    // Resubscribe to get fresh data
    this.resubscribeWebSocket();
    this.notifySelectionChange();
    
    console.log(`[DOM-INJECTOR] Selected asset: ${symbol}`);
  }

  deselectAsset(symbol: string): void {
    if (!selectedAssets.has(symbol)) return;
    
    selectedAssets.delete(symbol);
    
    // Find slot for this asset and update visibility
    const slotIndex = TRADING_ASSETS.findIndex(a => a.symbol === symbol);
    if (slotIndex >= 0) {
      const slot = this.slots.get(slotIndex);
      if (slot) {
        slot.isSubscribed = false;
        this.updateSlotVisibility(slotIndex);
      }
    }
    
    // Resubscribe to avoid receiving unwanted data
    this.resubscribeWebSocket();
    this.notifySelectionChange();
    
    console.log(`[DOM-INJECTOR] Deselected asset: ${symbol}`);
  }

  toggleAsset(symbol: string): void {
    if (selectedAssets.has(symbol)) {
      this.deselectAsset(symbol);
    } else {
      this.selectAsset(symbol);
    }
  }

  selectAllAssets(): void {
    TRADING_ASSETS.forEach(asset => {
      selectedAssets.add(asset.symbol);
    });
    
    this.slots.forEach((slot, i) => {
      slot.isSubscribed = true;
      this.updateSlotVisibility(i);
    });
    
    this.resubscribeWebSocket();
    this.notifySelectionChange();
    
    console.log('[DOM-INJECTOR] Selected all 10 assets');
  }

  deselectAllAssets(): void {
    selectedAssets.clear();
    
    this.slots.forEach((slot, i) => {
      slot.isSubscribed = false;
      this.updateSlotVisibility(i);
    });
    
    this.resubscribeWebSocket();
    this.notifySelectionChange();
    
    console.log('[DOM-INJECTOR] Deselected all assets');
  }

  onSelectionChange(callback: (selected: string[]) => void): () => void {
    selectionChangeCallbacks.push(callback);
    return () => {
      selectionChangeCallbacks = selectionChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifySelectionChange(): void {
    const selected = this.getSelectedAssets();
    selectionChangeCallbacks.forEach(cb => cb(selected));
  }

  private updateSlotVisibility(slotIndex: number): void {
    const slot = this.slots.get(slotIndex);
    if (!slot) return;
    
    const card = document.getElementById(`slot-card-${slotIndex}`);
    if (card) {
      // Use opacity for smooth transitions - never remove from DOM
      card.style.opacity = slot.isSubscribed ? '1' : '0.3';
      card.style.filter = slot.isSubscribed ? 'none' : 'grayscale(100%)';
    }
    
    // Update status indicator
    if (slot.elements.statusElement) {
      slot.elements.statusElement.style.backgroundColor = 
        slot.isSubscribed ? (this.wsConnected ? '#4ade80' : '#facc15') : '#6b7280';
    }
  }

  // ========== PRICE UPDATES ==========

  updateSlot(slotIndex: number, price: number, change24h?: number, volume24h?: number): void {
    const slot = this.slots.get(slotIndex);
    if (!slot || !slot.boundAsset) return;
    
    // Cache the price
    priceCache.set(slot.boundAsset, {
      price,
      change: change24h || 0,
      volume: volume24h || 0,
      timestamp: Date.now()
    });
    
    // Skip if slot is not subscribed (still cache for when it becomes active)
    if (!slot.isSubscribed) return;
    
    // Throttle updates
    const updateRate = memoryCommander.getUpdateRate(slot.boundAsset);
    const throttleMs = 1000 / updateRate;
    
    const now = performance.now();
    if (now - slot.lastUpdate < Math.max(throttleMs, this.THROTTLE_MS)) return;
    
    // Skip if unchanged
    if (price === slot.lastPrice && change24h === slot.lastChange) return;
    
    slot.lastUpdate = now;
    
    // Cancel pending frame
    if (slot.animationFrameId !== null) {
      cancelAnimationFrame(slot.animationFrameId);
    }
    
    // Schedule DOM update on next paint - ATOMIC, NO FLICKER
    slot.animationFrameId = requestAnimationFrame(() => {
      const { priceElement, changeElement, volumeElement, statusElement } = slot.elements;
      
      if (priceElement && price !== slot.lastPrice) {
        const formattedPrice = price >= 1000 
          ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : price >= 1
            ? `$${price.toFixed(4)}`
            : `$${price.toFixed(6)}`;
        
        priceElement.textContent = formattedPrice;
        slot.lastPrice = price;
      }
      
      if (changeElement && change24h !== undefined && change24h !== slot.lastChange) {
        const sign = change24h >= 0 ? '+' : '';
        changeElement.textContent = `${sign}${change24h.toFixed(2)}%`;
        changeElement.style.color = change24h >= 0 ? '#4ade80' : '#f87171';
        slot.lastChange = change24h;
      }
      
      if (volumeElement && volume24h !== undefined && volume24h !== slot.lastVolume) {
        const volStr = volume24h >= 1e9 
          ? `${(volume24h / 1e9).toFixed(2)}B`
          : volume24h >= 1e6
            ? `${(volume24h / 1e6).toFixed(2)}M`
            : `${(volume24h / 1e3).toFixed(2)}K`;
        volumeElement.textContent = `Vol: ${volStr}`;
        slot.lastVolume = volume24h;
      }
      
      if (statusElement && this.wsConnected) {
        statusElement.style.backgroundColor = '#4ade80';
      }
      
      slot.animationFrameId = null;
    });
    
    // Update Memory Commander
    memoryCommander.updateAssetBuffers(slot.boundAsset, {
      priceBuffer: 1,
      tickHistory: 1,
    });
  }

  updatePriceBySymbol(symbol: string, price: number, change24h?: number, volume24h?: number): void {
    const slotIndex = TRADING_ASSETS.findIndex(a => a.symbol === symbol);
    if (slotIndex >= 0) {
      this.updateSlot(slotIndex, price, change24h, volume24h);
    }
  }

  // ========== DATA CONNECTIONS ==========

  async fetchPricesViaREST(): Promise<void> {
    try {
      const response = await fetch('/api/market/tickers');
      const data = await response.json();
      
      if (!response.ok) {
        console.log('[API-DEBUG] Tickers STATUS:', response.status);
        return;
      }
      
      if (!data.tickers) return;
      
      for (const ticker of data.tickers) {
        const price = ticker.price;
        const open24h = ticker.open24h || price;
        const change24h = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;
        const volume24h = ticker.volume24h || 0;
        
        this.updatePriceBySymbol(ticker.symbol, price, change24h, volume24h);
      }
    } catch (err) {
      console.log('[DOM-INJECTOR] REST fetch error:', err);
    }
  }

  startPolling(): void {
    if (this.pollTimer) return;
    
    console.log('[DOM-INJECTOR] Starting REST polling (every 3s)');
    
    this.fetchPricesViaREST();
    
    this.pollTimer = setInterval(() => {
      this.fetchPricesViaREST();
    }, 3000);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  connectWebSocket(): void {
    if (this.sharedWebSocket || this.isConnecting) return;
    
    this.isConnecting = true;
    console.log('[DOM-INJECTOR] Connecting WebSocket...');
    
    const wsUrl = window.location.protocol === 'https:' ? 'wss://ws.okx.com:8443/ws/v5/public' : 'wss://ws.okx.com:8443/ws/v5/public';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      this.isConnecting = false;
      this.wsConnected = true;
      console.log('[DOM-INJECTOR] WebSocket connected, subscribing to selected assets');
      
      this.subscribeToSelectedAssets(ws);
      
      // Update all slot status indicators
      this.slots.forEach((slot, i) => {
        if (slot.isSubscribed && slot.elements.statusElement) {
          slot.elements.statusElement.style.backgroundColor = '#4ade80';
        }
      });
    };
    
    ws.onmessage = (e) => {
      try {
        const res = JSON.parse(e.data);
        if (res.data && res.data[0]) {
          const ticker = res.data[0];
          const symbol = ticker.instId;
          const price = parseFloat(ticker.last);
          const open24h = parseFloat(ticker.open24h || ticker.sodUtc0 || price);
          const change24h = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;
          const volume24h = parseFloat(ticker.volCcy24h || '0');
          
          this.updatePriceBySymbol(symbol, price, change24h, volume24h);
        }
      } catch {
        // Silent parse error
      }
    };
    
    ws.onclose = () => {
      console.log('[DOM-INJECTOR] WebSocket closed');
      this.isConnecting = false;
      this.wsConnected = false;
      this.sharedWebSocket = null;
      
      // Update status indicators
      this.slots.forEach((slot, i) => {
        if (slot.elements.statusElement) {
          slot.elements.statusElement.style.backgroundColor = 
            slot.isSubscribed ? '#facc15' : '#6b7280';
        }
      });
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      
      // Auto-reconnect
      this.reconnectTimer = setTimeout(() => {
        if (this.isInitialized) {
          this.connectWebSocket();
        }
      }, 3000);
    };
    
    ws.onerror = () => {
      console.log('[DOM-INJECTOR] WebSocket error, using REST fallback');
      ws.close();
    };
    
    this.sharedWebSocket = ws;
  }

  private subscribeToSelectedAssets(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    const selected = this.getSelectedAssets();
    if (selected.length === 0) return;
    
    const subscriptions = selected.map(symbol => ({
      channel: 'tickers',
      instId: symbol
    }));
    
    ws.send(JSON.stringify({
      op: 'subscribe',
      args: subscriptions
    }));
    
    console.log(`[DOM-INJECTOR] Subscribed to ${selected.length} assets`);
  }

  private resubscribeWebSocket(): void {
    if (!this.sharedWebSocket || this.sharedWebSocket.readyState !== WebSocket.OPEN) return;
    
    // Unsubscribe from all, then subscribe to selected
    const allSymbols = TRADING_ASSETS.map(a => ({
      channel: 'tickers',
      instId: a.symbol
    }));
    
    this.sharedWebSocket.send(JSON.stringify({
      op: 'unsubscribe',
      args: allSymbols
    }));
    
    // Small delay then subscribe to selected
    setTimeout(() => {
      if (this.sharedWebSocket && this.sharedWebSocket.readyState === WebSocket.OPEN) {
        this.subscribeToSelectedAssets(this.sharedWebSocket);
      }
    }, 100);
  }

  connect(): void {
    if (this.pollTimer || this.sharedWebSocket) {
      console.log('[DOM-INJECTOR] Already connected');
      return;
    }
    
    console.log('[DOM-INJECTOR] Connecting data feeds...');
    
    this.startPolling();
    this.connectWebSocket();
  }

  disconnect(): void {
    console.log('[DOM-INJECTOR] Disconnecting...');
    
    this.stopPolling();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.sharedWebSocket) {
      this.sharedWebSocket.close();
      this.sharedWebSocket = null;
    }
    
    this.wsConnected = false;
  }

  destroy(): void {
    console.log('[DOM-INJECTOR] Destroying injector');
    
    this.slots.forEach(slot => {
      if (slot.animationFrameId !== null) {
        cancelAnimationFrame(slot.animationFrameId);
      }
    });
    
    this.disconnect();
    this.slots.clear();
    this.isInitialized = false;
    
    TRADING_ASSETS.forEach(asset => {
      memoryCommander.unregisterAsset(asset.symbol);
    });
    
    memoryCommander.stop();
  }

  // ========== UTILITIES ==========

  getAssetList(): TradingAsset[] {
    return TRADING_ASSETS;
  }

  getMemoryReport(): ReturnType<typeof memoryCommander.getReport> {
    return memoryCommander.getReport();
  }

  isConnected(): boolean {
    return this.wsConnected || this.pollTimer !== null;
  }
}

export const multiAssetInjector = new MultiAssetDOMInjector();
export default multiAssetInjector;
