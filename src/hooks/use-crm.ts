import { useMutation, useQuery, useQueryClient } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./use-workspace";

export const CRM_PROVIDERS = ["hubspot", "salesforce", "pipedrive"] as const;
export type CRMProvider = (typeof CRM_PROVIDERS)[number];

export type CRMStatus = "disconnected" | "pending" | "connected" | "error";

export interface CRMIntegrationRow {
  id: string;
  provider: CRMProvider;
  status: CRMStatus;
  config: {
    last_synced_at?: string | null;
    last_error?: string | null;
    imported?: { companies?: number; contacts?: number; leads?: number; deals?: number };
  } | null;
  updated_at: string;
}

export function useCRMIntegrations() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ["crm-integrations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .in("provider", CRM_PROVIDERS as unknown as string[]);
      if (error) throw error;
      const byProvider = new Map<CRMProvider, CRMIntegrationRow>();
      (data ?? []).forEach((r) => {
        byProvider.set(r.provider as CRMProvider, r as unknown as CRMIntegrationRow);
      });
      return CRM_PROVIDERS.map<CRMIntegrationRow>((p) => {
        const row = byProvider.get(p);
        return (
          row ?? {
            id: `virtual-${p}`,
            provider: p,
            status: "disconnected",
            config: null,
            updated_at: "",
          }
        );
      });
    },
  });
}

export function useUpsertCRMIntegration() {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async (input: {
      provider: CRMProvider;
      status: CRMStatus;
      config?: CRMIntegrationRow["config"];
    }) => {
      if (!workspaceId) throw new Error("No workspace");
      // Look up an existing row (integrations has no unique constraint on
      // (workspace_id, provider) in the current schema, so upsert may not
      // dedupe — do an explicit fetch-and-update / insert.
      const { data: existing, error: selErr } = await supabase
        .from("integrations")
        .select("id, config")
        .eq("workspace_id", workspaceId)
        .eq("provider", input.provider)
        .limit(1)
        .maybeSingle();
      if (selErr) throw selErr;
      const merged = { ...(existing?.config as object | null), ...(input.config ?? {}) };
      if (existing?.id) {
        const { error } = await supabase
          .from("integrations")
          .update({ status: input.status, config: merged as never })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          workspace_id: workspaceId,
          provider: input.provider,
          status: input.status,
          config: merged as never,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-integrations", workspaceId] }),
  });
}

export function useManualCRMSync() {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async (provider: CRMProvider) => {
      if (!workspaceId) throw new Error("No workspace");
      const { data: row } = await supabase
        .from("integrations")
        .select("id, status, config")
        .eq("workspace_id", workspaceId)
        .eq("provider", provider)
        .limit(1)
        .maybeSingle();
      if (!row || row.status !== "connected") {
        throw new Error(
          `${provider[0].toUpperCase() + provider.slice(1)} is not connected. Configure OAuth to enable sync.`,
        );
      }
      const cfg = (row.config as Record<string, unknown> | null) ?? {};
      const nextConfig = { ...cfg, last_synced_at: new Date().toISOString(), last_error: null };
      const { error } = await supabase
        .from("integrations")
        .update({ config: nextConfig as never })
        .eq("id", row.id);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        workspace_id: workspaceId,
        entity_type: "integration",
        entity_id: row.id,
        action: `${provider}.manual_sync`,
        metadata: {} as never,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-integrations", workspaceId] }),
  });
}
