import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriceDisplayProps {
  price: number;
  trend: string;
  high24h?: number;
  low24h?: number;
}

const formatPrice = (price: number): string => {
  if (price === 0) return '---';
  return `$${price.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

const TrendIcon = memo(function TrendIcon({ trend }: { trend: string }) {
  if (trend.includes('↑') || trend.includes('صعود')) {
    return <TrendingUp className="w-5 h-5 text-green-500" />;
  }
  if (trend.includes('↓') || trend.includes('هبوط')) {
    return <TrendingDown className="w-5 h-5 text-red-500" />;
  }
  return <Minus className="w-5 h-5 text-muted-foreground" />;
});

const PriceValue = memo(function PriceValue({ price }: { price: number }) {
  const formattedPrice = useMemo(() => formatPrice(price), [price]);
  
  return (
    <span 
      className="text-2xl font-bold tabular-nums text-cyan-400"
      data-testid="text-btc-price"
    >
      {formattedPrice}
    </span>
  );
});

const PriceChange = memo(function PriceChange({ trend }: { trend: string }) {
  const trendColor = useMemo(() => {
    if (trend.includes('↑') || trend.includes('صعود')) return 'text-green-500';
    if (trend.includes('↓') || trend.includes('هبوط')) return 'text-red-500';
    return 'text-muted-foreground';
  }, [trend]);
  
  return (
    <span className={`text-sm ${trendColor}`} data-testid="text-price-trend">
      {trend}
    </span>
  );
});

export const MemoizedPriceDisplay = memo(function MemoizedPriceDisplay({
  price,
  trend,
  high24h,
  low24h
}: PriceDisplayProps) {
  return (
    <div className="flex flex-col items-center space-y-1">
      <div className="flex items-center gap-2">
        <TrendIcon trend={trend} />
        <PriceValue price={price} />
      </div>
      <PriceChange trend={trend} />
      {(high24h !== undefined || low24h !== undefined) && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {high24h !== undefined && <span>H: {formatPrice(high24h)}</span>}
          {low24h !== undefined && <span>L: {formatPrice(low24h)}</span>}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.price === nextProps.price &&
    prevProps.trend === nextProps.trend &&
    prevProps.high24h === nextProps.high24h &&
    prevProps.low24h === nextProps.low24h
  );
});
