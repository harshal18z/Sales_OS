import { useQuery } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useWorkspace } from "./use-workspace";

export type AppRole = "owner" | "admin" | "sales_manager" | "sales_rep" | "viewer";

const RANK: Record<AppRole, number> = {
  owner: 1,
  admin: 2,
  sales_manager: 3,
  sales_rep: 4,
  viewer: 5,
};

export interface Permissions {
  role: AppRole | null;
  isOwner: boolean;
  isAdmin: boolean; // owner or admin
  canManageMembers: boolean;
  canManageBilling: boolean;
  canManageSettings: boolean;
  canApproveCampaigns: boolean;
  canEditDeals: boolean;
  canWrite: boolean;
  atLeast: (r: AppRole) => boolean;
}

export function usePermissions(): Permissions & { loading: boolean } {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ["user_role", workspaceId, user?.id],
    enabled: !!workspaceId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("workspace_id", workspaceId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      if (roles.length === 0) return null;
      return roles.sort((a, b) => RANK[a] - RANK[b])[0];
    },
  });

  const role = data ?? null;
  const atLeast = (r: AppRole) => (role ? RANK[role] <= RANK[r] : false);

  return {
    role,
    loading: isLoading,
    isOwner: role === "owner",
    isAdmin: atLeast("admin"),
    canManageMembers: atLeast("admin"),
    canManageBilling: atLeast("admin"),
    canManageSettings: atLeast("admin"),
    canApproveCampaigns: atLeast("sales_manager"),
    canEditDeals: atLeast("sales_rep"),
    canWrite: atLeast("sales_rep"),
    atLeast,
  };
}
