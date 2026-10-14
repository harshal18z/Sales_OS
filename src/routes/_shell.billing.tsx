import { createFileRoute } from "@/lib/router-compat";
import { useQuery } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useState } from "react";
import { CreditCard, DollarSign, Mail, Sparkles, Users } from "lucide-react";
import { PageHeader, SkeletonList } from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/billing")({
  head: () => ({ meta: [{ title: "Billing — SalesOS AI" }] }),
  component: BillingPage,
});

function BillingPage() {
  const { workspace, workspaceId } = useWorkspace();
  const permissions = usePermissions();
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "business">("pro");
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  async function simulatePlan() {
    if (!workspaceId) return;
    setBillingBusy(true); setBillingError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in to continue.");
      const response = await fetch("/api/billing/mock-plan", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ workspaceId, plan: selectedPlan }),
      });
      const result = await response.json().catch(() => ({})) as { plan?: string; error?: string; charged?: boolean };
      if (!response.ok || !result.plan) throw new Error(result.error || "The demo plan could not be changed.");
      window.location.reload();
    } catch (error) { setBillingError((error as Error).message); }
    finally { setBillingBusy(false); }
  }
  const usage = useQuery({
    queryKey: ["billing-usage", workspaceId], enabled: !!workspaceId,
    queryFn: async () => {
      const table = supabase.from as any;
      const [members, companies, leads, deals, emails, jobs] = await Promise.all([
        table("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        table("companies").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null),
        table("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null),
        table("crm_deals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null),
        table("emails").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("deleted_at", null),
        table("ai_jobs").select("cost_usd,tokens_input,tokens_output,status,created_at").eq("workspace_id", workspaceId).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);
      for (const result of [members, companies, leads, deals, emails, jobs]) if (result.error) throw result.error;
      const completedJobs = (jobs.data ?? []).filter((job: any) => job.status === "completed");
      return {
        members: members.count ?? 0,
        companies: companies.count ?? 0,
        leads: leads.count ?? 0,
        deals: deals.count ?? 0,
        emails: emails.count ?? 0,
        aiJobs: completedJobs.length,
        aiCost: completedJobs.reduce((total: number, job: any) => total + Number(job.cost_usd ?? 0), 0),
        tokens: completedJobs.reduce((total: number, job: any) => total + Number(job.tokens_input ?? 0) + Number(job.tokens_output ?? 0), 0),
      };
    },
  });
  const plan = workspace?.plan || "Free";
  const data = usage.data;
  return <div className="min-h-full"><PageHeader title="Billing & usage" subtitle="Workspace plan and current product usage." /><main className="max-w-5xl space-y-5 p-6">
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] uppercase tracking-wide text-foreground-subtle">Current demo plan</p><h2 className="mt-2 text-2xl font-semibold capitalize">{plan}</h2><p className="mt-1 text-[12px] text-foreground-muted">For {workspace?.name || "your workspace"} · Demo mode — no payment is collected.</p></div><CreditCard className="h-6 w-6 text-foreground-subtle" /></div>{permissions.canManageBilling ? <div className="mt-5 rounded-lg border border-border bg-surface-muted/30 p-4"><p className="text-[12px] font-medium">Simulate a plan change</p><p className="mt-1 text-[11px] leading-5 text-foreground-muted">This changes the plan shown in the app for testing only. It does not create a subscription or charge anyone.</p><div className="mt-3 flex flex-wrap gap-2">{(["free", "pro", "business"] as const).map((item) => <button key={item} onClick={() => setSelectedPlan(item)} className={`rounded-md border px-3 py-2 text-[11px] capitalize ${selectedPlan === item ? "border-foreground bg-foreground text-background" : "border-border text-foreground-muted"}`}>{item}</button>)}<button onClick={simulatePlan} disabled={billingBusy} className="h-9 rounded-md bg-foreground px-4 text-[12px] font-medium text-background disabled:opacity-50">{billingBusy ? "Saving…" : "Apply demo plan"}</button></div>{billingError && <p role="alert" className="mt-3 text-[11px] text-destructive">{billingError}</p>}</div> : <div className="mt-5 rounded-lg border border-border bg-surface-muted/30 p-4 text-[11px] text-foreground-muted">Only workspace owners and admins can change the demo plan.</div>}</section>
    <section className="rounded-xl border border-border bg-surface p-5"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-foreground-muted" /><h2 className="text-[14px] font-semibold">Usage this month</h2></div>{usage.isLoading ? <SkeletonList count={4} /> : usage.error ? <p className="text-[12px] text-destructive">{(usage.error as Error).message}</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Usage icon={Users} label="Seats" value={data?.members ?? 0} /><Usage icon={DollarSign} label="AI jobs completed" value={data?.aiJobs ?? 0} /><Usage icon={Sparkles} label="AI tokens processed" value={Number(data?.tokens ?? 0).toLocaleString()} /><Usage icon={DollarSign} label="Recorded AI provider cost" value={`$${Number(data?.aiCost ?? 0).toFixed(4)}`} /><Usage icon={Mail} label="Emails stored" value={data?.emails ?? 0} /><Usage icon={Users} label="Leads and companies" value={`${data?.leads ?? 0} leads · ${data?.companies ?? 0} companies`} /></div>}</section>
    <p className="text-[11px] leading-5 text-foreground-subtle">Usage is calculated from workspace records and AI jobs. Provider cost is shown only when the AI workflow records a cost; it may be incomplete until server-side metering is configured.</p>
  </main></div>;
}
function Usage({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) { return <div className="rounded-lg border border-border bg-background p-4"><div className="flex items-center gap-2 text-[10.5px] text-foreground-subtle"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-2 text-[16px] font-semibold">{value}</p></div>; }
