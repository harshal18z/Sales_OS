import { createFileRoute } from "@/lib/router-compat";
import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  DollarSign,
  Gauge,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import {
  useAIJobs,
  useCampaigns,
  useCompanies,
  useDeals,
  useEmails,
  useLeads,
  useMeetings,
} from "@/hooks/use-data";
import { useAIRevenueIntelligence } from "@/hooks/use-ai";
import { EmptyState, PageHeader, SkeletonList } from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/analytics")({
  head: () => ({ meta: [{ title: "Analytics — SalesOS AI" }] }),
  component: AnalyticsPage,
});

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

type RevenueIntelligenceOutput = {
  executive_summary?: string;
  headline_metric?: { label: string; value: string; delta: string };
  insights?: {
    title: string;
    detail: string;
    sentiment: "positive" | "negative" | "neutral";
    metric?: string;
  }[];
  recommendations?: {
    title: string;
    detail: string;
    impact: "high" | "medium" | "low";
    area: string;
  }[];
  win_rate_prediction?: {
    next_30d_pct: number;
    confidence: "low" | "medium" | "high";
    drivers: string[];
  };
  forecast_narrative?: string;
  risk_narrative?: string;
  metrics?: {
    revenue?: {
      won_value: number;
      velocity_per_day: number;
      win_rate: number;
      trend: { month: string; value: number; count: number }[];
      trend_delta_pct: number;
    };
    pipeline?: {
      open_value: number;
      weighted_value: number;
      health_score: number;
      stalled_count: number;
      high_risk_count: number;
      open_count: number;
    };
    funnel_conversion?: { from: string; to: string; rate: number }[];
    forecast?: { days: number; value: number; deals: number }[];
    top_risks?: {
      id: string;
      name: string;
      value: number;
      stage: string;
      risk: number;
      reasons: string[];
    }[];
  };
  generated_at?: string;
  stage?: string;
};

