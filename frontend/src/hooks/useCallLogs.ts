import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { Database } from "@/types/database";

type CallLog = Database["public"]["Tables"]["call_logs"]["Row"];

export function useCallLogs() {
  return useQuery<CallLog[]>({
    queryKey: ["callLogs"],
    queryFn: async () => {
      return api.callLogs.list();
    },
    staleTime: Infinity,
  });
}

export function useCallLog(leadId: string) {
  return useQuery<CallLog[]>({
    queryKey: ["callLogs", leadId],
    queryFn: async () => {
      return api.callLogs.getByLead(leadId);
    },
    enabled: !!leadId,
    staleTime: Infinity,
  });
}

export function useCreateCallLog() {
  const queryClient = useQueryClient();
  return useMutation<CallLog, Error, Omit<CallLog, "id" | "created_at">>({
    mutationFn: async (log) => {
      return api.callLogs.create(log);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callLogs"] });
    },
  });
}
