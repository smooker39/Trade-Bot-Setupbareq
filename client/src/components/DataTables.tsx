import { useTrades, useSystemLogs } from "@/hooks/use-trading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

function TradesTable() {
  const { data: trades, isLoading } = useTrades();

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  if (!trades?.length) return <div className="text-center p-8 text-muted-foreground">No trades executed yet.</div>;

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-mono text-xs">TIME</TableHead>
            <TableHead className="font-mono text-xs">SYMBOL</TableHead>
            <TableHead className="font-mono text-xs">SIDE</TableHead>
            <TableHead className="font-mono text-xs text-right">PRICE</TableHead>
            <TableHead className="font-mono text-xs text-right">AMOUNT</TableHead>
            <TableHead className="font-mono text-xs text-right">COST</TableHead>
            <TableHead className="font-mono text-xs">STRATEGY</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...trades].reverse().map((trade) => (
            <TableRow key={trade.id} className="hover:bg-muted/30">
              <TableCell className="font-mono text-xs text-muted-foreground">
                {format(new Date(trade.timestamp!), "MM/dd HH:mm:ss")}
              </TableCell>
              <TableCell className="font-bold">{trade.symbol}</TableCell>
              <TableCell>
                <StatusBadge 
                  status={trade.side.toLowerCase() as any} 
                  className="text-[10px] px-1.5 h-5"
                />
              </TableCell>
              <TableCell className="text-right font-mono">
                ${Number(trade.price).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {Number(trade.amount).toFixed(6)}
              </TableCell>
              <TableCell className="text-right font-mono">
                ${Number(trade.cost).toLocaleString()}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {trade.strategy}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LogsTable() {
  const { data: logs, isLoading } = useSystemLogs();

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  if (!logs?.length) return <div className="text-center p-8 text-muted-foreground">System logs empty.</div>;

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="font-mono text-xs w-[180px]">TIMESTAMP</TableHead>
            <TableHead className="font-mono text-xs w-[100px]">LEVEL</TableHead>
            <TableHead className="font-mono text-xs">MESSAGE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...logs].reverse().map((log) => (
            <TableRow key={log.id} className="hover:bg-muted/30">
              <TableCell className="font-mono text-xs text-muted-foreground">
                {format(new Date(log.timestamp!), "yyyy-MM-dd HH:mm:ss")}
              </TableCell>
              <TableCell>
                <StatusBadge 
                  status={log.level.toLowerCase() as any} 
                  className="text-[10px] px-1.5 h-5 w-full justify-center"
                />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {log.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DataTabs() {
  return (
    <Card className="col-span-1 lg:col-span-3 border-border shadow-lg mt-6">
      <CardContent className="p-6">
        <Tabs defaultValue="trades" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid w-[400px] grid-cols-2 bg-muted/50">
              <TabsTrigger value="trades">Trade History</TabsTrigger>
              <TabsTrigger value="logs">System Logs</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="trades" className="mt-0">
            <TradesTable />
          </TabsContent>
          <TabsContent value="logs" className="mt-0">
            <LogsTable />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
