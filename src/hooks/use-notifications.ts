import { useMutation, useQuery, useQueryClient } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useWorkspace } from "./use-workspace";

export type NotificationKind =
  | "email_sent"
  | "research_completed"
  | "meeting_reminder"
  | "lead_score_updated"
  | "campaign_approved"
  | "crm_sync_completed"
  | "ai_job_completed"
  | "system";

export interface NotificationRow {
  id: string;
  user_id: string;
  workspace_id: string;
  type: NotificationKind | string | null;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(limit = 30) {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["notifications", workspaceId, user?.id, limit],
    enabled: !!user?.id && !!workspaceId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationRow[];
    },
  });
}

export function useUnreadNotificationCount() {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read_at).length;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id || !workspaceId) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("workspace_id", workspaceId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async (input: {
      kind: NotificationKind | string;
      title: string;
      body?: string;
      entity_type?: string;
      entity_id?: string;
    }) => {
      if (!user?.id || !workspaceId) return;
      const { error } = await supabase.from("notifications").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: input.kind,
        title: input.title,
        body: input.body ?? null,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
