import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Poll health/status frequently (every 2 seconds)
export function useBotStatus() {
  return useQuery({
    queryKey: [api.status.get.path],
    queryFn: async () => {
      const res = await fetch(api.status.get.path);
      const data = await res.json();
      console.log("[API-DEBUG] BotStatus STATUS:", res.status);
      if (!res.ok && res.status >= 500) throw new Error("Server error fetching status");
      return api.status.get.responses[200].parse(data);
    },
    refetchInterval: 2000,
  });
}

// Control Bot (Start/Stop)
export function useBotControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (running: boolean) => {
      const res = await fetch(api.control.toggle.path, {
        method: api.control.toggle.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ running }),
      });
      if (!res.ok) throw new Error("Failed to toggle bot");
      return api.control.toggle.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Immediately update the status query with the new state
      queryClient.setQueryData([api.status.get.path], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          botStatus: {
            ...oldData.botStatus,
            isRunning: data.isRunning
          }
        };
      });
      queryClient.invalidateQueries({ queryKey: [api.status.get.path] });
    },
  });
}

// Fetch Trades History
export function useTrades() {
  return useQuery({
    queryKey: [api.trades.list.path],
    queryFn: async () => {
      const res = await fetch(api.trades.list.path);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return api.trades.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Refresh occasionally
  });
}

// Fetch Signals History
export function useSignals() {
  return useQuery({
    queryKey: [api.signals.list.path],
    queryFn: async () => {
      const res = await fetch(api.signals.list.path);
      if (!res.ok) throw new Error("Failed to fetch signals");
      return api.signals.list.responses[200].parse(await res.json());
    },
    refetchInterval: 3000, // Refresh often for "Brain" view
  });
}

// Fetch System Logs
export function useSystemLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    queryFn: async () => {
      const res = await fetch(api.logs.list.path);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}
