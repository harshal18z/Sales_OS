import { createFileRoute } from "@/lib/router-compat";
import { useEffect, useMemo, useState } from "react";
import { useCampaigns, useEmails, useInsertRow, useDeleteRow, useAIJobs } from "@/hooks/use-data";
import { useAICampaignGenerator, useScheduleCampaign } from "@/hooks/use-ai";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  Upload,
  Building2,
  Users,
  Mail,
  Calendar,
  Target,
  Sparkles,
  PenLine,
  Send,
  Clock,
  UserSearch,
  Database,
  CheckCircle2,
  Eye,
  Pencil,
  X,
  Pause,
  Play,
  Copy,
  Download,
  Archive,
  GripVertical,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Loader2,
  CircleDot,
  ChevronRight,
  CalendarClock,
  Wand2,
  Linkedin,
} from "lucide-react";

export const Route = createFileRoute("/_shell/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — SalesOS AI" }] }),
  component: CampaignsPage,
});

type Campaign = {
  id: string;
  name: string;
  status: "Active" | "Paused" | "Draft";
  companies: number;
  emails: number;
  replyRate: number;
  meetings: number;
  owner: string;
  updated: string;
  goal: string;
  icp: string;
  progress: number;
  eta: string;
  pipeline: string;
  revenue: string;
};

