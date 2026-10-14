import { useMutation, useQueryClient } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reset a failed AI job to `queued` and bump retry_count so the worker
 * picks it up again on its next poll. Safe no-op if the job isn't failed.
 */
export function useRetryAIJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing, error: readErr } = await supabase
        .from("ai_jobs")
        .select("id, status, retry_count")
        .eq("id", id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!existing) throw new Error("Job not found");
      if (existing.status !== "failed") return;
      const { error } = await supabase
        .from("ai_jobs")
        .update({
          status: "queued",
          progress: 0,
          error: null,
          retry_count: (existing.retry_count ?? 0) + 1,
          started_at: null,
          completed_at: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_jobs"] }),
  });
}
