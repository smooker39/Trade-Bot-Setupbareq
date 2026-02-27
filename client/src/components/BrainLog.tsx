import { useSignals } from "@/hooks/use-trading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";
import { BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function BrainLog() {
  const { data: signals } = useSignals();

  // Sort by latest
  const sortedSignals = signals ? [...signals].sort((a, b) => 
    new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
  ) : [];

  return (
    <Card className="col-span-1 border-border shadow-lg flex flex-col h-[420px]">
      <CardHeader className="border-b border-border/50 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" />
            AI Decision Log
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {sortedSignals.length} events
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[350px] p-4">
          <div className="space-y-4">
            <AnimatePresence>
              {sortedSignals.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <p className="text-sm">No signals generated yet.</p>
                  <p className="text-xs mt-1">Waiting for market crossover...</p>
                </div>
              ) : (
                sortedSignals.map((signal) => (
                  <motion.div
                    key={signal.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-1 border-l-2 border-border pl-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">
                        {format(new Date(signal.timestamp!), "HH:mm:ss")}
                      </span>
                      <StatusBadge 
                        status={signal.action.toLowerCase() as any} 
                        className="text-[10px] px-1.5 py-0 h-5"
                      />
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-bold font-mono">
                        {signal.symbol}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        @ ${Number(signal.price).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground italic truncate">
                      {signal.reason || "Strategy signal trigger"}
                    </p>
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-border group-hover:bg-primary transition-colors" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
