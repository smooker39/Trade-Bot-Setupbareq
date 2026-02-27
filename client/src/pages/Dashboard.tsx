import { useBots } from "@/hooks/use-bots";
import { useTrades } from "@/hooks/use-trades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Activity, TrendingUp, DollarSign, Bot as BotIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: bots = [], isLoading: loadingBots } = useBots();
  const { data: trades = [], isLoading: loadingTrades } = useTrades();

  const activeBots = bots.filter(b => b.status === "active").length;
  const totalProfit = trades.reduce((sum, trade) => sum + Number(trade.profit || 0), 0);
  
  // Group trades by day for the chart
  const chartData = trades.reduce((acc: any[], trade) => {
    const date = format(new Date(trade.timestamp || Date.now()), 'MMM dd');
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.profit += Number(trade.profit || 0);
    } else {
      acc.push({ date, profit: Number(trade.profit || 0) });
    }
    return acc;
  }, []).slice(-7); // Last 7 days

  if (chartData.length === 0) {
    // Dummy data for visual presentation if no trades exist yet
    chartData.push(
      { date: 'Mon', profit: 120 },
      { date: 'Tue', profit: 250 },
      { date: 'Wed', profit: -80 },
      { date: 'Thu', profit: 420 },
      { date: 'Fri', profit: 850 },
      { date: 'Sat', profit: 600 },
      { date: 'Sun', profit: 1250 }
    );
  }

  const stats = [
    { title: "Total Bots", value: bots.length, icon: BotIcon, color: "text-blue-500" },
    { title: "Active Engines", value: activeBots, icon: Activity, color: "text-primary" },
    { title: "Total Profit", value: formatCurrency(totalProfit), icon: DollarSign, color: totalProfit >= 0 ? "text-primary" : "text-destructive" },
    { title: "Total Trades", value: trades.length, icon: TrendingUp, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Command Center</h1>
        <p className="mt-2 text-muted-foreground">Overview of your automated trading strategies and system performance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="hover:border-primary/30 transition-colors bg-card/40 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <stat.icon size={64} />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold font-display">{loadingBots ? "..." : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts & Recent Activity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2 glass-panel">
          <CardHeader>
            <CardTitle>Profit Generation (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Recent Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingTrades ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : trades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                  <p className="text-sm text-muted-foreground">No trades executed yet</p>
                </div>
              ) : (
                trades.slice(0, 6).map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${trade.type === 'buy' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                        {trade.type === 'buy' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold font-mono">{trade.symbol}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(trade.timestamp || Date.now()), 'HH:mm:ss')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(trade.price)}</p>
                      <p className={`text-xs ${Number(trade.profit) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {Number(trade.profit) >= 0 ? '+' : ''}{formatCurrency(trade.profit || 0)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
