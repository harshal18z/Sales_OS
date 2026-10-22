import { createFileRoute, Link } from "@/lib/router-compat";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Flame,
  Lightbulb,
  Loader2,
  Mail,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  useAIJobs,
  useActivityLogs,
  useCampaigns,
  useCompanies,
  useDeals,
  useEmails,
  useLeads,
  useMeetings,
  useResearchReports,
  useUpdateRow,
} from "@/hooks/use-data";
import { useCalendarEvents, useGmailMessages, useGoogleStatus } from "@/hooks/use-google";
import { useCRMIntegrations } from "@/hooks/use-crm";
import { EmptyState, PageHeader, SkeletonList } from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SalesOS AI" }] }),
  component: DashboardPage,
});

function timeAgo(iso: string) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function DashboardPage() {
  const { data: meetings = [], isLoading: mLoad } = useMeetings();
  const { data: activity = [], isLoading: aLoad } = useActivityLogs();
  const { data: jobs = [], isLoading: jLoad } = useAIJobs();
  const { data: emails = [], isLoading: eLoad } = useEmails();
  const { data: research = [], isLoading: rLoad } = useResearchReports();
  const { data: companies = [] } = useCompanies();
  const { data: campaigns = [] } = useCampaigns();
  const { data: leads = [] } = useLeads();
  const { data: deals = [] } = useDeals();
  const { data: gstatus } = useGoogleStatus();
  const gmailUnread = useGmailMessages({ query: "is:unread in:inbox", max: 10 }, !!gstatus?.gmail);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  ).toISOString();
  const gcalToday = useCalendarEvents(
    { timeMin: todayStart, timeMax: todayEnd, max: 10 },
    !!gstatus?.calendar,
  );
  const { data: crmIntegrations = [] } = useCRMIntegrations();

  const insights = useMemo(
    () =>
      computeInsights({
        leads: leads as any[],
        deals: deals as any[],
        companies: companies as any[],
        emails: emails as any[],
        meetings: meetings as any[],
        research: research as any[],
        activity: activity as any[],
        unreadCount: (gmailUnread.data as any)?.messages?.length ?? 0,
      }),
    [leads, deals, companies, emails, meetings, research, activity, gmailUnread.data],
  );

  const updateEmail = useUpdateRow("emails", "emails");

  const todaysMeetings = (meetings as any[]).filter((m) => {
    const d = new Date(m.starts_at);
    return d.toDateString() === today.toDateString();
  });
  const gcalEvents = ((gcalToday.data as any)?.events ?? []) as any[];
  const unreadCount = (gmailUnread.data as any)?.messages?.length ?? 0;
  const pendingEmails = (emails as any[]).filter(
    (e) => e.status === "pending" || e.status === "draft",
  );
  const pendingJobs = (jobs as any[]).filter(
    (j) => j.status === "queued" || j.status === "running",
  );
  const pendingResearch = (research as any[]).filter(
    (r) => r.status === "running" || r.status === "queued",
  );

  async function approveEmail(id: string) {
    try {
      await updateEmail.mutateAsync({ id, values: { status: "approved" } });
      toast.success("Approved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function rejectEmail(id: string) {
    try {
      await updateEmail.mutateAsync({ id, values: { status: "rejected" } });
      toast.success("Rejected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="AI Command Center"
        subtitle="Your daily intelligence briefing and live agent activity"
      />

      <div className="p-6 grid grid-cols-12 gap-6">
        {/* Daily Brief KPIs */}
        <div className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icon={Users} label="Leads" value={leads.length} />
            <KPI icon={Building2} label="Companies" value={companies.length} />
            <KPI
              icon={Mail}
              label={gstatus?.gmail ? "Unread emails" : "Pending emails"}
              value={gstatus?.gmail ? unreadCount : pendingEmails.length}
            />
            <KPI
              icon={Calendar}
              label="Today's meetings"
              value={(gstatus?.calendar ? gcalEvents.length : 0) + todaysMeetings.length}
            />
          </div>
        </div>

        {/* AI Recommended Actions */}
        <Section
          title="AI Recommended Actions"
          subtitle="Ranked by impact"
          className="col-span-12 lg:col-span-6"
        >
          {insights.recommendedActions.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nothing urgent"
              description="AI will surface actions as your workspace fills up."
            />
          ) : (
            <div className="space-y-2">
              {insights.recommendedActions.slice(0, 5).map((a, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface p-3 flex items-start gap-2.5"
                >
                  <div className="h-6 w-6 rounded-md bg-surface-muted border border-border grid place-items-center shrink-0">
                    <Zap className="h-3.5 w-3.5 text-foreground-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">{a.title}</p>
                    <p className="text-[11px] text-foreground-subtle mt-0.5">{a.reason}</p>
                  </div>
                  {a.to && (
                    <Link
                      to={a.to}
                      className="text-[11px] text-foreground-muted hover:text-foreground shrink-0"
                    >
                      Open →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Deals At Risk */}
        <Section
          title="Deals At Risk"
          subtitle={`${insights.dealsAtRisk.length} flagged`}
          className="col-span-12 lg:col-span-6"
          action={
            <Link to="/crm" className="text-[11px] text-foreground-muted hover:text-foreground">
              Open CRM →
            </Link>
          }
        >
          {insights.dealsAtRisk.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Pipeline healthy"
              description="No deals showing risk signals right now."
            />
          ) : (
            <div className="space-y-2">
              {insights.dealsAtRisk.slice(0, 5).map((d) => (
                <div key={d.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">{d.name}</p>
                      <p className="text-[11px] text-foreground-subtle truncate">
                        {d.stage} · ${(d.value ?? 0).toLocaleString()} · {d.reason}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-foreground-subtle shrink-0">
                      {d.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Today's Priorities */}
        <Section
          title="Today's Priorities"
          subtitle="What AI thinks you should tackle first"
          className="col-span-12 lg:col-span-6"
        >
          {insights.priorities.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No priorities"
              description="You're clear — add leads or meetings to see AI focus."
            />
          ) : (
            <div className="space-y-2">
              {insights.priorities.slice(0, 5).map((p, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3"
                >
                  <div className="h-6 w-6 rounded-md bg-surface-muted border border-border grid place-items-center text-[10px] font-semibold text-foreground-muted shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-[11px] text-foreground-subtle truncate">{p.detail}</p>
                  </div>
                  {p.to && (
                    <Link
                      to={p.to}
                      className="text-[11px] text-foreground-muted hover:text-foreground shrink-0"
                    >
                      Go →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent Buying Signals */}
        <Section
          title="Recent Buying Signals"
          subtitle="Intent detected from your workspace"
          className="col-span-12 lg:col-span-6"
        >
          {insights.buyingSignals.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="No signals yet"
              description="Run research or import leads to detect intent."
            />
          ) : (
            <div className="space-y-2">
              {insights.buyingSignals.slice(0, 5).map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface p-3 flex items-start gap-2.5"
                >
                  <Flame className="h-3.5 w-3.5 text-foreground-muted mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{s.entity}</p>
                    <p className="text-[11px] text-foreground-subtle truncate">{s.signal}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-foreground-subtle shrink-0">
                    {s.strength}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Top Opportunities */}
        <Section
          title="Top Opportunities"
          subtitle="Highest scored, warmest leads"
          className="col-span-12 lg:col-span-4"
          action={
            <Link to="/leads" className="text-[11px] text-foreground-muted hover:text-foreground">
              All →
            </Link>
          }
        >
          {insights.topOpportunities.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No opportunities"
              description="Score leads to see your best bets."
            />
          ) : (
            <div className="space-y-1.5">
              {insights.topOpportunities.slice(0, 5).map((l) => (
                <div
                  key={l.id}
                  className="rounded-lg border border-border bg-surface p-2.5 flex items-center gap-2.5"
                >
                  <div className="h-7 w-7 rounded-md bg-surface-muted border border-border grid place-items-center text-[10px] font-medium text-foreground-muted">
                    {l.score ?? 0}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{l.label}</p>
                    <p className="text-[11px] text-foreground-subtle truncate">
                      {l.stage} · intent {l.intent_score ?? 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Revenue Forecast */}
        <Section
          title="Revenue Forecast"
          subtitle="Weighted pipeline this quarter"
          className="col-span-12 lg:col-span-4"
        >
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <DollarSign className="h-4 w-4 text-foreground-muted" />
              <span className="text-[22px] font-semibold text-foreground tracking-tight">
                $
                {insights.forecast.weighted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] text-foreground-subtle">weighted</span>
            </div>
            <div className="space-y-1.5">
              <ForecastRow label="Open pipeline" value={insights.forecast.open} />
              <ForecastRow label="Committed" value={insights.forecast.committed} />
              <ForecastRow label="Best case" value={insights.forecast.bestCase} />
              <ForecastRow label="Closed won" value={insights.forecast.won} />
            </div>
            {insights.forecast.open === 0 && (
              <p className="text-[11px] text-foreground-subtle">
                Add deals in CRM to project revenue.
              </p>
            )}
          </div>
        </Section>

        {/* Lead Follow-up Suggestions */}
        <Section
          title="Lead Follow-up Suggestions"
          subtitle="Leads gone quiet"
          className="col-span-12 lg:col-span-4"
          action={
            <Link to="/leads" className="text-[11px] text-foreground-muted hover:text-foreground">
              Open →
            </Link>
          }
        >
          {insights.followUps.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="All caught up"
              description="No stale leads need a nudge."
            />
          ) : (
            <div className="space-y-1.5">
              {insights.followUps.slice(0, 5).map((f) => (
                <div key={f.id} className="rounded-lg border border-border bg-surface p-2.5">
                  <p className="text-[12.5px] font-medium text-foreground truncate">{f.label}</p>
                  <p className="text-[11px] text-foreground-subtle truncate mt-0.5">
                    {f.suggestion} · {f.daysSince}d silent
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* AI Working Now */}
        <Section
          title="AI Working Now"
          subtitle={`${pendingJobs.length} agent${pendingJobs.length === 1 ? "" : "s"} active`}
          className="col-span-12 lg:col-span-6"
        >
          {jLoad ? (
            <SkeletonList count={3} />
          ) : pendingJobs.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No agents running"
              description="Kick off research or drafts to see live AI activity."
            />
          ) : (
            <div className="space-y-2">
              {pendingJobs.slice(0, 6).map((j: any) => (
                <div key={j.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start gap-2">
                    <Loader2 className="h-3.5 w-3.5 text-foreground-muted animate-spin mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground truncate">{j.kind}</p>
                      <p className="text-[11px] text-foreground-subtle truncate">
                        {j.output?.stage ?? j.entity_type ?? "system"} · {timeAgo(j.created_at)}
                      </p>
                      <div className="mt-2 h-1 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full bg-foreground/70 transition-all duration-500"
                          style={{ width: `${Math.max(3, Math.min(100, j.progress ?? 0))}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                      {j.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Today's Meetings */}
        <Section
          title="Today's Meetings"
          subtitle={`${todaysMeetings.length} scheduled`}
          className="col-span-12 lg:col-span-6"
          action={
            <Link
              to="/meetings"
              className="text-[11px] text-foreground-muted hover:text-foreground"
            >
              Open →
            </Link>
          }
        >
          {mLoad ? (
            <SkeletonList count={3} />
          ) : todaysMeetings.length === 0 && gcalEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No meetings today"
              description="Your schedule is clear."
            />
          ) : (
            <div className="space-y-2">
              {gcalEvents.slice(0, 5).map((e) => (
                <div
                  key={`g-${e.id}`}
                  className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-md bg-surface-muted border border-border grid place-items-center shrink-0">
                    <Calendar className="h-4 w-4 text-foreground-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">
                      {e.summary || "(no title)"}
                    </p>
                    <p className="text-[11px] text-foreground-subtle">
                      {e.start ? fmtTime(e.start) : ""}
                      {e.end ? ` – ${fmtTime(e.end)}` : ""}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                    Google
                  </span>
                </div>
              ))}
              {todaysMeetings.slice(0, 5).map((m: any) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-border bg-surface p-3 flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-md bg-surface-muted border border-border grid place-items-center shrink-0">
                    <Calendar className="h-4 w-4 text-foreground-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-[11px] text-foreground-subtle">
                      {fmtTime(m.starts_at)}
                      {m.ends_at ? ` – ${fmtTime(m.ends_at)}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-foreground-subtle">
                    {m.status ?? "scheduled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Email Approval Queue */}
        <Section
          title="Email Approval Queue"
          subtitle={`${pendingEmails.length} awaiting review`}
          className="col-span-12 lg:col-span-7"
          action={
            <Link to="/emails" className="text-[11px] text-foreground-muted hover:text-foreground">
              Open studio →
            </Link>
          }
        >
          {eLoad ? (
            <SkeletonList count={3} />
          ) : pendingEmails.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Inbox zero"
              description="No AI drafts waiting on your approval."
            />
          ) : (
            <div className="space-y-2">
              {pendingEmails.slice(0, 5).map((e: any) => (
                <div key={e.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {e.subject ?? "(no subject)"}
                      </p>
                      <p className="text-[11px] text-foreground-subtle truncate">
                        Tone: {e.tone ?? "—"} · Score: {e.personalization_score ?? 0}
                      </p>
                    </div>
                    <button
                      onClick={() => rejectEmail(e.id)}
                      className="h-7 px-2.5 text-[11px] rounded-md border border-border text-foreground-muted hover:text-foreground"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approveEmail(e.id)}
                      className="h-7 inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2.5 text-[11px] font-medium hover:opacity-90"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Research Queue */}
        <Section
          title="Research Queue"
          subtitle={`${pendingResearch.length} in progress`}
          className="col-span-12 lg:col-span-5"
          action={
            <Link
              to="/research"
              className="text-[11px] text-foreground-muted hover:text-foreground"
            >
              Open →
            </Link>
          }
        >
          {rLoad ? (
            <SkeletonList count={3} />
          ) : research.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No research yet"
              description="Ask AI about any company or lead."
            />
          ) : (
            <div className="space-y-2">
              {(research as any[]).slice(0, 5).map((r: any) => (
                <div key={r.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-[13px] font-medium text-foreground truncate">{r.query}</p>
                  <p className="text-[11px] text-foreground-subtle truncate mt-0.5">
                    {r.status} · {timeAgo(r.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* CRM Sync Status */}
        <Section
          title="CRM Sync"
          subtitle={
            crmIntegrations.some((r) => r.status === "connected")
              ? "Live sync status per provider"
              : "No CRM connected"
          }
          className="col-span-12 lg:col-span-4"
          action={
            <Link
              to="/integrations"
              className="text-[11px] text-foreground-muted hover:text-foreground"
            >
              Manage →
            </Link>
          }
        >
          <div className="space-y-1.5">
            {crmIntegrations.map((row) => {
              const label = row.provider[0].toUpperCase() + row.provider.slice(1);
              const last = row.config?.last_synced_at;
              const rel = last
                ? (() => {
                    const s = Math.floor((Date.now() - new Date(last).getTime()) / 1000);
                    if (s < 60) return `${s}s ago`;
                    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                    return `${Math.floor(s / 86400)}d ago`;
                  })()
                : "—";
              return (
                <div key={row.provider} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        row.status === "connected"
                          ? "bg-foreground"
                          : row.status === "pending"
                            ? "bg-foreground-muted"
                            : "bg-border-strong"
                      }`}
                    />
                    <p className="text-[12.5px] text-foreground truncate">{label}</p>
                  </div>
                  <p className="text-[11px] text-foreground-subtle">
                    {row.status === "connected" ? rel : row.status === "pending" ? "Setup" : "Off"}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Recent Activity */}
        <Section title="Recent Activity" className="col-span-12 lg:col-span-4">
          {aLoad ? (
            <SkeletonList count={4} />
          ) : activity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Actions across your workspace will appear here."
            />
          ) : (
            <div className="space-y-1.5">
              {(activity as any[]).slice(0, 8).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-foreground-muted mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-foreground">
                      <span className="font-medium">{a.action}</span>{" "}
                      <span className="text-foreground-subtle">{a.entity_type}</span>
                    </p>
                    <p className="text-[11px] text-foreground-subtle">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Import History */}
        <Section
          title="Import History"
          subtitle="Recent CSV imports"
          className="col-span-12 lg:col-span-4"
        >
          {(() => {
            const imports = (activity as any[])
              .filter((a) => a.action === "csv.imported")
              .slice(0, 6);
            if (imports.length === 0) {
              return (
                <EmptyState
                  icon={Activity}
                  title="No imports yet"
                  description="Import CSVs from Companies, Contacts, or Leads."
                />
              );
            }
            return (
              <div className="space-y-2">
                {imports.map((a: any) => {
                  const total = a.metadata?.count ?? 0;
                  const failed = a.metadata?.failed ?? 0;
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted/30 p-2.5"
                    >
                      <div className="h-6 w-6 grid place-items-center rounded-md bg-surface border border-border shrink-0">
                        <Activity className="h-3 w-3 text-foreground-muted" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-foreground">
                          <span className="font-medium">{total}</span>{" "}
                          <span className="text-foreground-subtle">rows into {a.entity_type}</span>
                          {failed > 0 && (
                            <span className="ml-1 text-[11px] text-amber-600">
                              · {failed} failed
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-foreground-subtle">
                          {timeAgo(a.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Section>
      </div>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
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

function Section({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-[11px] text-foreground-subtle mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// hint for TS: keep TrendingUp / Plus imports usable in future refactors
void TrendingUp;
void Plus;

// ---------- AI Insights ----------

type Action = { title: string; reason: string; to?: any };
type DealRisk = {
  id: string;
  name: string;
  stage: string;
  value: number;
  reason: string;
  severity: "high" | "med" | "low";
};
type Priority = { title: string; detail: string; to?: any };
type Signal = { entity: string; signal: string; strength: "hot" | "warm" | "cool" };
type Opportunity = {
  id: string;
  label: string;
  stage: string;
  score: number | null;
  intent_score: number | null;
};
type FollowUp = { id: string; label: string; suggestion: string; daysSince: number };

type InsightInput = {
  leads: any[];
  deals: any[];
  companies: any[];
  emails: any[];
  meetings: any[];
  research: any[];
  activity: any[];
  unreadCount: number;
};

function ForecastRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-foreground-subtle">{label}</span>
      <span className="text-[12.5px] font-medium text-foreground tabular-nums">
        ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}

function daysBetween(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function computeInsights(input: InsightInput) {
  const { leads, deals, companies, emails, meetings, research, unreadCount } = input;
  const now = Date.now();

  // Deals At Risk: no close date, close date past, or stale in stage
  const closedLostRe = /lost|closed[-_ ]?lost/i;
  const closedWonRe = /won|closed[-_ ]?won/i;
  const openDeals = deals.filter(
    (d) => !closedLostRe.test(d.stage ?? "") && !closedWonRe.test(d.stage ?? ""),
  );
  const dealsAtRisk: DealRisk[] = openDeals
    .map((d): DealRisk | null => {
      const stale = daysBetween(d.updated_at);
      const overdue = d.expected_close_date && new Date(d.expected_close_date).getTime() < now;
      let reason = "";
      let severity: "high" | "med" | "low" = "low";
      if (overdue) {
        reason = `Close date overdue by ${daysBetween(d.expected_close_date)}d`;
        severity = "high";
      } else if (stale >= 21) {
        reason = `${stale}d without update`;
        severity = "high";
      } else if (stale >= 10) {
        reason = `${stale}d without update`;
        severity = "med";
      } else if ((d.probability ?? 0) < 25 && (d.value ?? 0) >= 5000) {
        reason = "Low probability, high value";
        severity = "med";
      } else return null;
      return { id: d.id, name: d.name, stage: d.stage, value: d.value ?? 0, reason, severity };
    })
    .filter((x): x is DealRisk => !!x)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  // Top Opportunities: leads by score * intent
  const scored = leads
    .map((l) => ({
      id: l.id,
      label: l.notes?.split("\n")[0]?.slice(0, 60) || `Lead ${l.id.slice(0, 6)}`,
      stage: l.stage ?? "new",
      score: l.score ?? 0,
      intent_score: l.intent_score ?? 0,
      rank: (l.score ?? 0) * 0.6 + (l.intent_score ?? 0) * 0.4,
    }))
    .sort((a, b) => b.rank - a.rank);
  const topOpportunities: Opportunity[] = scored.filter((s) => s.rank > 0).slice(0, 8);

  // Follow-ups: leads with no update in 7+ days, still in open stage
  const openStageRe = /new|contacted|qualified|working|nurturing|open/i;
  const followUps: FollowUp[] = leads
    .filter((l) => openStageRe.test(l.stage ?? "new"))
    .map((l): FollowUp => {
      const days = daysBetween(l.updated_at);
      const suggestion =
        (l.intent_score ?? 0) >= 60
          ? "Send a value-add follow-up email"
          : days >= 21
            ? "Re-engage with a breakup email"
            : "Send a soft nudge or share a case study";
      return {
        id: l.id,
        label: l.notes?.split("\n")[0]?.slice(0, 60) || `Lead ${l.id.slice(0, 6)}`,
        suggestion,
        daysSince: days,
      };
    })
    .filter((f) => f.daysSince >= 7)
    .sort((a, b) => b.daysSince - a.daysSince);

  // Buying signals: from research reports + high-intent leads + hot deals moving stage recently
  const buyingSignals: Signal[] = [];
  research.slice(0, 20).forEach((r) => {
    if (!r) return;
    const q = r.query ?? r.company_name ?? "Report";
    if (r.status === "completed") {
      buyingSignals.push({
        entity: q,
        signal: "Fresh research completed — outreach window open",
        strength: "warm",
      });
    }
  });
  scored
    .filter((s) => (s.intent_score ?? 0) >= 70)
    .slice(0, 5)
    .forEach((s) => {
      buyingSignals.push({
        entity: s.label,
        signal: `Intent score ${s.intent_score}`,
        strength: "hot",
      });
    });
  openDeals
    .filter((d) => daysBetween(d.updated_at) <= 3 && (d.probability ?? 0) >= 60)
    .slice(0, 5)
    .forEach((d) =>
      buyingSignals.push({
        entity: d.name,
        signal: `Progressing — ${d.probability}% probability`,
        strength: "warm",
      }),
    );

  // Revenue forecast (weighted pipeline)
  const open = openDeals.reduce((s, d) => s + (d.value ?? 0), 0);
  const weighted = openDeals.reduce((s, d) => s + (d.value ?? 0) * ((d.probability ?? 0) / 100), 0);
  const committed = openDeals
    .filter((d) => (d.probability ?? 0) >= 70)
    .reduce((s, d) => s + (d.value ?? 0), 0);
  const bestCase = openDeals
    .filter((d) => (d.probability ?? 0) >= 30)
    .reduce((s, d) => s + (d.value ?? 0), 0);
  const won = deals
    .filter((d) => closedWonRe.test(d.stage ?? ""))
    .reduce((s, d) => s + (d.value ?? 0), 0);

  // Priorities: mash of top signals into an ordered task list
  const priorities: Priority[] = [];
  const meetingsToday = meetings.filter(
    (m) => new Date(m.starts_at).toDateString() === new Date().toDateString(),
  );
  if (meetingsToday.length)
    priorities.push({
      title: "Prep for today's meetings",
      detail: `${meetingsToday.length} on your calendar`,
      to: "/meetings",
    });
  const pendingDrafts = emails.filter((e) => e.status === "pending" || e.status === "draft");
  if (pendingDrafts.length)
    priorities.push({
      title: "Review AI email drafts",
      detail: `${pendingDrafts.length} awaiting approval`,
      to: "/emails",
    });
  if (dealsAtRisk.filter((d) => d.severity === "high").length)
    priorities.push({
      title: "Rescue at-risk deals",
      detail: `${dealsAtRisk.filter((d) => d.severity === "high").length} high-risk deals`,
      to: "/crm",
    });
  if (topOpportunities.length)
    priorities.push({
      title: "Contact top opportunity",
      detail: `${topOpportunities[0].label} · score ${topOpportunities[0].score}`,
      to: "/leads",
    });
  if (followUps.length)
    priorities.push({
      title: "Follow up on stale leads",
      detail: `${followUps.length} silent 7+ days`,
      to: "/leads",
    });
  if (unreadCount > 5)
    priorities.push({
      title: "Triage inbox",
      detail: `${unreadCount} unread messages`,
      to: "/emails",
    });

  // Recommended actions
  const actions: Action[] = [];
  if (dealsAtRisk[0])
    actions.push({
      title: `Re-engage "${dealsAtRisk[0].name}"`,
      reason: dealsAtRisk[0].reason,
      to: "/crm",
    });
  if (topOpportunities[0])
    actions.push({
      title: `Reach out to ${topOpportunities[0].label}`,
      reason: `High score (${topOpportunities[0].score}) with intent ${topOpportunities[0].intent_score}`,
      to: "/leads",
    });
  if (followUps[0])
    actions.push({
      title: `Nudge ${followUps[0].label}`,
      reason: `${followUps[0].daysSince} days silent — ${followUps[0].suggestion.toLowerCase()}`,
      to: "/leads",
    });
  if (pendingDrafts.length)
    actions.push({
      title: "Approve pending email drafts",
      reason: `${pendingDrafts.length} in queue`,
      to: "/emails",
    });
  if (companies.length && research.length === 0)
    actions.push({
      title: "Kick off company research",
      reason: `${companies.length} accounts have no report yet`,
      to: "/research",
    });
  if (!companies.length && !leads.length)
    actions.push({
      title: "Import your book of business",
      reason: "Add leads, companies, or connect a CRM to unlock AI",
      to: "/integrations",
    });

  return {
    recommendedActions: actions,
    dealsAtRisk,
    priorities,
    buyingSignals,
    topOpportunities,
    forecast: { open, weighted, committed, bestCase, won },
    followUps,
  };
}

void Plus;
