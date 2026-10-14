import { useQuery } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useWorkspace() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["current-workspace", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces:workspace_id(id,name,slug,plan)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.workspaces ?? null;
    },
  });
  return {
    workspace: query.data,
    workspaceId: (query.data as { id?: string } | null)?.id ?? null,
    isLoading: query.isLoading,
  };
}
