import React, { useEffect, useState, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Wallet, TrendingUp, BarChart3, LogOut, ShieldOff, Percent, Zap } from "lucide-react";
import { memoryCommander } from "@/lib/memoryCommander";
import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * [OMEGA ZERO - PHASE 7]
 * Dashboard_EME: Asynchronous Effect Loop Architecture
 * Restored: BTC Price, Wallet Balance, Profit, Trade Counts, Logout, Leverage, Stop Loss, Kill-Switch
 */
export const Dashboard_EME = memo(() => {
  const [usage, setUsage] = useState(0);
  const { balance, engineState } = useTradingContext();
  const { toast } = useToast();
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function updateLoop() {
      while (isMounted) {
        try {
          const report = memoryCommander.getReport();
          if (isMounted) setUsage(report.global.usagePercent);
        } catch (e) {
          console.error("Dashboard_EME Recovery...");
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    updateLoop();

    // 1. فحص البيانات الحية (Anti-Stale Data)
    let lastProfit = 0;
    const integrityCheck = setInterval(() => {
        const profitEl = document.getElementById('total-profit-display');
        if (profitEl) {
            let currentProfit = parseFloat(profitEl.innerText.replace('$', '').replace(',', ''));
            if (currentProfit === lastProfit && currentProfit !== 0) {
                console.error("❌ نظام البارق صباح: بيانات الأرباح راكدة! فحص الاتصال مطلوب.");
            } else {
                lastProfit = currentProfit;
            }
        }
        
        // 2. Atomic Integrity Check (doomsdayAtomicCheck)
        const requiredElements = [
            { id: 'direct-btc-price', label: 'BTC Price' },
            { id: 'total-profit-display', label: 'Total Profit' },
            { id: 'engine-status-indicator', label: 'Engine Status' },
            { id: 'kill-switch-btn', label: 'Kill Switch' },
            { id: 'logout-btn', label: 'Logout' }
        ];

        requiredElements.forEach(el => {
            if (!document.getElementById(el.id)) {
                console.warn(`⚠️ [ATOMIC CHECK] Missing Element: ${el.label}`);
            }
        });
    }, 2000);

    return () => { 
        isMounted = false; 
        clearInterval(integrityCheck);
    };
  }, []);

  // 2. زر الإيقاف الذكي (Smart Shutdown)
  const smartStopPredator = async () => {
    setIsStopping(true);
    console.log("⚠️ نظام المطور البارق صباح: جارٍ التحقق من الصفقات النشطة قبل الإغلاق...");
    try {
        const activeTrades = engineState?.activePositions || 0;
        if (activeTrades > 0) {
            console.log(`🔄 إغلاق ${activeTrades} صفقة مفتوحة الآن...`);
            await apiRequest("POST", "/api/trade/close-all");
        }
        // Logic to stop engine would go here via API
        await apiRequest("POST", "/api/engine/stop");
        
        toast({
            title: "System Stopped",
            description: "تم تأمين الحساب وإيقاف المفترس بنجاح. المطور: البارق صباح",
        });
        console.log("✅ تم تأمين الحساب وإيقاف المفترس بنجاح. المطور: البارق صباح");
    } catch (e) {
        console.error("❌ فشل في الربط الحقيقي مع المحرك!");
        toast({
            title: "Error",
            description: "فشل في الربط الحقيقي مع المحرك!",
            variant: "destructive"
        });
    } finally {
        setIsStopping(false);
    }
  };

  const btcPrice = engineState?.currentPrice || 0;
  const usdtBalance = balance?.usdt || 0;
  const btcBalance = balance?.btc || 0;
  const isRunning = engineState?.isRunning || false;

  return (
    <div className="p-4 space-y-4 pb-24 relative min-h-full">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-xl font-bold tracking-tighter text-white">DASHBOARD</h1>
        <Button 
          id="logout-btn"
          variant="ghost" 
          size="sm" 
          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
          onClick={async () => {
              // Hard Logout Protocol - Nuclear Session Wipe
              try {
                // Stage 1: Server-side invalidation (POST required by server)
                await apiRequest("POST", "/api/auth/logout");
              } catch (e) {
                console.error("Logout API failed", e);
              }
              
              // Stage 2: Client-side local wipe
              localStorage.clear();
              sessionStorage.clear();
              
              // Stage 3: Cookie cleanup
              document.cookie.split(";").forEach((c) => {
                document.cookie = c
                  .replace(/^ +/, "")
                  .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
              });
              
              // Stage 4: Hard reload to origin (prevents "Cannot GET /api/auth/logout")
              window.location.href = window.location.origin;
          }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* BTC Price Card */}
        <Card className="bg-[#111] border-white/5 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <TrendingUp className="w-12 h-12" />
          </div>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-mono">BTC/USDT</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div id="direct-btc-price" className="text-xl font-bold font-mono text-primary">
              ${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-green-400 mt-1">Live Feed</div>
          </CardContent>
        </Card>

        {/* Wallet Balance Card */}
        <Card className="bg-[#111] border-white/5">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-mono flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-xl font-bold font-mono text-white">
              ${usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{btcBalance.toFixed(6)} BTC</div>
          </CardContent>
        </Card>
      </div>

      {/* Predator AI Controls */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono text-primary flex items-center gap-2">
            <Zap className="w-3 h-3" /> PREDATOR AI ENGINE
          </CardTitle>
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} id="engine-status-indicator" />
        </CardHeader>
        <CardContent className="p-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Leverage</Label>
              <div className="relative">
                <Input className="h-8 bg-black/40 border-white/10 text-xs font-mono" defaultValue="10" />
                <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">X</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase">Stop Loss</Label>
              <div className="relative">
                <Input className="h-8 bg-black/40 border-white/10 text-xs font-mono" defaultValue="1.5" />
                <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
          </div>
          
          <Button 
            id="kill-switch-btn"
            variant="destructive" 
            className="w-full h-9 font-bold text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            onClick={smartStopPredator}
            disabled={isStopping || !isRunning}
          >
            <ShieldOff className="w-4 h-4 mr-2" />
            {isStopping ? "Shutting Down..." : "STOP PREDATOR AI"}
          </Button>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">Total Profit</div>
            <div id="total-profit-display" className="text-lg font-bold font-mono text-green-400">
              {engineState?.totalProfit !== undefined ? `$${engineState.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${balance || '0.00'}`}

            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">Active Trades</div>
            <div className="text-lg font-bold font-mono text-primary">{engineState?.activePositions || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Counts */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-[10px] uppercase text-muted-foreground font-mono">Strategy Execution</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span>PREDATOR AI</span>
            <span className="font-mono text-primary">
              {engineState?.totalTrades !== undefined ? `${engineState.totalTrades} TRADES` : `${engineState?.totalTrades || 0} TRADES`}
            </span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[70%]" />
          </div>
        </CardContent>
      </Card>

      {/* Footer Branding */}
      <div className="py-6 text-center">
        <p className="text-[10px] font-mono tracking-[0.2em] text-primary uppercase animate-pulse shadow-primary/20 drop-shadow-[0_0_5px_rgba(var(--primary),0.5)]">
          تطوير وبرمجة: المطور البارق صباح
        </p>
      </div>
    </div>
  );
});
