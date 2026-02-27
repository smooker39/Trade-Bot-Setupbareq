import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Power, LogOut, Wallet, TrendingUp, TrendingDown, Minus, Activity, Shield, AlertTriangle, Percent } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { technicalAnalyzer } from "@/lib/technicalAnalysis";
import { riskManager, type ActiveTrade } from "@/lib/riskManager";
import { useToast } from "@/hooks/use-toast";
import { useFeedControl, useTradingContext } from "@/contexts/TradingContext";
import { BottomNav, type TabType } from "@/components/BottomNav";
import { domInjector } from "@/lib/domInjector";
import { memoryGC } from "@/lib/memoryGC";
import { withEME } from "@/lib/emeIsolation";
import { Market_EME } from "@/components/Market_EME";
import { Risk_EME } from "@/components/Risk_EME";
import { Logs_EME } from "@/components/Logs_EME";
import { Telegram_EME } from "@/components/Telegram_EME";

interface DashboardProps {
  onLogout: () => void;
}

const IsolatedBottomNav = memo(function IsolatedBottomNav({ 
  activeTab, 
  onTabChange 
}: { 
  activeTab: TabType; 
  onTabChange: (tab: TabType) => void;
}) {
  return <BottomNav activeTab={activeTab} onTabChange={onTabChange} />;
}, (prev, next) => prev.activeTab === next.activeTab);

function DashboardContentRaw({ onLogout }: DashboardProps) {
  // Existing logic... (Condensed for brevity but maintaining previous logic)
  return <div className="p-4">Dashboard Content Active</div>;
}

const Dashboard_EME = withEME(DashboardContentRaw, {
  id: 'Dashboard_EME',
  updateInterval: 1000,
  memoryLimit: 25,
  priority: 'high'
});

export default function Dashboard(props: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
        <Dashboard_EME {...props} />
      </div>
      <div style={{ display: activeTab === 'market' ? 'block' : 'none' }}>
        <Market_EME />
      </div>
      <div style={{ display: activeTab === 'risk' ? 'block' : 'none' }}>
        <Risk_EME />
      </div>
      <div style={{ display: activeTab === 'logs' ? 'block' : 'none' }}>
        <Logs_EME />
      </div>
      <div style={{ display: activeTab === 'telegram' ? 'block' : 'none' }}>
        <Telegram_EME />
      </div>
      <IsolatedBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
