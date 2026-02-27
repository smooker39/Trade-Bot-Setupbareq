import { Link, useLocation } from "wouter";
import { LayoutDashboard, Bot, LineChart, ShieldAlert, Terminal, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bots", label: "Trading Bots", icon: Bot },
  { href: "/trades", label: "Trade History", icon: LineChart },
  { href: "/risk", label: "Risk Management", icon: ShieldAlert },
  { href: "/logs", label: "System Logs", icon: Terminal },
  { href: "/telegram", label: "Telegram Setup", icon: MessageSquare },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-card/50 backdrop-blur-xl lg:flex">
      <div className="flex h-20 items-center px-8 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary box-glow">
            <Bot size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground text-glow">
              AIQ COINS
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">System Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8 px-4 space-y-1">
        <div className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Core Systems
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(34,197,94,0.2)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon
                  size={20}
                  className={cn(
                    "transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {item.label}
                {isActive && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-primary box-glow" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="p-6 border-t border-border/50">
        <div className="rounded-xl bg-secondary/50 p-4 border border-white/5">
          <h4 className="text-sm font-semibold text-foreground mb-1">Quantum Engine</h4>
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs text-muted-foreground">Latency</span>
            <span className="text-xs font-mono text-emerald-500">12ms</span>
          </div>
          <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[85%] rounded-full box-glow" />
          </div>
        </div>
      </div>
    </aside>
  );
}
