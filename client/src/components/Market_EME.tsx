import React, { useEffect, useState, memo } from 'react';
import { AssetGrid } from "@/components/AssetGrid";
import { memoryCommander } from "@/lib/memoryCommander";

/**
 * [OMEGA ZERO - PHASE 7]
 * Market_EME: Asynchronous Effect Loop Architecture
 * Implements non-blocking high-frequency data isolation.
 */
export const Market_EME = memo(() => {
  const [usage, setUsage] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    // Independent Asynchronous Loop (500ms) for Market Data & Memory
    async function updateLoop() {
      while (isMounted) {
        try {
          // Monitor Memory in isolation
          const report = memoryCommander.getReport();
          if (isMounted) {
            setUsage(report.global.usagePercent);
          }
        } catch (e) {
          console.error("Market_EME Isolation Recovery...");
        }
        await new Promise(r => setTimeout(r, 500)); // Non-blocking sleep
      }
    }

    updateLoop();
    return () => { isMounted = false; }; // Clean unmount (Zero Memory Leak)
  }, []);

  const memColor = usage < 40 ? 'text-green-400' : usage < 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div 
      className="eme-container market-isolate p-4 w-full box-border" 
      style={{ 
        display: 'block', 
        minHeight: '100px',
        contain: 'layout style',
        isolation: 'isolate'
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide uppercase">Market Intelligence</h1>
          <span className="text-xs text-muted-foreground">Async Loop Isolated</span>
        </div>
        <div className="text-right">
          <span className={`text-sm font-mono ${memColor}`}>MEM: {usage}%</span>
          <span className="text-xs text-muted-foreground block uppercase">System Health: Normal</span>
        </div>
      </div>
      
      {/* List of 10 essential currencies */}
      <AssetGrid />

      {/* Footer Branding */}
      <div className="py-6 text-center border-t border-white/5 mt-4">
        <p className="text-[10px] font-mono tracking-[0.2em] text-primary uppercase animate-pulse shadow-primary/20 drop-shadow-[0_0_5px_rgba(var(--primary),0.5)]">
          تطوير وبرمجة: المطور البارق صباح
        </p>
      </div>
    </div>
  );
});
