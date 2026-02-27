import { LayoutDashboard, BarChart3, Send, ShieldAlert, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { memo } from "react";

export type TabType = "dashboard" | "market" | "telegram" | "risk" | "logs";

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav = memo(({ activeTab, onTabChange }: BottomNavProps) => {
  const tabs = [
    { id: "dashboard", icon: LayoutDashboard, label: "Bot" },
    { id: "market", icon: BarChart3, label: "Market" },
    { id: "telegram", icon: Send, label: "Alerts" },
    { id: "risk", icon: ShieldAlert, label: "Risk" },
    { id: "logs", icon: FileText, label: "Logs" },
  ] as const;

  return (
    <div className="flex flex-col w-full">
      <nav className="flex items-center justify-around bg-black/80 backdrop-blur-xl border-t border-white/10 px-2 py-3 safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative group",
                isActive ? "text-primary" : "text-white/40 hover:text-white/60"
              )}
            >
              {isActive && (
                <span className="absolute -top-3 w-8 h-[2px] bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
              )}
              <Icon className={cn("w-6 h-6 transition-transform", isActive && "scale-110")} />
              <span className="text-[10px] font-medium uppercase tracking-tighter">{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="bg-black/80 py-1 border-t border-white/5">
        <p className="text-[7px] text-white/20 uppercase tracking-[0.3em] text-center font-mono">
          تطوير وبرمجة: المطور البارق صباح
        </p>
      </div>
    </div>
  );
});
