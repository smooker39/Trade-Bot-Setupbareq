import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

// Mock data generator since we might not have full historical DB yet
const generateData = (startPrice: number, points: number) => {
  const data = [];
  let price = startPrice;
  const now = Date.now();
  for (let i = 0; i < points; i++) {
    price = price * (1 + (Math.random() - 0.5) * 0.02);
    data.push({
      time: now - (points - i) * 60000, // 1 min intervals
      price: price
    });
  }
  return data;
};

const data = generateData(42000, 60);

export function PriceChart() {
  return (
    <Card className="col-span-1 lg:col-span-2 border-border shadow-lg">
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Market Trend (1H)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[350px] w-full pt-0 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
            <XAxis 
              dataKey="time" 
              tickFormatter={(time) => format(time, "HH:mm")}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickMargin={10}
            />
            <YAxis 
              domain={['auto', 'auto']}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(val) => `$${val.toLocaleString()}`}
              width={80}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              labelFormatter={(label) => format(label, "PP HH:mm:ss")}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
