import { useMutation, useQuery, useQueryClient } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./use-workspace";

// Generic workspace-scoped list
function useWSList<T = unknown>(
  table: string,
  key: string,
  orderBy = "created_at",
  ascending = false,
) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: [key, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as never)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order(orderBy, { ascending });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useCampaigns() {
  return useWSList<any>("campaigns", "campaigns");
}
export function useCompanies() {
  return useWSList<any>("companies", "companies");
}
export function useContacts() {
  return useWSList<any>("contacts", "contacts");
}
export function useLeads() {
  return useWSList<any>("leads", "leads");
}
export function useEmails() {
  return useWSList<any>("emails", "emails");
}
export function useDeals() {
  return useWSList<any>("crm_deals", "crm_deals");
}
export function useResearchReports() {
  return useWSList<any>("research_reports", "research_reports");
}
export function useActivityLogs() {
  return useWSList<any>("activity_logs", "activity_logs");
}
export function useAIJobs() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["ai_jobs", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_jobs")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    // Poll every 1.5s while a job is queued or running so progress streams live.
    refetchInterval: (q) => {
      const rows = (q.state.data ?? []) as { status?: string }[];
      return rows.some((r) => r.status === "queued" || r.status === "running") ? 1500 : false;
    },
  });
}

export function useResearchSources(reportId: string | null | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["research_sources", reportId, workspaceId],
    enabled: !!workspaceId && !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_sources")
        .select("*")
        .eq("report_id", reportId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
export function useTasks() {
  return useWSList<any>("tasks", "tasks");
}
export function useNotifications() {
  return useWSList<any>("notifications", "notifications");
}

export function useMeetings() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["meetings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function logActivity(
  workspaceId: string,
  entity_type: string,
  entity_id: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      entity_type,
      entity_id,
      action,
      metadata: metadata as never,
    });
  } catch {
    /* non-fatal */
  }
}

export { logActivity };

export function useInsertRow<T = any>(table: string, invalidateKey: string) {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async (values: Partial<T>) => {
      if (!workspaceId) throw new Error("No workspace");
      const { data, error } = await supabase
        .from(table as never)
        .insert({ ...(values as any), workspace_id: workspaceId })
        .select()
        .single();
      if (error) throw error;
      await logActivity(workspaceId, table, (data as any)?.id ?? null, "create", {
        name: (data as any)?.name ?? (data as any)?.subject ?? (data as any)?.title ?? null,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

export function useUpdateRow<T = any>(table: string, invalidateKey: string) {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<T> }) => {
      const { data, error } = await (supabase.from(table as never) as any)
        .update(values as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      if (workspaceId) {
        await logActivity(workspaceId, table, id, "update", values as Record<string, unknown>);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

export function useDeleteRow(table: string, invalidateKey: string) {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(table as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
      if (workspaceId) {
        await logActivity(workspaceId, table, id, "delete");
      }
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      qc.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}
