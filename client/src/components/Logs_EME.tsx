import React, { useEffect, useState, memo } from 'react';
import { LogsPanel as LogsPanelComponent } from "@/components/LogsPanel";
import { memoryCommander } from "@/lib/memoryCommander";

export const Logs_EME = memo(() => {
  const [usage, setUsage] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function updateLoop() {
      while (isMounted) {
        const report = memoryCommander.getReport();
        if (isMounted) setUsage(report.global.usagePercent);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    updateLoop();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="p-4 w-full box-border" style={{ contain: 'layout style', isolation: 'isolate' }}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold">LOGS EME</h3>
        <span className="text-xs font-mono">MEM: {usage}%</span>
      </div>
      <LogsPanelComponent />
      {/* Footer Branding */}
      <div className="py-6 text-center">
        <p className="text-[10px] font-mono tracking-[0.2em] text-primary uppercase animate-pulse shadow-primary/20 drop-shadow-[0_0_5px_rgba(var(--primary),0.5)]">
          تطوير وبرمجة: المطور البارق صباح
        </p>
      </div>
    </div>
  );
});
