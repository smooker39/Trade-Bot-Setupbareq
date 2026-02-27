import { useBotStatus } from "@/hooks/use-trading";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";
import { Activity, Wallet, TrendingUp, Clock } from "lucide-react";

export function StatsBar() {
  const { data, isLoading } = useBotStatus();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  const { botStatus } = data;
  const lastSignal = botStatus.lastSignal.toLowerCase() as "buy" | "sell" | "hold";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Bot Status */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex justify-between items-start mb-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">System Status</p>
          <Activity className="w-4 h-4 text-primary" />
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={botStatus.isRunning ? "active" : "inactive"} animate={true} />
        </div>
        <p className="text-xs text-muted-foreground mt-3 font-mono">
          Last Check: {format(new Date(), "HH:mm:ss")}
        </p>
      </div>

      {/* Current Price */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm group">
        <div className="flex justify-between items-start mb-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">BTC/USDT Price</p>
          <TrendingUp className="w-4 h-4 text-blue-500" />
        </div>
        <h3 className="text-2xl font-bold font-mono tracking-tight terminal-text text-foreground">
          ${botStatus.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">Real-time market data</p>
      </div>

      {/* Last Signal */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm group">
        <div className="flex justify-between items-start mb-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Latest Signal</p>
          <Clock className="w-4 h-4 text-orange-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <StatusBadge status={lastSignal} className="text-sm px-3 py-1" />
        </div>
        <p className="text-xs text-muted-foreground mt-3 font-mono">
          Generated via SMA Crossover
        </p>
      </div>

      {/* Balance */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm group">
        <div className="flex justify-between items-start mb-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Portfolio Value</p>
          <Wallet className="w-4 h-4 text-purple-500" />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm font-mono">
            <span className="text-muted-foreground">USDT:</span>
            <span className="font-bold text-foreground">${botStatus.balance?.USDT?.toLocaleString() ?? '0.00'}</span>
          </div>
          <div className="flex justify-between text-sm font-mono">
            <span className="text-muted-foreground">BTC:</span>
            <span className="font-bold text-foreground">{botStatus.balance?.BTC?.toFixed(4) ?? '0.0000'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