function mapCampaign(row: any): Campaign {
  const stats = (row.stats ?? {}) as Record<string, any>;
  const s = (row.status ?? "draft").toLowerCase();
  const status: Campaign["status"] =
    s === "active" ? "Active" : s === "paused" ? "Paused" : "Draft";
  return {
    id: row.id,
    name: row.name,
    status,
    companies: Number(stats.companies ?? 0),
    emails: Number(stats.emails ?? 0),
    replyRate: Number(stats.replyRate ?? 0),
    meetings: Number(stats.meetings ?? 0),
    owner: stats.owner ?? "—",
    updated: new Date(row.updated_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    goal: row.goal ?? row.description ?? "—",
    icp: stats.icp ?? "—",
    progress: Number(stats.progress ?? 0),
    eta: stats.eta ?? "—",
    pipeline: stats.pipeline ?? "—",
    revenue: stats.revenue ?? "—",
  };
}

const INITIAL_STEPS = [
  {
    icon: Building2,
    label: "Research Companies",
    detail: "Firmographics · funding · hiring signals",
  },
  {
    icon: UserSearch,
    label: "Find Decision Makers",
    detail: "Title, seniority & buying committee mapping",
  },
  { icon: Database, label: "Enrich Contact Data", detail: "Verified email + mobile + LinkedIn" },
  {
    icon: PenLine,
    label: "Generate Personalized Email",
    detail: "GPT-tuned to voice + recent trigger",
  },
  { icon: Eye, label: "Review Draft", detail: "Human-in-the-loop approval" },
  { icon: Send, label: "Send", detail: "Warmed inbox · optimal send time" },
  { icon: Clock, label: "Wait 3 Days", detail: "Adaptive to engagement signals" },
  { icon: Sparkles, label: "Generate Follow-up", detail: "Context-aware reply, references thread" },
  { icon: Calendar, label: "Book Meeting", detail: "Auto-schedule via calendar sync" },
];

const AI_ACTIVITY = [
  { text: "Researching Stripe", target: "Series A SaaS", pct: 72 },
  { text: "Finding VP Engineering at Ramp", target: "Series A SaaS", pct: 44 },
  { text: "Writing email to Dr. Patel · Mount Sinai", target: "Healthcare Outreach", pct: 88 },
  { text: "Checking hiring signals · Notion", target: "Recruiter Outreach", pct: 31 },
  { text: "Enriching 42 contacts · Databricks", target: "Series A SaaS", pct: 61 },
  { text: "Updating CRM · 18 records", target: "System", pct: 95 },
];

const PERF = [
  { label: "Emails", value: "1,284", delta: "+12.4%", series: [4, 6, 5, 8, 7, 10, 12] },
  { label: "Replies", value: "182", delta: "+8.1%", series: [2, 3, 3, 4, 5, 5, 7] },
  { label: "Meetings", value: "22", delta: "+3.2%", series: [1, 1, 2, 2, 3, 3, 4] },
  { label: "Pipeline", value: "$2.4M", delta: "+18.9%", series: [5, 6, 8, 9, 11, 13, 16] },
  { label: "Conversion", value: "14.2%", delta: "+1.6%", series: [8, 9, 10, 11, 12, 13, 14] },
];

function CampaignsPage() {
  const { data: dbCampaigns = [], isLoading } = useCampaigns();
  const CAMPAIGNS = useMemo<Campaign[]>(() => dbCampaigns.map(mapCampaign), [dbCampaigns]);
  const { data: dbEmails = [] } = useEmails();
  const { data: aiJobs = [] } = useAIJobs();
  const createCampaign = useInsertRow("campaigns", "campaigns");
  useDeleteRow("campaigns", "campaigns"); // reserved for future delete flow

  const genCampaign = useAICampaignGenerator();
  const scheduleCampaignFn = useScheduleCampaign();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [activity, setActivity] = useState(AI_ACTIVITY);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiChannel, setAiChannel] = useState<"email" | "linkedin" | "multi">("email");
  const [aiTouches, setAiTouches] = useState(5);
  const [aiTone, setAiTone] = useState("direct");
  const [aiGoal, setAiGoal] = useState("");
  const [aiCtx, setAiCtx] = useState("");
  const [aiAB, setAiAB] = useState(false);

  useEffect(() => {
    if (!selectedId && CAMPAIGNS.length > 0) setSelectedId(CAMPAIGNS[0].id);
  }, [CAMPAIGNS, selectedId]);

  const filtered = CAMPAIGNS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const selected = CAMPAIGNS.find((c) => c.id === selectedId) ?? CAMPAIGNS[0] ?? null;
  const selectedRow = (dbCampaigns as any[]).find((c) => c.id === selectedId) ?? null;
  const aiSeq = (selectedRow?.ai_sequence ?? null) as null | {
    summary?: string;
    audience?: string;
    personalization_score?: number;
    best_send_window?: string;
    spam_score_avg?: number;
    steps?: Array<{
      step: number;
      day_offset: number;
      channel: "email" | "linkedin";
      type?: string;
      subject?: string;
      subject_variants?: string[];
      body: string;
      cta?: string;
      cta_suggestions?: string[];
      best_send_time?: string;
      spam_score?: number;
      variant_b?: { subject?: string; body: string; cta?: string } | null;
    }>;
  };
  const liveJob = useMemo(() => {
    return (
      (aiJobs as any[])
        .filter((j) => j.kind === "campaign_generator" && j.entity_id === selectedId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ??
      null
    );
  }, [aiJobs, selectedId]);
  const jobRunning = liveJob && (liveJob.status === "queued" || liveJob.status === "running");

  const approvalRows = useMemo(
    () =>
      (dbEmails as any[])
        .filter((e) => e.status === "pending" || e.status === "draft")
        .slice(0, 6)
        .map((e) => ({
          lead: e.subject?.split(" — ")[1] ?? "Lead",
          company: e.campaign_id ? "Campaign" : "—",
          subject: e.subject ?? "(no subject)",
          score: e.personalization_score ?? 80,
          tone: e.tone ?? "Warm",
        })),
    [dbEmails],
  );

  async function handleCreate() {
    const name = window.prompt("Campaign name?");
    if (!name) return;
    try {
      await createCampaign.mutateAsync({ name, status: "draft" } as any);
      toast.success("Campaign created");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleGenerate(force = false) {
    if (!selectedId) return;
    setAiOpen(false);
    try {
      await genCampaign.mutateAsync({
        campaignId: selectedId,
        channel: aiChannel,
        touches: aiTouches,
        tone: aiTone,
        goal: aiGoal || undefined,
        context: aiCtx || undefined,
        ab: aiAB,
        force,
      });
    } catch {
      /* handled by toast in hook */
    }
  }

  async function handleSchedule() {
    if (!selectedId) return;
    const val = window.prompt(
      "Schedule campaign at (ISO date-time, e.g. 2026-07-25T09:00:00Z). Leave blank to unschedule.",
      selectedRow?.scheduled_at ?? "",
    );
    if (val === null) return;
    const iso = val.trim() ? new Date(val).toISOString() : null;
    await scheduleCampaignFn.mutateAsync({
      campaignId: selectedId,
      scheduledAt: iso,
      status: iso ? "scheduled" : "draft",
    });
  }

  useEffect(() => {
    const id = setInterval(() => {
      setActivity((prev) =>
        prev.map((a) => {
          const next = a.pct + Math.random() * 6;
          return { ...a, pct: next > 100 ? 20 + Math.random() * 30 : next };
        }),
      );
    }, 1400);
    return () => clearInterval(id);
  }, []);

  function onDragStart(i: number) {
    setDragIdx(i);
  }
  function onDrop(i: number) {
    if (dragIdx === null || dragIdx === i) return;
    setSteps((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(i, 0, item);
      return next;
    });
    setDragIdx(null);
  }

  if (!isLoading && CAMPAIGNS.length === 0) {
    return (
      <div className="min-h-full grid place-items-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-surface-muted border border-border grid place-items-center">
            <Target className="h-5 w-5 text-foreground-muted" />
          </div>
          <h1 className="mt-5 text-[18px] font-semibold text-foreground">No campaigns yet</h1>
          <p className="mt-2 text-[13px] text-foreground-muted">
            Create your first campaign to start orchestrating AI-powered outreach.
          </p>
          <button
            onClick={handleCreate}
            className="mt-6 h-9 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-4 text-[13px] font-medium hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Create Campaign
          </button>
        </div>
      </div>
    );
  }

  if (!selected) {
    return <div className="p-8 text-caption">Loading campaigns…</div>;
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* TOP BAR */}
      <div className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3 px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-surface-muted grid place-items-center border border-border">
              <Target className="h-4 w-4 text-foreground-muted" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-semibold text-foreground truncate">
                  {selected.name}
                </h1>
                <StatusPill status={selected.status} />
              </div>
              <p className="text-xs text-foreground-subtle truncate">{selected.icp}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search campaigns"
                className="h-8 w-56 rounded-md bg-surface-muted border border-border pl-8 pr-3 text-xs text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <IconBtn label="Filters">
              <Filter className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Import Leads">
              <Upload className="h-3.5 w-3.5" />
            </IconBtn>
            <button
              onClick={handleCreate}
              className="h-8 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 text-xs font-medium hover:opacity-90 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Campaign
            </button>
          </div>
        </div>
      </div>

      {/* THREE COLUMN */}
      <div className="grid grid-cols-12 gap-0 flex-1 min-h-0">
        {/* LEFT — Campaign list */}
        <aside className="col-span-12 lg:col-span-3 border-r border-border bg-surface/40">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-foreground-subtle font-medium">
              Campaigns · {filtered.length}
            </span>
            <button className="text-foreground-subtle hover:text-foreground transition">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-2 pb-4 space-y-1">
            {filtered.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-lg px-3 py-3 border transition group ${
                    active
                      ? "bg-surface border-border-strong shadow-sm"
                      : "bg-transparent border-transparent hover:bg-surface hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground truncate">
                      {c.name}
                    </span>
                    <StatusDot status={c.status} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] text-foreground-subtle">
                    <Meta icon={Building2} value={`${c.companies} co.`} />
                    <Meta icon={Mail} value={`${c.emails.toLocaleString()} sent`} />
                    <Meta icon={ArrowUpRight} value={`${c.replyRate}% reply`} />
                    <Meta icon={Calendar} value={`${c.meetings} mtg`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-foreground-subtle">
                    <span className="truncate">{c.owner}</span>
                    <span>{c.updated}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER */}
        <section className="col-span-12 lg:col-span-6 min-w-0">
          <div className="p-6 space-y-6">
            {/* Overview */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[11px] uppercase tracking-wider text-foreground-subtle font-medium">
                    Campaign Goal
                  </span>
                  <p className="mt-1 text-[14px] text-foreground leading-relaxed">
                    {selected.goal}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] uppercase tracking-wider text-foreground-subtle font-medium">
                    Est. completion
                  </span>
                  <p className="mt-1 text-[14px] text-foreground font-medium">{selected.eta}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] text-foreground-subtle mb-1.5">
                  <span>Progress</span>
                  <span className="text-foreground font-medium">{selected.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
                <Stat label="Active AI agents" value="6" icon={Sparkles} />
                <Stat label="Pipeline generated" value={selected.pipeline} icon={TrendingUp} />
                <Stat label="Meetings booked" value={`${selected.meetings}`} icon={Calendar} />
                <Stat label="Revenue potential" value={selected.revenue} icon={DollarSign} />
              </div>
            </div>

            {/* Sequence builder */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-foreground">AI Sequence Builder</h3>
                  <p className="text-[11px] text-foreground-subtle mt-0.5">
                    {aiSeq
                      ? `${aiSeq.steps?.length ?? 0}-touch ${selectedRow?.channel ?? "email"} sequence · ${aiSeq.best_send_window ?? "optimal send window"}`
                      : "Drag steps to reorder. Every step is powered by an AI agent."}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setAiOpen(true)}
                    disabled={!!jobRunning}
                    className="h-7 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 text-[11px] font-medium text-foreground hover:border-border-strong disabled:opacity-50"
                  >
                    <Wand2 className="h-3 w-3" />
                    {aiSeq ? "Regenerate" : "Generate with AI"}
                  </button>
                  <button className="text-[11px] text-foreground-muted hover:text-foreground inline-flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add step
                  </button>
                </div>
              </div>

              {jobRunning && (
                <div className="mt-3 rounded-md border border-border bg-surface-muted/50 px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="truncate">
                      {(liveJob?.output as any)?.stage ?? "Working…"}
                    </span>
                    <span className="ml-auto tabular-nums">{liveJob?.progress ?? 0}%</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${liveJob?.progress ?? 0}%` }}
                    />
                  </div>
                </div>
              )}

              {aiSeq &&
                (aiSeq.personalization_score !== undefined ||
                  aiSeq.spam_score_avg !== undefined) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    {aiSeq.personalization_score !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-foreground-muted">
                        <Sparkles className="h-3 w-3" /> Personalization{" "}
                        {aiSeq.personalization_score}
                      </span>
                    )}
                    {aiSeq.spam_score_avg !== undefined && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
                          aiSeq.spam_score_avg <= 20
                            ? "border-success/20 bg-success/10 text-success"
                            : aiSeq.spam_score_avg <= 45
                              ? "border-border bg-surface-muted text-foreground-muted"
                              : "border-warning/20 bg-warning/10 text-warning"
                        }`}
                      >
                        Spam risk {aiSeq.spam_score_avg}
                      </span>
                    )}
                    {aiSeq.best_send_window && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-foreground-muted">
                        <Clock className="h-3 w-3" /> {aiSeq.best_send_window}
                      </span>
                    )}
                    {selectedRow?.scheduled_at && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-foreground-muted">
                        <CalendarClock className="h-3 w-3" /> Scheduled{" "}
                        {new Date(selectedRow.scheduled_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

              {aiSeq && aiSeq.steps && aiSeq.steps.length > 0 ? (
                <div className="mt-4 space-y-1.5">
                  {aiSeq.steps.map((s, i) => (
                    <SequenceStep key={i} idx={i} total={aiSeq.steps!.length} step={s} />
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-1.5">
                  {steps.map((s, i) => (
                    <div key={s.label}>
                      <div
                        draggable
                        onDragStart={() => onDragStart(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDrop(i)}
                        className={`group flex items-center gap-3 rounded-lg border border-border bg-surface hover:border-border-strong transition px-3 py-2.5 cursor-grab active:cursor-grabbing ${
                          dragIdx === i ? "opacity-40" : ""
                        }`}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-foreground-subtle opacity-0 group-hover:opacity-100 transition" />
                        <div className="h-7 w-7 rounded-md bg-surface-muted grid place-items-center border border-border">
                          <s.icon className="h-3.5 w-3.5 text-foreground-muted" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-foreground">
                              {s.label}
                            </span>
                            <span className="text-[10px] font-medium text-foreground-subtle bg-surface-muted rounded px-1.5 py-0.5">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </div>
                          <p className="text-[11px] text-foreground-subtle truncate">{s.detail}</p>
                        </div>
                        <CheckCircle2 className="h-3.5 w-3.5 text-foreground-subtle" />
                      </div>
                      {i < steps.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <div className="h-3 w-px bg-border" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">
                    Campaign Performance
                  </h3>
                  <p className="text-[11px] text-foreground-subtle mt-0.5">Last 7 days</p>
                </div>
                <div className="text-[11px] text-foreground-subtle">Live</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {PERF.map((p) => (
                  <div key={p.label} className="rounded-lg border border-border p-3">
                    <span className="text-[11px] text-foreground-subtle">{p.label}</span>
                    <div className="mt-1 text-[18px] font-semibold text-foreground tracking-tight">
                      {p.value}
                    </div>
                    <div className="mt-2 flex items-end gap-0.5 h-8">
                      {p.series.map((v, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-foreground/80 rounded-sm"
                          style={{
                            height: `${(v / Math.max(...p.series)) * 100}%`,
                            opacity: 0.35 + i * 0.09,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 text-[11px] text-foreground-muted">{p.delta}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approval Queue */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">Approval Queue</h3>
                  <p className="text-[11px] text-foreground-subtle mt-0.5">
                    {approvalRows.length} AI-generated emails awaiting review
                  </p>
                </div>
                <button className="text-[11px] font-medium text-foreground hover:opacity-80 inline-flex items-center gap-1">
                  Approve all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="divide-y divide-border">
                {approvalRows.length === 0 && (
                  <div className="px-5 py-10 text-center text-[12px] text-foreground-subtle">
                    No emails awaiting approval.
                  </div>
                )}
                {approvalRows.map((e, idx) => (
                  <div key={idx} className="px-5 py-3.5 hover:bg-surface-muted/40 transition group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface-muted border border-border grid place-items-center text-[11px] font-medium text-foreground-muted shrink-0">
                        {e.lead
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground truncate">
                            {e.lead}
                          </span>
                          <span className="text-[11px] text-foreground-subtle">·</span>
                          <span className="text-[12px] text-foreground-muted truncate">
                            {e.company}
                          </span>
                        </div>
                        <p className="text-[12px] text-foreground-subtle truncate">{e.subject}</p>
                      </div>
                      <ScoreChip score={e.score} />
                      <div className="hidden md:flex items-center gap-1">
                        <MiniBtn label="Preview">
                          <Eye className="h-3 w-3" />
                        </MiniBtn>
                        <MiniBtn label="Edit">
                          <Pencil className="h-3 w-3" />
                        </MiniBtn>
                        <MiniBtn label="Reject">
                          <X className="h-3 w-3" />
                        </MiniBtn>
                        <button className="h-7 inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2.5 text-[11px] font-medium hover:opacity-90">
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-foreground-subtle font-medium mr-2">
                Quick actions
              </span>
              <button
                onClick={handleSchedule}
                className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs text-foreground-muted hover:text-foreground hover:border-border-strong transition"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {selectedRow?.scheduled_at ? "Reschedule" : "Schedule"}
              </button>
              <QuickAction icon={Pause} label="Pause" />
              <QuickAction icon={Play} label="Resume" />
              <QuickAction icon={Copy} label="Duplicate" />
              <QuickAction icon={Download} label="Export" />
              <QuickAction icon={Archive} label="Archive" />
            </div>
          </div>
        </section>

        {/* RIGHT — Live AI activity */}
        <aside className="col-span-12 lg:col-span-3 border-l border-border bg-surface/40">
          <div className="px-4 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground" />
              </span>
              <span className="text-[11px] uppercase tracking-wider text-foreground font-medium">
                Live AI Activity
              </span>
            </div>
            <span className="text-[11px] text-foreground-subtle">6 agents</span>
          </div>

          <div className="p-3 space-y-2">
            {activity.map((a, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-foreground-muted animate-spin mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-foreground truncate">{a.text}</p>
                    <p className="text-[11px] text-foreground-subtle truncate">{a.target}</p>
                  </div>
                </div>
                <div className="mt-2 h-1 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, a.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-border">
            <p className="text-[11px] text-foreground-subtle leading-relaxed">
              AI agents run continuously in the background. Approvals are the only human touchpoint.
            </p>
          </div>
        </aside>
      </div>

      {aiOpen && (
        <AICopilotModal
          onClose={() => setAiOpen(false)}
          channel={aiChannel}
          setChannel={setAiChannel}
          touches={aiTouches}
          setTouches={setAiTouches}
          tone={aiTone}
          setTone={setAiTone}
          goal={aiGoal}
          setGoal={setAiGoal}
          ctx={aiCtx}
          setCtx={setAiCtx}
          ab={aiAB}
          setAB={setAiAB}
          onGenerate={() => handleGenerate(true)}
          pending={genCampaign.isPending}
        />
      )}
    </div>
  );
}

/* ------------------------------ components ------------------------------ */

function StatusPill({ status }: { status: Campaign["status"] }) {
  const map = {
    Active: "bg-success/10 text-success border-success/20",
    Paused: "bg-warning/10 text-warning border-warning/20",
    Draft: "bg-surface-muted text-foreground-muted border-border",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status]}`}
    >
      <CircleDot className="h-2.5 w-2.5" />
      {status}
    </span>
  );
}

function StatusDot({ status }: { status: Campaign["status"] }) {
  const c =
    status === "Active"
      ? "bg-success"
      : status === "Paused"
        ? "bg-warning"
        : "bg-foreground-subtle";
  return <span className={`h-1.5 w-1.5 rounded-full ${c} shrink-0`} />;
}

function Meta({ icon: Icon, value }: { icon: typeof Building2; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 truncate">
      <Icon className="h-3 w-3" />
      {value}
    </span>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Building2;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-foreground-subtle">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold text-foreground tracking-tight">{value}</div>
    </div>
  );
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      aria-label={label}
      className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs text-foreground-muted hover:text-foreground hover:border-border-strong transition"
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function MiniBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      aria-label={label}
      className="h-7 w-7 grid place-items-center rounded-md border border-border bg-surface text-foreground-muted hover:text-foreground hover:border-border-strong transition"
    >
      {children}
    </button>
  );
}

function ScoreChip({ score }: { score: number }) {
  const tone =
    score >= 90
      ? "text-success bg-success/10 border-success/20"
      : score >= 80
        ? "text-foreground bg-surface-muted border-border"
        : "text-warning bg-warning/10 border-warning/20";
  return (
    <div
      className={`hidden sm:flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${tone}`}
    >
      <Sparkles className="h-3 w-3" />
      {score}
    </div>
  );
}

function QuickAction({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return (
    <button className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs text-foreground-muted hover:text-foreground hover:border-border-strong transition">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SequenceStep({
  idx,
  total,
  step,
}: {
  idx: number;
  total: number;
  step: {
    step: number;
    day_offset: number;
    channel: "email" | "linkedin";
    type?: string;
    subject?: string;
    subject_variants?: string[];
    body: string;
    cta?: string;
    cta_suggestions?: string[];
    best_send_time?: string;
    spam_score?: number;
    variant_b?: { subject?: string; body: string; cta?: string } | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [showB, setShowB] = useState(false);
  const isLI = step.channel === "linkedin";
  const Icon = isLI ? Linkedin : Mail;
  const active = showB && step.variant_b ? step.variant_b : step;
  return (
    <div>
      <div className="group flex items-start gap-3 rounded-lg border border-border bg-surface hover:border-border-strong transition px-3 py-2.5">
        <div className="h-7 w-7 rounded-md bg-surface-muted grid place-items-center border border-border shrink-0">
          <Icon className="h-3.5 w-3.5 text-foreground-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-foreground">
              {step.type ?? (isLI ? "LinkedIn touch" : "Email touch")}
            </span>
            <span className="text-[10px] font-medium text-foreground-subtle bg-surface-muted rounded px-1.5 py-0.5">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-foreground-subtle">Day {step.day_offset}</span>
            {step.best_send_time && (
              <span className="text-[10px] text-foreground-subtle inline-flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> {step.best_send_time}
              </span>
            )}
            {typeof step.spam_score === "number" && (
              <span
                className={`text-[10px] rounded px-1.5 py-0.5 border ${
                  step.spam_score <= 20
                    ? "border-success/20 bg-success/10 text-success"
                    : step.spam_score <= 45
                      ? "border-border bg-surface-muted text-foreground-muted"
                      : "border-warning/20 bg-warning/10 text-warning"
                }`}
              >
                Spam {step.spam_score}
              </span>
            )}
            {step.variant_b && (
              <button
                onClick={() => setShowB((v) => !v)}
                className="ml-auto text-[10px] text-foreground-muted hover:text-foreground inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5"
              >
                {showB ? "Variant A" : "Variant B"}
              </button>
            )}
          </div>
          {!isLI && active.subject && (
            <p className="mt-1 text-[12px] font-medium text-foreground truncate">
              {active.subject}
            </p>
          )}
          <p
            className={`text-[11px] text-foreground-subtle ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}
          >
            {active.body}
          </p>
          {open && (
            <div className="mt-2 space-y-1.5 text-[11px] text-foreground-muted">
              {active.cta && (
                <div>
                  <span className="text-foreground-subtle">CTA · </span>
                  {active.cta}
                </div>
              )}
              {step.cta_suggestions && step.cta_suggestions.length > 0 && (
                <div className="text-foreground-subtle">
                  Alt CTAs: {step.cta_suggestions.join(" · ")}
                </div>
              )}
              {!isLI && step.subject_variants && step.subject_variants.length > 0 && (
                <div className="text-foreground-subtle">
                  Alt subjects: {step.subject_variants.join(" · ")}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-1.5 text-[10px] text-foreground-muted hover:text-foreground"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {idx < total - 1 && (
        <div className="flex justify-center py-0.5">
          <div className="h-3 w-px bg-border" />
        </div>
      )}
    </div>
  );
}

function AICopilotModal(props: {
  onClose: () => void;
  channel: "email" | "linkedin" | "multi";
  setChannel: (v: "email" | "linkedin" | "multi") => void;
  touches: number;
  setTouches: (n: number) => void;
  tone: string;
  setTone: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
  ctx: string;
  setCtx: (v: string) => void;
  ab: boolean;
  setAB: (v: boolean) => void;
  onGenerate: () => void;
  pending: boolean;
}) {
  const {
    onClose,
    channel,
    setChannel,
    touches,
    setTouches,
    tone,
    setTone,
    goal,
    setGoal,
    ctx,
    setCtx,
    ab,
    setAB,
    onGenerate,
    pending,
  } = props;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-foreground-muted" />
            <h3 className="text-[13px] font-semibold text-foreground">AI Campaign Generator</h3>
          </div>
          <button onClick={onClose} className="text-foreground-subtle hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Channel">
            <div className="flex gap-1.5">
              {(["email", "linkedin", "multi"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`h-8 px-3 rounded-md border text-[12px] capitalize ${
                    channel === c
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface border-border text-foreground-muted hover:border-border-strong"
                  }`}
                >
                  {c === "multi" ? "Multi-channel" : c}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Touches · ${touches}`}>
            <input
              type="range"
              min={3}
              max={7}
              value={touches}
              onChange={(e) => setTouches(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </Field>
          <Field label="Tone">
            <div className="flex flex-wrap gap-1.5">
              {["direct", "warm", "consultative", "playful", "executive"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`h-7 px-2.5 rounded-md border text-[11px] capitalize ${
                    tone === t
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface border-border text-foreground-muted hover:border-border-strong"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Goal (optional)">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. book a discovery call with VP Eng"
              className="w-full h-9 rounded-md bg-surface-muted border border-border px-3 text-[12px] text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Extra context (optional)">
            <textarea
              value={ctx}
              onChange={(e) => setCtx(e.target.value)}
              rows={3}
              placeholder="Angles to emphasize, competitors to mention, do-not-say list…"
              className="w-full rounded-md bg-surface-muted border border-border px-3 py-2 text-[12px] text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-foreground-muted">
            <input type="checkbox" checked={ab} onChange={(e) => setAB(e.target.checked)} />
            Generate A/B variant for each email
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-md border border-border text-[12px] text-foreground-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onGenerate}
            disabled={pending}
            className="h-8 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-foreground-subtle font-medium mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