function AnalyticsPage() {
  const { data: deals = [], isLoading: dL } = useDeals();
  const { data: emails = [], isLoading: eL } = useEmails();
  const { data: meetings = [], isLoading: mL } = useMeetings();
  const { data: leads = [] } = useLeads();
  const { data: campaigns = [] } = useCampaigns();
  const { data: companies = [] } = useCompanies();
  const { data: jobs = [] } = useAIJobs();
  const gen = useAIRevenueIntelligence();

  const isLoading = dL || eL || mL;

  const metrics = useMemo(() => {
    const totalPipeline = (deals as any[]).reduce((s, d) => s + Number(d.value ?? 0), 0);
    const won = (deals as any[]).filter((d) => d.stage === "won");
    const revenue = won.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const sent = (emails as any[]).filter((e) => e.status === "sent").length;
    const total = (emails as any[]).length;
    const replyRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    const meetingsCount = meetings.length;
    const qualified = (leads as any[]).filter((l) =>
      ["qualified", "engaged"].includes(l.stage),
    ).length;
    const conv = leads.length > 0 ? Math.round((qualified / leads.length) * 100) : 0;
    return { totalPipeline, revenue, replyRate, meetingsCount, conv };
  }, [deals, emails, meetings, leads]);

  const funnel = useMemo(() => {
    const total = leads.length;
    const engaged = (leads as any[]).filter((l) => l.stage === "engaged").length;
    const qualified = (leads as any[]).filter((l) => l.stage === "qualified").length;
    const won = (deals as any[]).filter((d) => d.stage === "won").length;
    return [
      { label: "Leads", value: total },
      { label: "Engaged", value: engaged },
      { label: "Qualified", value: qualified },
      { label: "Won", value: won },
    ];
  }, [leads, deals]);

  const dealsByStage = useMemo(() => {
    const stages = ["discovery", "qualified", "proposal", "negotiation", "won", "lost"];
    return stages.map((s) => ({
      stage: s,
      count: (deals as any[]).filter((d) => d.stage === s).length,
      value: (deals as any[])
        .filter((d) => d.stage === s)
        .reduce((sum, d) => sum + Number(d.value ?? 0), 0),
    }));
  }, [deals]);

  const maxStageValue = Math.max(1, ...dealsByStage.map((s) => s.value));
  const maxFunnel = Math.max(1, funnel[0].value);

  const hasAnyData =
    leads.length + companies.length + deals.length + emails.length + campaigns.length > 0;

  // Live AI job for revenue_intelligence.
  const riJob = useMemo(() => {
    const rows = (jobs as any[]).filter((j) => j.kind === "revenue_intelligence");
    const running = rows.find((j) => j.status === "queued" || j.status === "running");
    if (running) return running;
    return rows.find((j) => j.status === "completed") ?? null;
  }, [jobs]);

  const ri: RevenueIntelligenceOutput | null = useMemo(() => {
    if (!riJob?.output || typeof riJob.output !== "object") return null;
    if (riJob.status !== "completed") return null;
    return riJob.output as RevenueIntelligenceOutput;
  }, [riJob]);

  const riRunning = riJob && (riJob.status === "queued" || riJob.status === "running");
  const riProgress = Number(riJob?.progress ?? 0);
  const riStage = (riJob?.output as { stage?: string } | undefined)?.stage ?? "Working…";

  return (
    <div className="min-h-full">
      <PageHeader title="Analytics" subtitle="Executive view — computed from live data" />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <SkeletonList count={4} />
        ) : !hasAnyData ? (
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            description="Add leads, deals, or campaigns and analytics will populate here."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI icon={DollarSign} label="Pipeline" value={fmtMoney(metrics.totalPipeline)} />
              <KPI icon={TrendingUp} label="Revenue (won)" value={fmtMoney(metrics.revenue)} />
              <KPI icon={Mail} label="Send rate" value={`${metrics.replyRate}%`} />
              <KPI icon={Users} label="Conversion" value={`${metrics.conv}%`} />
            </div>

            {/* AI Revenue Intelligence */}
            <div className="rounded-xl border border-border bg-surface">
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <Brain className="h-3.5 w-3.5 text-foreground-muted" />
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                      AI Revenue Intelligence
                    </p>
                  </div>
                  <h3 className="mt-1 text-[15px] font-semibold text-foreground tracking-tight">
                    {ri?.headline_metric?.label ?? "Weekly executive summary"}
                  </h3>
                  {ri?.generated_at && !riRunning && (
                    <p className="mt-0.5 text-[11px] text-foreground-subtle">
                      Generated {new Date(ri.generated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => gen.mutate({ force: !!ri })}
                  disabled={gen.isPending || !!riRunning}
                  className="h-8 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 text-[12px] font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {gen.isPending || riRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : ri ? (
                    <RefreshCw className="h-3 w-3" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {ri ? "Regenerate" : "Generate"}
                </button>
              </div>

              {riRunning && (
                <div className="px-5 py-3 border-b border-border">
                  <div className="flex items-center justify-between text-[11px] text-foreground-muted">
                    <span>{riStage}</span>
                    <span>{riProgress}%</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${riProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {!ri && !riRunning && (
                <div className="px-5 py-8 text-center">
                  <p className="text-[12px] text-foreground-muted max-w-md mx-auto">
                    Generate a revenue forecast, pipeline health score, deal risk analysis, win-rate
                    prediction, and an executive summary from your live workspace data.
                  </p>
                </div>
              )}

              {ri && (
                <div className="p-5 space-y-5">
                  {/* Headline row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricTile
                      icon={Gauge}
                      label="Pipeline health"
                      value={`${ri.metrics?.pipeline?.health_score ?? 0}`}
                      suffix="/ 100"
                      tone={healthTone(ri.metrics?.pipeline?.health_score ?? 0)}
                    />
                    <MetricTile
                      icon={Target}
                      label="Win-rate (next 30d)"
                      value={`${ri.win_rate_prediction?.next_30d_pct ?? 0}%`}
                      hint={
                        ri.win_rate_prediction?.confidence
                          ? `${ri.win_rate_prediction.confidence} confidence`
                          : undefined
                      }
                    />
                    <MetricTile
                      icon={DollarSign}
                      label="Sales velocity"
                      value={fmtMoney(ri.metrics?.revenue?.velocity_per_day ?? 0)}
                      suffix="/day"
                    />
                    <MetricTile
                      icon={TrendingUp}
                      label="Trend Δ (MoM)"
                      value={`${ri.metrics?.revenue?.trend_delta_pct ?? 0}%`}
                      tone={
                        (ri.metrics?.revenue?.trend_delta_pct ?? 0) >= 0 ? "positive" : "negative"
                      }
                    />
                  </div>

                  {/* Executive summary */}
                  {ri.executive_summary && (
                    <div className="rounded-lg border border-border bg-surface-muted/40 p-4">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">
                        Executive summary
                      </p>
                      <p className="text-[13px] leading-relaxed text-foreground">
                        {ri.executive_summary}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-5">
                    {/* Forecast */}
                    <div className="col-span-12 lg:col-span-7 rounded-lg border border-border p-4">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
                        Revenue forecast
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {(ri.metrics?.forecast ?? []).map((f) => (
                          <div
                            key={f.days}
                            className="rounded-md border border-border bg-surface p-3"
                          >
                            <p className="text-[10px] text-foreground-subtle">Next {f.days}d</p>
                            <p className="mt-1 text-[17px] font-semibold text-foreground tracking-tight">
                              {fmtMoney(f.value)}
                            </p>
                            <p className="text-[10px] text-foreground-subtle">{f.deals} deals</p>
                          </div>
                        ))}
                      </div>
                      {ri.forecast_narrative && (
                        <p className="mt-3 text-[12px] text-foreground-muted leading-relaxed">
                          {ri.forecast_narrative}
                        </p>
                      )}

                      {/* Trend sparkline */}
                      {(ri.metrics?.revenue?.trend ?? []).length > 0 && (
                        <div className="mt-4">
                          <p className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-2">
                            6-month won revenue
                          </p>
                          <TrendBars data={ri.metrics!.revenue!.trend} />
                        </div>
                      )}
                    </div>

                    {/* Funnel conversion */}
                    <div className="col-span-12 lg:col-span-5 rounded-lg border border-border p-4">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
                        Funnel conversion
                      </p>
                      <div className="space-y-2.5">
                        {(ri.metrics?.funnel_conversion ?? []).map((c) => (
                          <div key={`${c.from}-${c.to}`}>
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="text-foreground capitalize">
                                {c.from} → {c.to}
                              </span>
                              <span className="text-foreground-muted">{c.rate}%</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                              <div
                                className="h-full bg-foreground rounded-full transition-all"
                                style={{ width: `${Math.min(100, c.rate)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Insights + Recommendations */}
                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-12 lg:col-span-6 rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-3 w-3 text-foreground-muted" />
                        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                          Insights explaining changes
                        </p>
                      </div>
                      <div className="space-y-3">
                        {(ri.insights ?? []).map((i, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            <SentimentDot sentiment={i.sentiment} />
                            <div className="min-w-0">
                              <p className="text-[12.5px] font-medium text-foreground">{i.title}</p>
                              <p className="text-[11.5px] text-foreground-muted leading-relaxed">
                                {i.detail}
                              </p>
                              {i.metric && (
                                <p className="mt-0.5 text-[10px] text-foreground-subtle">
                                  {i.metric}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-12 lg:col-span-6 rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-3 w-3 text-foreground-muted" />
                        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                          AI recommendations
                        </p>
                      </div>
                      <div className="space-y-3">
                        {(ri.recommendations ?? []).map((r, idx) => (
                          <div key={idx} className="rounded-md border border-border p-2.5">
                            <div className="flex items-center gap-2">
                              <ImpactPill impact={r.impact} />
                              <span className="text-[10px] text-foreground-subtle capitalize">
                                {r.area}
                              </span>
                            </div>
                            <p className="mt-1 text-[12.5px] font-medium text-foreground">
                              {r.title}
                            </p>
                            <p className="text-[11.5px] text-foreground-muted leading-relaxed">
                              {r.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Deal risk */}
                  {(ri.metrics?.top_risks ?? []).length > 0 && (
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-3 w-3 text-foreground-muted" />
                        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                          Deals at risk
                        </p>
                      </div>
                      {ri.risk_narrative && (
                        <p className="text-[12px] text-foreground-muted leading-relaxed mb-3">
                          {ri.risk_narrative}
                        </p>
                      )}
                      <div className="space-y-2">
                        {ri.metrics!.top_risks!.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                          >
                            <div
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                r.risk >= 70
                                  ? "bg-destructive"
                                  : r.risk >= 50
                                    ? "bg-warning"
                                    : "bg-foreground-subtle"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12.5px] font-medium text-foreground truncate">
                                {r.name}
                              </p>
                              <p className="text-[10.5px] text-foreground-subtle truncate">
                                {r.stage} · {r.reasons.join(" · ")}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[12px] font-medium text-foreground">
                                {fmtMoney(r.value)}
                              </p>
                              <p className="text-[10px] text-foreground-subtle">risk {r.risk}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Win-rate drivers */}
                  {ri.win_rate_prediction?.drivers && ri.win_rate_prediction.drivers.length > 0 && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
                        Win-rate drivers
                      </p>
                      <ul className="space-y-1.5">
                        {ri.win_rate_prediction.drivers.map((d, i) => (
                          <li
                            key={i}
                            className="text-[12px] text-foreground-muted flex items-start gap-2"
                          >
                            <span className="text-foreground-subtle mt-1">·</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-7 rounded-xl border border-border bg-surface p-5">
                <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-4">
                  Pipeline by stage
                </p>
                <div className="space-y-2.5">
                  {dealsByStage.map((s) => (
                    <div key={s.stage}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-foreground capitalize">{s.stage}</span>
                        <span className="text-foreground-muted">
                          {s.count} · {fmtMoney(s.value)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full bg-foreground rounded-full transition-all"
                          style={{ width: `${(s.value / maxStageValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-12 lg:col-span-5 rounded-xl border border-border bg-surface p-5">
                <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-4">
                  Conversion funnel
                </p>
                <div className="space-y-2">
                  {funnel.map((f) => (
                    <div key={f.label}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-foreground">{f.label}</span>
                        <span className="text-foreground-muted">{f.value}</span>
                      </div>
                      <div className="mt-1 h-3 rounded-md bg-surface-muted overflow-hidden">
                        <div
                          className="h-full bg-foreground rounded-md transition-all"
                          style={{ width: `${(f.value / maxFunnel) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat icon={Users} label="Leads" value={leads.length} />
              <MiniStat icon={Target} label="Campaigns" value={campaigns.length} />
              <MiniStat icon={Mail} label="Meetings" value={meetings.length} />
              <MiniStat icon={BarChart3} label="Companies" value={companies.length} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function healthTone(score: number): "positive" | "negative" | "neutral" {
  if (score >= 70) return "positive";
  if (score < 45) return "negative";
  return "neutral";
}

function MetricTile({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  tone = "neutral",
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const Trend = tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : null;
  return (
    <div className="rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-foreground-subtle">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[18px] font-semibold text-foreground tracking-tight">{value}</span>
        {suffix && <span className="text-[11px] text-foreground-subtle">{suffix}</span>}
        {Trend && (
          <Trend
            className={`h-3 w-3 ml-auto ${tone === "positive" ? "text-success" : "text-destructive"}`}
          />
        )}
      </div>
      {hint && <p className="mt-0.5 text-[10.5px] text-foreground-subtle capitalize">{hint}</p>}
    </div>
  );
}

function SentimentDot({ sentiment }: { sentiment: "positive" | "negative" | "neutral" }) {
  const c =
    sentiment === "positive"
      ? "bg-success"
      : sentiment === "negative"
        ? "bg-destructive"
        : "bg-foreground-subtle";
  return <span className={`h-1.5 w-1.5 rounded-full mt-2 shrink-0 ${c}`} />;
}

function ImpactPill({ impact }: { impact: "high" | "medium" | "low" }) {
  const map = {
    high: "border-success/20 bg-success/10 text-success",
    medium: "border-border bg-surface-muted text-foreground-muted",
    low: "border-border bg-surface text-foreground-subtle",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${map[impact]}`}
    >
      {impact} impact
    </span>
  );
}

function TrendBars({ data }: { data: { month: string; value: number; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-16">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full h-14 flex items-end">
            <div
              className="w-full bg-foreground/80 rounded-sm transition-all"
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
              title={fmtMoney(d.value)}
            />
          </div>
          <span className="text-[9.5px] text-foreground-subtle">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] text-foreground-subtle">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-[22px] font-semibold text-foreground tracking-tight">{value}</div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-surface-muted border border-border grid place-items-center">
        <Icon className="h-3.5 w-3.5 text-foreground-muted" />
      </div>
      <div>
        <p className="text-[11px] text-foreground-subtle">{label}</p>
        <p className="text-[15px] font-semibold text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  );
}
