import { useMutation, useQueryClient } from "@/lib/query";
import { useServerFn } from "@/lib/server-fn";
import { toast } from "sonner";
import {
  runCampaignGenerator,
  runCompanyResearch,
  runDiscoverDecisionMakers,
  runEmailGenerator,
  runLeadScoring,
  runMeetingPrep,
  runMeetingRecap,
  runNextAction,
  runRevenueIntelligence,
  scheduleCampaign,
} from "@/lib/ai/agents.functions";

import { useWorkspace } from "@/hooks/use-workspace";

function useAIMutation<TVars extends object, TOut>(
  fn: (arg: { data: TVars & { workspaceId: string } }) => Promise<TOut>,
  successMessage: string,
  invalidate: string[],
) {
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      if (!workspaceId) throw new Error("No workspace");
      return fn({ data: { ...(vars as object), workspaceId } as TVars & { workspaceId: string } });
    },
    onSuccess: () => {
      toast.success(successMessage);
      qc.invalidateQueries({ queryKey: ["ai_jobs"] });
      qc.invalidateQueries({ queryKey: ["activity_logs"] });
      for (const key of invalidate) {
        qc.invalidateQueries({ queryKey: [key], refetchType: "all" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAIResearch() {
  const fn = useServerFn(runCompanyResearch);
  return useAIMutation<
    { url: string; companyId?: string; query?: string; force?: boolean },
    unknown
  >(fn as never, "Research complete", ["research_reports", "companies"]);
}

export function useAIDiscoverDecisionMakers() {
  const fn = useServerFn(runDiscoverDecisionMakers);
  return useAIMutation<{ companyId: string; count?: number }, unknown>(
    fn as never,
    "Decision makers discovered",
    ["leads", "contacts"],
  );
}

export type AIEmailType =
  | "cold"
  | "follow_up"
  | "pricing"
  | "proposal"
  | "meeting_recap"
  | "re_engagement"
  | "meeting_reminder"
  | "pricing_follow_up";

export function useAIEmail() {
  const fn = useServerFn(runEmailGenerator);
  return useAIMutation<
    {
      emailType: AIEmailType;
      leadId?: string;
      companyId?: string;
      campaignId?: string;
      context?: string;
      tone?: string;
      length?: "short" | "medium" | "long";
      save?: boolean;
    },
    unknown
  >(fn as never, "Draft ready", ["emails"]);
}

export function useAILeadScore() {
  const fn = useServerFn(runLeadScoring);
  return useAIMutation<{ leadId: string }, unknown>(fn as never, "Lead scored", ["leads"]);
}

export function useAIMeetingPrep() {
  const fn = useServerFn(runMeetingPrep);
  return useAIMutation<{ meetingId: string; force?: boolean }, unknown>(
    fn as never,
    "Meeting prep ready",
    ["meetings"],
  );
}

export function useAIMeetingRecap() {
  const fn = useServerFn(runMeetingRecap);
  return useAIMutation<{ meetingId: string; transcript?: string; force?: boolean }, unknown>(
    fn as never,
    "Meeting recap ready",
    ["meetings", "tasks"],
  );
}

export function useAINextAction() {
  const fn = useServerFn(runNextAction);
  return useAIMutation<{ dealId: string }, unknown>(fn as never, "Recommendation ready", [
    "crm_deals",
  ]);
}

export function useAICampaignGenerator() {
  const fn = useServerFn(runCampaignGenerator);
  return useAIMutation<
    {
      campaignId: string;
      channel?: "email" | "linkedin" | "multi";
      touches?: number;
      tone?: string;
      goal?: string;
      context?: string;
      leadId?: string;
      companyId?: string;
      ab?: boolean;
      force?: boolean;
    },
    unknown
  >(fn as never, "Campaign sequence ready", ["campaigns"]);
}

export function useScheduleCampaign() {
  const fn = useServerFn(scheduleCampaign);
  return useAIMutation<
    {
      campaignId: string;
      scheduledAt?: string | null;
      status?: "draft" | "scheduled" | "active" | "paused";
    },
    unknown
  >(fn as never, "Campaign updated", ["campaigns"]);
}

export function useAIRevenueIntelligence() {
  const fn = useServerFn(runRevenueIntelligence);
  return useAIMutation<{ force?: boolean }, unknown>(fn as never, "Revenue intelligence ready", [
    "ai_jobs",
  ]);
}
