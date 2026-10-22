import { createFileRoute } from "@/lib/router-compat";
import { useServerFn } from "@/lib/server-fn";
import { useMutation, useQueryClient } from "@/lib/query";
import { useState } from "react";
import { Sparkles, RotateCcw, Database, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { generateDemo, resetDemo } from "@/lib/demo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({ meta: [{ title: "Settings — SalesOS AI" }] }),
  component: SettingsPage,
});

type Counts = {
  companies: number;
  contacts: number;
  leads: number;
  deals: number;
  campaigns: number;
  meetings: number;
  emails: number;
  activities: number;
  research_reports: number;
};

function SettingsPage() {
  const { workspaceId, workspace } = useWorkspace();
  const qc = useQueryClient();
  const gen = useServerFn(generateDemo);
  const rst = useServerFn(resetDemo);
  const [lastCounts, setLastCounts] = useState<Counts | null>(null);

  const invalidateAll = () => {
    qc.invalidateQueries();
  };

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      const res = (await gen({ data: { workspaceId, reset: true } })) as {
        counts: Counts;
      };
      return res;
    },
    onSuccess: (res) => {
      setLastCounts(res.counts);
      invalidateAll();
      toast.success("Demo workspace ready", {
        description: `${res.counts.companies} companies · ${res.counts.leads} leads · ${res.counts.deals} deals`,
      });
    },
    onError: (e: any) => toast.error("Generation failed", { description: e.message }),
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      await rst({ data: { workspaceId } });
    },
    onSuccess: () => {
      setLastCounts(null);
      invalidateAll();
      toast.success("Demo data cleared");
    },
    onError: (e: any) => toast.error("Reset failed", { description: e.message }),
  });

  const busy = generateMut.isPending || resetMut.isPending;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-[13.5px] text-foreground-muted mt-1">
          Workspace{" "}
          {workspace?.name ? <span className="text-foreground">· {workspace.name}</span> : null}
        </p>
      </header>

      {/* Demo Workspace Generator */}
      <section className="rounded-lg border border-border bg-surface">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-accent/10 text-accent flex items-center justify-center">
            <Database className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-[15px] font-medium">Demo Workspace</h2>
            <p className="text-[13px] text-foreground-muted">
              Populate this workspace with realistic sample data to explore every module.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12.5px]">
            {[
              ["100", "Companies"],
              ["500", "Leads"],
              ["80", "Deals"],
              ["8", "Campaigns"],
              ["40", "Meetings"],
              ["300", "Emails"],
              ["200", "Activities"],
              ["60", "Research reports"],
              ["✓", "Lead AI scores"],
              ["✓", "Revenue forecast"],
              ["✓", "Dashboard analytics"],
            ].map(([n, l]) => (
              <li
                key={l}
                className="rounded-md border border-border bg-background px-3 py-2 flex items-center gap-2"
              >
                <span className="font-medium text-foreground">{n}</span>
                <span className="text-foreground-muted">{l}</span>
              </li>
            ))}
          </ul>

          {lastCounts && (
            <div className="rounded-md border border-border bg-background p-3 flex items-start gap-2 text-[13px]">
              <CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
              <div>
                <div className="font-medium">Demo data generated</div>
                <div className="text-foreground-muted">
                  {lastCounts.companies} companies · {lastCounts.contacts} contacts ·{" "}
                  {lastCounts.leads} leads · {lastCounts.deals} deals · {lastCounts.campaigns}{" "}
                  campaigns · {lastCounts.meetings} meetings · {lastCounts.emails} emails ·{" "}
                  {lastCounts.activities} activities · {lastCounts.research_reports} research
                  reports
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-[12.5px] text-foreground-muted">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
            <span>
              Reset removes only rows tagged as demo. Your real data is untouched. Generating
              re-runs a reset first.
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => generateMut.mutate()}
              disabled={!workspaceId || busy}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-md bg-accent text-accent-foreground text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {generateMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generateMut.isPending ? "Generating…" : "Generate demo data"}
            </button>
            <button
              onClick={() => resetMut.mutate()}
              disabled={!workspaceId || busy}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-md border border-border bg-background text-[13px] hover:border-border-strong disabled:opacity-50"
            >
              {resetMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {resetMut.isPending ? "Resetting…" : "Reset demo data"}
            </button>
          </div>
        </div>
      </section>

      {/* Other settings sections (placeholder) */}
      <section className="rounded-lg border border-border bg-surface p-5 space-y-2">
        <h2 className="text-[15px] font-medium">Workspace</h2>
        <p className="text-[13px] text-foreground-muted">
          General preferences, security, notifications, and AI guardrails — coming next.
        </p>
      </section>
    </div>
  );
}
