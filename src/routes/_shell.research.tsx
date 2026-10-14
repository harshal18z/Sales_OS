import { createFileRoute } from "@/lib/router-compat";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { useAIJobs, useDeleteRow, useResearchReports, useResearchSources } from "@/hooks/use-data";
import { useAIResearch } from "@/hooks/use-ai";
import {
  EmptyState, Field, GhostBtn, Modal, PageHeader, PrimaryBtn, SkeletonList,
  TextInput,
} from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/research")({
  head: () => ({ meta: [{ title: "Research — SalesOS AI" }] }),
  component: ResearchPage,
});

function ResearchPage() {
  const { data: reports = [], isLoading } = useResearchReports();
  const { data: jobs = [] } = useAIJobs();
  const del = useDeleteRow("research_reports", "research_reports");
  const research = useAIResearch();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");

  const activeJob = (jobs as any[]).find(
    (j) => j.kind === "company_research" && (j.status === "queued" || j.status === "running"),
  );

  const selected =
    (reports as any[]).find((r) => r.id === selectedId) ?? (reports as any[])[0] ?? null;
  const { data: sources = [] } = useResearchSources(selected?.id ?? null);
  const report = selected?.report ?? {};

  async function handleAsk(force = false) {
    const target = force ? selected?.url : url;
    if (!target) return;
    try {
      await research.mutateAsync({
        url: target,
        query: force ? undefined : query || undefined,
        force,
      });
      setAsking(false);
      setUrl("");
      setQuery("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  async function handleDelete(id: string) {
    if (!confirm("Delete this report?")) return;
    try {
      await del.mutateAsync(id);
      setSelectedId(null);
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Research"
        subtitle={`${reports.length} report${reports.length === 1 ? "" : "s"}`}
        action={
          <PrimaryBtn onClick={() => setAsking(true)}>
            <Plus className="h-3.5 w-3.5" /> Ask AI
          </PrimaryBtn>
        }
      />

      <div className="grid grid-cols-12 gap-0 min-h-[calc(100vh-8rem)]">
        <aside className="col-span-12 lg:col-span-4 border-r border-border bg-surface/40">
          <div className="p-4">
            {isLoading ? (
              <SkeletonList count={4} />
            ) : reports.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No research yet"
                description="Enter a company URL to run the research pipeline."
                action={
                  <PrimaryBtn onClick={() => setAsking(true)}>
                    <Sparkles className="h-3.5 w-3.5" /> Ask AI
                  </PrimaryBtn>
                }
              />
            ) : (
              <div className="space-y-1.5">
                {(reports as any[]).map((r: any) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left rounded-lg border p-3 transition ${
                      selected?.id === r.id
                        ? "border-border-strong bg-surface"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {r.query}
                    </p>
                    <p className="text-[11px] text-foreground-subtle mt-0.5">
                      {r.status === "complete" ? (
                        <>
                          {r.industry ?? "Report"}
                          {typeof r.confidence_score === "number"
                            ? ` · ${r.confidence_score}% confidence`
                            : ""}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> {r.status}
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="col-span-12 lg:col-span-8">
          <div className="p-6">
            {!selected ? (
              <div className="text-[12px] text-foreground-subtle">Select a report.</div>
            ) : (
              <div className="max-w-3xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                      {selected.industry ?? "Query"}
                    </p>
                    <h2 className="text-[18px] font-semibold text-foreground mt-1 truncate">
                      {selected.query}
                    </h2>
                    {selected.url && (
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-foreground-muted hover:text-foreground inline-flex items-center gap-1 mt-1"
                      >
                        {selected.url} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GhostBtn
                      onClick={() => void handleAsk(true)}
                      disabled={research.isPending || !!activeJob}
                    >
                      {research.isPending || activeJob ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Refresh
                    </GhostBtn>
                    <GhostBtn onClick={() => handleDelete(selected.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </GhostBtn>
                  </div>
                </div>

                {activeJob && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle inline-flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {activeJob.output?.stage ?? "Researching…"}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                        {activeJob.progress ?? 0}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full bg-foreground transition-all"
                        style={{ width: `${Math.max(4, activeJob.progress ?? 0)}%` }}
                      />
                    </div>
                  </div>
                )}

                {(report.executive_summary || selected.summary) && (
                  <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                        Executive Summary
                      </p>
                      <div className="flex items-center gap-3">
                        {typeof report.icp_fit_score === "number" && (
                          <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                            ICP fit · {report.icp_fit_score}
                          </span>
                        )}
                        {typeof selected.confidence_score === "number" && (
                          <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                            {selected.confidence_score}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[13.5px] text-foreground leading-relaxed whitespace-pre-wrap">
                      {report.executive_summary || selected.summary}
                    </p>
                  </div>
                )}

                <KVGrid
                  items={[
                    ["Company", report.company_name],
                    ["Industry", report.industry],
                    ["Sub-industry", report.sub_industry],
                    ["Business model", report.business_model],
                    ["Headquarters", report.headquarters],
                    ["Company size", report.company_size],
                    ["Target customers", report.target_customers],
                    ["Ideal customer profile", report.ideal_customer_profile],
                    ["Recent funding", report.recent_funding],
                    ["Recommended outreach", report.recommended_outreach],
                  ]}
                />

                {report.social_links && Object.keys(report.social_links).length > 0 && (
                  <div className="rounded-xl border border-border bg-surface p-5">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">Social</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(report.social_links as Record<string, string>).map(([k, v]) =>
                        v ? (
                          <a key={k} href={v} target="_blank" rel="noreferrer"
                            className="text-[12px] rounded-full border border-border px-2.5 py-1 text-foreground-muted hover:text-foreground hover:border-border-strong inline-flex items-center gap-1">
                            {k} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}

                <ListSection title="Products" items={report.products} />
                <ListSection title="Technology stack" items={report.tech_stack} />
                <ListSection title="Competitive advantages" items={report.competitive_advantages} />
                <ListSection title="Hiring trends" items={report.hiring_trends} />
                <ListSection title="Competitors" items={report.competitors} />
                <ListSection title="Pain points" items={selected.pain_points ?? report.pain_points} />
                <ListSection title="Buying signals" items={report.buying_signals} />
                <ListSection title="Likely objections" items={report.objections} />
                <ListSection title="Sales opportunities" items={report.sales_opportunities ?? selected.opportunities} />
                <ListSection title="Outreach opportunities" items={report.outreach_opportunities} />
                <ObjSection title="Recent news" items={report.recent_news} keyField="title" noteField="note" />
                <ObjSection title="Decision makers" items={report.decision_makers} keyField="title" noteField="note" nameField="name" />

                <SourcesSection sources={sources as any[]} />

              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={asking} onClose={() => setAsking(false)} title="Research a company">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleAsk(); }}
          className="space-y-3"
        >
          <Field label="Company name or website">
            <TextInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Stripe or stripe.com"
              autoFocus
            />
          </Field>

          <Field label="What do you want to know? (optional)">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Growth strategy and buying signals"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <GhostBtn onClick={() => setAsking(false)}>Cancel</GhostBtn>
            <PrimaryBtn type="submit" disabled={!url || research.isPending}>
              {research.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Researching…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Run pipeline</>
              )}
            </PrimaryBtn>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function KVGrid({ items }: { items: [string, string | undefined | null][] }) {
  const valid = items.filter(([, v]) => v);
  if (!valid.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
      {valid.map(([k, v]) => (
        <div key={k}>
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1">{k}</p>
          <p className="text-[13px] text-foreground-muted leading-relaxed">{v}</p>
        </div>
      ))}
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: unknown }) {
  const arr = Array.isArray(items) ? (items as string[]) : [];
  if (!arr.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">{title}</p>
      <ul className="space-y-1.5">
        {arr.map((it, i) => (
          <li key={i} className="text-[13px] text-foreground-muted flex items-start gap-2">
            <span className="h-1 w-1 rounded-full bg-foreground-subtle mt-2 shrink-0" />
            <span>{typeof it === "string" ? it : JSON.stringify(it)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ObjSection({
  title, items, keyField, noteField, nameField,
}: {
  title: string;
  items: unknown;
  keyField: string;
  noteField: string;
  nameField?: string;
}) {
  const arr = Array.isArray(items) ? (items as Record<string, string>[]) : [];
  if (!arr.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">{title}</p>
      <ul className="space-y-2.5">
        {arr.map((it, i) => (
          <li key={i}>
            <p className="text-[13px] font-medium text-foreground">
              {nameField && it[nameField] ? `${it[nameField]} — ` : ""}
              {it[keyField]}
            </p>
            {it[noteField] && (
              <p className="text-[12px] text-foreground-subtle mt-0.5">{it[noteField]}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourcesSection({ sources }: { sources: any[] }) {
  if (!sources.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
        Sources · {sources.length}
      </p>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 text-foreground-subtle mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-foreground hover:underline inline-flex items-center gap-1 truncate max-w-full"
              >
                <span className="truncate">{s.title || s.url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <p className="text-[11px] text-foreground-subtle truncate">
                {s.provider}
                {s.published_date ? ` · ${new Date(s.published_date).toLocaleDateString()}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
