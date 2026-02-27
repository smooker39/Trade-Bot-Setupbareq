import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Percent } from "lucide-react";
import { riskManager } from "@/lib/riskManager";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface RiskSettingsData {
  maxConcurrentTrades: number;
  allocationPercentage: number;
}

export function RiskSettings() {
  const { toast } = useToast();
  const [maxTrades, setMaxTrades] = useState(2);
  const [allocation, setAllocation] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = useQuery<RiskSettingsData>({
    queryKey: ["/api/settings/risk"],
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (settings) {
      setMaxTrades(settings.maxConcurrentTrades);
      setAllocation(settings.allocationPercentage || 10);
      riskManager.updateConfig({ 
        maxConcurrentTrades: settings.maxConcurrentTrades,
        allocationPercentage: settings.allocationPercentage || 10
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/settings/risk", { 
        maxConcurrentTrades: maxTrades,
        allocationPercentage: allocation
      });

      riskManager.updateConfig({ 
        maxConcurrentTrades: maxTrades,
        allocationPercentage: allocation
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/settings/risk"] });

      toast({
        title: "Settings Saved",
        description: `Risk profile updated: ${maxTrades} trades, ${allocation}% allocation.`,
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-[#111] border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-mono flex items-center gap-2 text-muted-foreground uppercase">
            <Settings className="w-3 h-3 text-primary" />
            Execution Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-mono text-muted-foreground uppercase">
                Max Concurrent Trades
              </Label>
              <span className="text-lg font-bold text-primary tabular-nums">{maxTrades}</span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[maxTrades]}
              onValueChange={(v) => setMaxTrades(v[0])}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-mono text-muted-foreground uppercase">
                Capital Allocation
              </Label>
              <div className="flex items-center gap-1 text-primary">
                <span className="text-lg font-bold tabular-nums">{allocation}</span>
                <Percent className="w-3 h-3" />
              </div>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[allocation]}
              onValueChange={(v) => setAllocation(v[0])}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="w-full bg-primary text-black hover:bg-primary/90 font-bold uppercase tracking-widest text-[10px]"
          >
            <Save className="w-3 h-3 mr-2" />
            {isSaving ? "Synchronizing..." : "Update Risk Profile"}
          </Button>
        </CardContent>
      </Card>
      
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-3">
          <p className="text-[9px] text-primary/70 font-mono leading-relaxed uppercase">
            Notice: Changes to capital allocation will affect future trade entries immediately. 
            Existing positions remain governed by previous risk parameters.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
