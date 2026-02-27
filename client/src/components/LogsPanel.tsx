import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";
import { VirtualizedLogsList } from "./VirtualizedLogsList";

interface LogEntry {
  id: number;
  level: string;
  message: string;
  timestamp: string;
}

export const LogsPanel = memo(function LogsPanel() {
  const { data: logs, isLoading } = useQuery<LogEntry[]>({
    queryKey: ["/api/logs"],
    queryFn: async () => {
      const res = await fetch("/api/logs?limit=100");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const logCount = useMemo(() => logs?.length || 0, [logs?.length]);

  return (
    <div className="p-4 w-full max-w-full box-border">
      <Card 
        className="mobile-card border-0 shadow-2xl"
        style={{
          background: "rgba(13, 13, 13, 0.8)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0, 255, 255, 0.15)",
        }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground tracking-widest flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-neon-cyan" />
            SYSTEM LOGS
            {logCount > 0 && (
              <span className="ml-auto text-xs text-muted-foreground/60">
                {logCount} entries
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading logs...</p>
            </div>
          ) : (
            <VirtualizedLogsList 
              logs={logs || []} 
              height={Math.min(400, typeof window !== 'undefined' ? window.innerHeight * 0.5 : 300)}
              itemHeight={40}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
});
