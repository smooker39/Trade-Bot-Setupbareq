import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "inactive" | "buy" | "sell" | "hold" | "error" | "warning" | "info";
  className?: string;
  animate?: boolean;
}

export function StatusBadge({ status, className, animate = false }: StatusBadgeProps) {
  const styles = {
    active: "bg-primary/20 text-primary border-primary/50",
    inactive: "bg-muted text-muted-foreground border-border",
    buy: "bg-primary/20 text-primary border-primary/50",
    sell: "bg-destructive/20 text-destructive border-destructive/50",
    hold: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
    error: "bg-destructive/20 text-destructive border-destructive/50",
    warning: "bg-orange-500/20 text-orange-500 border-orange-500/50",
    info: "bg-blue-500/20 text-blue-500 border-blue-500/50",
  };

  const labels = {
    active: "RUNNING",
    inactive: "STOPPED",
    buy: "BUY",
    sell: "SELL",
    hold: "HOLD",
    error: "ERROR",
    warning: "WARN",
    info: "INFO",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-bold border uppercase tracking-wider",
        styles[status],
        animate && status === 'active' && "animate-pulse",
        className
      )}
    >
      {animate && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full mr-2", 
          status === 'active' || status === 'buy' ? "bg-green-400" : 
          status === 'sell' ? "bg-red-400" : "bg-gray-400"
        )} />
      )}
      {labels[status] || status}
    </span>
  );
}
