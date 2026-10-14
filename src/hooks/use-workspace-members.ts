import { useQuery } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";

export type WorkspaceMember = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
};

export function useWorkspaceMembers() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const { data: members, error } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      const rows = (members ?? []) as { user_id: string; role: string }[];
      if (rows.length === 0) return [];
      const ids = rows.map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const pmap = new Map<string, { full_name: string | null; email: string | null }>();
      for (const p of ((profs ?? []) as { id: string; full_name: string | null; email: string | null }[])) {
        pmap.set(p.id, { full_name: p.full_name, email: p.email });
      }
      return rows.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: pmap.get(m.user_id)?.full_name ?? null,
        email: pmap.get(m.user_id)?.email ?? null,
      }));
    },
  });
}
