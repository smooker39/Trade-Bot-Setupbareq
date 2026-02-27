import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { parseWithLogging } from "@/lib/utils";

export function useTrades() {
  return useQuery({
    queryKey: [api.trades.list.path],
    queryFn: async () => {
      const res = await fetch(api.trades.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trades");
      const data = await res.json();
      return parseWithLogging(api.trades.list.responses[200], data, "trades.list");
    },
  });
}
