import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { parseWithLogging } from "@/lib/utils";
import type { CreateBotRequest, UpdateBotRequest } from "@shared/schema";

export function useBots() {
  return useQuery({
    queryKey: [api.bots.list.path],
    queryFn: async () => {
      const res = await fetch(api.bots.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bots");
      const data = await res.json();
      return parseWithLogging(api.bots.list.responses[200], data, "bots.list");
    },
  });
}

export function useBot(id: number) {
  return useQuery({
    queryKey: [api.bots.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.bots.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch bot");
      const data = await res.json();
      return parseWithLogging(api.bots.get.responses[200], data, "bots.get");
    },
    enabled: !!id,
  });
}

export function useCreateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBotRequest) => {
      const validated = api.bots.create.input.parse(data);
      const res = await fetch(api.bots.create.path, {
        method: api.bots.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Validation failed");
        }
        throw new Error("Failed to create bot");
      }
      return parseWithLogging(api.bots.create.responses[201], await res.json(), "bots.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bots.list.path] });
    },
  });
}

export function useUpdateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateBotRequest) => {
      const validated = api.bots.update.input.parse(updates);
      const url = buildUrl(api.bots.update.path, { id });
      const res = await fetch(url, {
        method: api.bots.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update bot");
      return parseWithLogging(api.bots.update.responses[200], await res.json(), "bots.update");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.bots.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.bots.get.path, variables.id] });
    },
  });
}

export function useDeleteBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bots.delete.path, { id });
      const res = await fetch(url, {
        method: api.bots.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete bot");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bots.list.path] });
    },
  });
}

export function useStartBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bots.start.path, { id });
      const res = await fetch(url, {
        method: api.bots.start.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to start bot");
      return parseWithLogging(api.bots.start.responses[200], await res.json(), "bots.start");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.bots.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.bots.get.path, id] });
    },
  });
}

export function useStopBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bots.stop.path, { id });
      const res = await fetch(url, {
        method: api.bots.stop.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to stop bot");
      return parseWithLogging(api.bots.stop.responses[200], await res.json(), "bots.stop");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.bots.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.bots.get.path, id] });
    },
  });
}
