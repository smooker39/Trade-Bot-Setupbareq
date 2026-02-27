/**
 * ARCHITECTURE OVERRIDE: STATIC 10-SLOT ASSET GRID
 * 
 * VISUAL STABILITY LAW (ABSOLUTE):
 * - 10 fixed slots rendered ONCE and NEVER destroyed
 * - React must NOT detect, track, or reconcile price/selection changes
 * - All updates via Direct DOM Injection ONLY
 * - No layout shifts, no animations tied to price ticks
 * 
 * THE FLICKER IS DEAD. SLOTS ARE PERMANENT.
 */

import { memo, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square } from 'lucide-react';
import { multiAssetInjector, TRADING_ASSETS } from '@/lib/multiAssetDomInjector';

interface StaticSlotProps {
  slotIndex: number;
  asset: typeof TRADING_ASSETS[0];
}

const StaticSlot = memo(function StaticSlot({ slotIndex, asset }: StaticSlotProps) {
  const handleClick = () => {
    multiAssetInjector.toggleAsset(asset.symbol);
  };
  
  return (
    <Card 
      id={`slot-card-${slotIndex}`}
      className="relative overflow-visible cursor-pointer"
      style={{ 
        background: 'rgba(20, 20, 30, 0.8)',
        border: '1px solid rgba(100, 100, 150, 0.3)',
        transform: 'translate3d(0,0,0)',
        transition: 'opacity 0.2s ease, filter 0.2s ease',
      }}
      onClick={handleClick}
      data-testid={`asset-card-${asset.displayName.toLowerCase()}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              id={`slot-status-${slotIndex}`}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#facc15' }}
            />
            <span 
              id={`slot-name-${slotIndex}`}
              className="font-bold text-sm text-white"
            >
              {asset.displayName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">#{slotIndex + 1}</span>
            <span id={`slot-check-${slotIndex}`}>
              <CheckSquare className="w-4 h-4 text-green-400" />
            </span>
          </div>
        </div>
        
        <div 
          id={`slot-price-${slotIndex}`}
          className="text-lg font-mono font-bold text-white mb-1"
          style={{ minHeight: '28px' }}
          data-testid={`price-${asset.displayName.toLowerCase()}`}
        >
          Loading...
        </div>
        
        <div className="flex items-center justify-between">
          <span
            id={`slot-change-${slotIndex}`}
            className="text-xs font-mono"
            style={{ color: '#9ca3af' }}
            data-testid={`change-${asset.displayName.toLowerCase()}`}
          >
            --%
          </span>
          <span
            id={`slot-volume-${slotIndex}`}
            className="text-xs text-muted-foreground"
            data-testid={`volume-${asset.displayName.toLowerCase()}`}
          >
            Vol: --
          </span>
        </div>
      </CardContent>
    </Card>
  );
}, () => true); // NEVER re-render - all updates via DOM injection

export const AssetGrid = memo(function AssetGrid() {
  const isMounted = useRef(false);
  
  useEffect(() => {
    if (isMounted.current) {
      console.log('[ASSET-GRID] Already mounted, rebinding only');
      multiAssetInjector.bindSlotElements();
      return;
    }
    
    isMounted.current = true;
    console.log('[ASSET-GRID] Initial mount - setting up static 10-slot grid');
    
    multiAssetInjector.init();
    
    let bindTimer: number;
    let attempts = 0;
    const maxAttempts = 20;
    
    const tryBind = () => {
      attempts++;
      const boundCount = multiAssetInjector.bindSlotElements();
      
      if (boundCount >= 10) {
        console.log('[ASSET-GRID] All 10 slots bound successfully');
        multiAssetInjector.connect();
        updateSelectionUI();
      } else if (attempts < maxAttempts) {
        bindTimer = requestAnimationFrame(tryBind);
      } else {
        console.warn('[ASSET-GRID] Binding incomplete, starting anyway');
        multiAssetInjector.connect();
      }
    };
    
    bindTimer = requestAnimationFrame(tryBind);
    
    const unsubscribe = multiAssetInjector.onSelectionChange(() => {
      updateSelectionUI();
    });
    
    return () => {
      if (bindTimer) cancelAnimationFrame(bindTimer);
      unsubscribe();
    };
  }, []);
  
  return (
    <div className="space-y-2">
      {/* ASSET SELECTION CONTROLS - DOM-injected count */}
      <div 
        className="flex items-center justify-between px-1"
        data-testid="asset-selector-controls"
      >
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              multiAssetInjector.selectAllAssets();
            }}
            className="h-7 text-xs"
            data-testid="button-select-all"
          >
            <CheckSquare className="w-3 h-3 mr-1" />
            All
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              multiAssetInjector.deselectAllAssets();
            }}
            className="h-7 text-xs"
            data-testid="button-deselect-all"
          >
            <Square className="w-3 h-3 mr-1" />
            None
          </Button>
        </div>
        <span 
          id="selection-count-display"
          className="text-xs text-muted-foreground"
          data-testid="text-selected-count"
        >
          10/10 selected
        </span>
      </div>
      
      {/* STATIC 10-SLOT GRID - NEVER remounts */}
      <div 
        className="grid grid-cols-2 gap-2 p-2"
        style={{ 
          transform: 'translate3d(0,0,0)',
          willChange: 'auto',
        }}
        data-testid="asset-grid-container"
      >
        {TRADING_ASSETS.map((asset, index) => (
          <StaticSlot
            key={`static-slot-${index}`}
            slotIndex={index}
            asset={asset}
          />
        ))}
      </div>
    </div>
  );
}, () => true); // STATIC - never re-render entire grid container

function updateSelectionUI(): void {
  const selected = multiAssetInjector.getSelectedAssets();
  const selectedSet = new Set(selected);
  
  requestAnimationFrame(() => {
    const countEl = document.getElementById('selection-count-display');
    if (countEl) {
      countEl.textContent = `${selected.length}/10 selected`;
    }
    
    TRADING_ASSETS.forEach((asset, i) => {
      const isSelected = selectedSet.has(asset.symbol);
      
      const card = document.getElementById(`slot-card-${i}`);
      if (card) {
        card.style.opacity = isSelected ? '1' : '0.3';
        card.style.filter = isSelected ? 'none' : 'grayscale(100%)';
      }
      
      const checkEl = document.getElementById(`slot-check-${i}`);
      if (checkEl) {
        checkEl.innerHTML = isSelected
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>';
      }
      
      const statusEl = document.getElementById(`slot-status-${i}`);
      if (statusEl) {
        statusEl.style.backgroundColor = isSelected ? '#4ade80' : '#6b7280';
      }
    });
  });
}

export default AssetGrid;
