import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { format } from 'date-fns';

interface LogEntry {
  id: number;
  level: string;
  message: string;
  timestamp: string;
}

interface VirtualizedLogsListProps {
  logs: LogEntry[];
  height?: number;
  itemHeight?: number;
}

const LogItem = memo(function LogItem({ log }: { log: LogEntry }) {
  const levelColor = useMemo(() => {
    switch (log.level.toLowerCase()) {
      case 'error':
        return 'text-red-500';
      case 'warn':
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-cyan-400';
      default:
        return 'text-muted-foreground';
    }
  }, [log.level]);

  const formattedTime = useMemo(() => {
    try {
      return format(new Date(log.timestamp), 'HH:mm:ss');
    } catch {
      return '--:--:--';
    }
  }, [log.timestamp]);

  return (
    <div 
      className="flex items-start gap-2 py-1 px-2 border-b border-border/30 text-xs font-mono hover:bg-accent/20 transition-colors"
      data-testid={`log-entry-${log.id}`}
    >
      <span className="text-muted-foreground shrink-0 w-16">
        {formattedTime}
      </span>
      <span className={`shrink-0 w-12 uppercase font-medium ${levelColor}`}>
        {log.level}
      </span>
      <span className="text-foreground/90 break-all">
        {log.message}
      </span>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.log.id === nextProps.log.id;
});

export const VirtualizedLogsList = memo(function VirtualizedLogsList({
  logs,
  height = 300,
  itemHeight = 32
}: VirtualizedLogsListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  
  const totalHeight = logs.length * itemHeight;
  const visibleCount = Math.ceil(height / itemHeight) + 2;
  
  const startIndex = useMemo(() => {
    return Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
  }, [scrollTop, itemHeight]);
  
  const endIndex = useMemo(() => {
    return Math.min(logs.length, startIndex + visibleCount);
  }, [logs.length, startIndex, visibleCount]);
  
  const visibleLogs = useMemo(() => {
    return logs.slice(startIndex, endIndex);
  }, [logs, startIndex, endIndex]);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
    
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setIsAutoScroll(isAtBottom);
  }, []);
  
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, isAutoScroll]);
  
  if (logs.length === 0) {
    return (
      <div 
        className="flex items-center justify-center h-full text-muted-foreground text-sm"
        style={{ height }}
      >
        No logs available
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className="overflow-y-auto bg-background/50 rounded border border-border/50"
      style={{ height }}
      onScroll={handleScroll}
      data-testid="virtualized-logs-container"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ 
          position: 'absolute', 
          top: startIndex * itemHeight,
          left: 0,
          right: 0
        }}>
          {visibleLogs.map((log) => (
            <LogItem key={log.id} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.logs.length !== nextProps.logs.length) return false;
  if (prevProps.logs.length === 0) return true;
  return prevProps.logs[0]?.id === nextProps.logs[0]?.id &&
         prevProps.logs[prevProps.logs.length - 1]?.id === nextProps.logs[nextProps.logs.length - 1]?.id;
});

export const SimpleLogsList = memo(function SimpleLogsList({ 
  logs,
  maxItems = 20 
}: { 
  logs: LogEntry[];
  maxItems?: number;
}) {
  const recentLogs = useMemo(() => {
    return logs.slice(0, maxItems);
  }, [logs, maxItems]);
  
  if (recentLogs.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-4">
        No logs available
      </div>
    );
  }
  
  return (
    <div className="space-y-0" data-testid="simple-logs-list">
      {recentLogs.map((log) => (
        <LogItem key={log.id} log={log} />
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  const prevFirst = prevProps.logs[0]?.id;
  const nextFirst = nextProps.logs[0]?.id;
  return prevFirst === nextFirst && prevProps.logs.length === nextProps.logs.length;
});
