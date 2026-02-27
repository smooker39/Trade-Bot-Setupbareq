import { useTrades } from "@/hooks/use-trades";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useState } from "react";

export default function Trades() {
  const { data: trades = [], isLoading } = useTrades();
  const [search, setSearch] = useState("");

  const filteredTrades = trades.filter(t => 
    t.symbol.toLowerCase().includes(search.toLowerCase()) || 
    t.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Trade History</h1>
          <p className="mt-2 text-muted-foreground">Comprehensive ledger of all automated executions.</p>
        </div>
        <div className="w-full sm:w-72">
          <Input 
            placeholder="Search symbol..." 
            icon={<Search size={18} />} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Asset Pair</th>
                <th className="px-6 py-4 font-medium">Action</th>
                <th className="px-6 py-4 font-medium text-right">Size</th>
                <th className="px-6 py-4 font-medium text-right">Execution Price</th>
                <th className="px-6 py-4 font-medium text-right">Realized PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Syncing ledger...</td>
                </tr>
              ) : filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No execution records found matching your criteria.</td>
                </tr>
              ) : (
                filteredTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(trade.timestamp || Date.now()), 'MMM dd, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-foreground">
                      {trade.symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        trade.type === 'buy' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {trade.type === 'buy' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        {trade.type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-foreground">
                      {trade.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-foreground">
                      {formatCurrency(trade.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-medium">
                      <span className={Number(trade.profit) >= 0 ? "text-primary text-glow" : "text-destructive"}>
                        {Number(trade.profit) >= 0 ? "+" : ""}{formatCurrency(trade.profit || 0)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
