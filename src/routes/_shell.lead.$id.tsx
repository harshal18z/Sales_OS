import { createFileRoute, Link, useNavigate } from "@/lib/router-compat";
import { useQuery } from "@/lib/query";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Flame,
  Linkedin,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  Snowflake,
  Sparkles,
  Sun,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useCampaigns, useCompanies, useLeads } from "@/hooks/use-data";
import {
  useAIDiscoverDecisionMakers,
  useAIEmail,
  useAILeadScore,
  useAIResearch,
} from "@/hooks/use-ai";
import {
  EmptyState,
  GhostBtn,
  PageHeader,
  PrimaryBtn,
  SkeletonList,
} from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/lead/$id")({
  head: () => ({ meta: [{ title: "Lead — SalesOS AI" }] }),
  component: LeadDetailPage,
});

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function TempBadge({ t }: { t?: string | null }) {
  const temp = (t ?? "").toLowerCase();
  if (temp === "hot")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-medium">
        <Flame className="h-2.5 w-2.5" />
        Hot
      </span>
    );
  if (temp === "warm")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium">
        <Sun className="h-2.5 w-2.5" />
        Warm
      </span>
    );
  if (temp === "cold")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium">
        <Snowflake className="h-2.5 w-2.5" />
        Cold
      </span>
    );
  return <span className="text-[10px] text-foreground-subtle">—</span>;
}

function PriorityDot({ p }: { p?: string | null }) {
  const map: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-sky-500",
  };
  const cls = map[(p ?? "").toLowerCase()] ?? "bg-foreground-subtle";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

function ScoreCard({
  label,
  value,
  textual = false,
}: {
  label: string;
  value: number | string;
  textual?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">{label}</p>
      <p
        className={`mt-1 font-semibold text-foreground tracking-tight ${textual ? "text-[13px]" : "text-[20px]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: any;
  label: string;
  value?: string | number | null;
  href?: string;
}) {
  const has = value !== null && value !== undefined && value !== "";
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-foreground-subtle mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-foreground-subtle">{label}</p>
        {has ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-foreground hover:underline truncate block"
            >
              {String(value)}
            </a>
          ) : (
            <p className="text-[13px] text-foreground truncate">{String(value)}</p>
          )
        ) : (
          <p className="text-[12px] text-foreground-subtle italic">Not yet discovered</p>
        )}
      </div>
    </div>
  );
}

function TimelineDot({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-1.5 w-1.5 rounded-full bg-foreground-muted mt-1.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-foreground">{label}</p>
        <p className="text-[11px] text-foreground-subtle">{time}</p>
      </div>
    </div>
  );
}

function LeadDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: companies = [] } = useCompanies();
  const { data: campaigns = [] } = useCampaigns();

  const lead = (leads as any[]).find((l) => l.id === id) ?? null;
  const company = lead
    ? ((companies as any[]).find((c) => c.id === lead.company_id) ?? null)
    : null;
  const linkedCampaign = lead
    ? ((campaigns as any[]).find((c) => c.id === lead.campaign_id) ?? null)
    : null;

  const emailAI = useAIEmail();
  const scoreAI = useAILeadScore();
  const researchAI = useAIResearch();
  const enrichAI = useAIDiscoverDecisionMakers();

  const { data: contact } = useQuery({
    queryKey: ["contact", lead?.contact_id],
    enabled: !!lead?.contact_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", lead!.contact_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: research } = useQuery({
    queryKey: ["research_report", company?.latest_research_report_id],
    enabled: !!company?.latest_research_report_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("research_reports")
        .select("*")
        .eq("id", company!.latest_research_report_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: emails = [] } = useQuery({
    queryKey: ["emails", "lead", id],
    enabled: !!lead,
    queryFn: async () => {
      const { data } = await supabase
        .from("emails")
        .select("id, subject, status, tone, sent_at, created_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", "lead", id],
    enabled: !!lead,
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("id, title, starts_at, status, meeting_url")
        .eq("lead_id", id)
        .order("starts_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activity_logs", "lead", id],
    enabled: !!workspaceId && !!lead,
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, metadata, created_at")
        .eq("workspace_id", workspaceId!)
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  if (leadsLoading) {
    return (
      <div className="p-6">
        <SkeletonList count={6} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-full">
        <PageHeader title="Lead" subtitle="Not found" />
        <div className="p-6">
          <EmptyState
            icon={Users}
            title="Lead not found"
            description="This lead may have been deleted or you don't have access."
            action={
              <PrimaryBtn onClick={() => navigate({ to: "/leads" })}>
                <ArrowLeft className="h-3 w-3" /> Back to leads
              </PrimaryBtn>
            }
          />
        </div>
      </div>
    );
  }

  const insight = (lead.ai_insight ?? {}) as Record<string, any>;
  const fullName = contact?.full_name ?? insight.name ?? insight.full_name ?? null;
  const title = contact?.title ?? insight.title ?? insight.job_title ?? null;
  const email = contact?.email ?? insight.email ?? null;
  const phone = contact?.phone ?? insight.phone ?? null;
  const linkedin = contact?.linkedin_url ?? insight.linkedin_url ?? null;
  const department = insight.department ?? null;
  const seniority = insight.seniority ?? null;
  const confidence = insight.confidence_score ?? insight.confidence ?? null;
  const discoveryReason = insight.discovery_reason ?? insight.reason ?? insight.why ?? null;

  async function handleGenerateEmail() {
    try {
      await emailAI.mutateAsync({
        emailType: "cold",
        leadId: lead.id,
        companyId: lead.company_id ?? undefined,
        save: true,
      });
      navigate({ to: "/emails" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleRefreshResearch() {
    const url = company?.website ?? (company?.domain ? `https://${company.domain}` : null);
    if (!url) {
      toast.error("Company has no website/domain to research");
      return;
    }
    try {
      await researchAI.mutateAsync({ url, companyId: company!.id, force: true });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleReEnrich() {
    if (!company?.id) {
      toast.error("No linked company");
      return;
    }
    try {
      await enrichAI.mutateAsync({ companyId: company.id });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title={fullName ?? "Lead"}
        subtitle={[title, company?.name].filter(Boolean).join(" · ") || "Lead detail"}
        action={
          <div className="flex items-center gap-2">
            <GhostBtn onClick={() => navigate({ to: "/leads" })}>
              <ArrowLeft className="h-3 w-3" /> Back
            </GhostBtn>
            <PrimaryBtn
              onClick={() => scoreAI.mutate({ leadId: lead.id })}
              disabled={scoreAI.isPending}
            >
              <Sparkles className="h-3 w-3" />
              {scoreAI.isPending ? "Analyzing…" : lead.ai_scored_at ? "Re-analyze" : "Analyze"}
            </PrimaryBtn>
          </div>
        }
      />

      <div className="p-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ScoreCard label="AI score" value={lead.score ?? 0} />
            <ScoreCard label="Intent" value={lead.intent_score ?? 0} />
            <ScoreCard label="Buying intent" value={lead.buying_intent ?? 0} />
            <ScoreCard
              label="Win probability"
              value={lead.win_probability != null ? `${lead.win_probability}%` : "—"}
              textual
            />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TempBadge t={lead.temperature} />
              <div className="flex items-center gap-1.5 text-[12px] text-foreground-muted">
                <PriorityDot p={lead.priority} />
                <span className="capitalize">{lead.priority ?? "—"} priority</span>
              </div>
              <span className="text-[11px] text-foreground-subtle">Stage: {lead.stage}</span>
              {lead.source && (
                <span className="text-[11px] text-foreground-subtle">Source: {lead.source}</span>
              )}
            </div>
            <div className="text-[11px] text-foreground-subtle">
              Last activity {timeAgo(lead.last_activity_at ?? lead.updated_at ?? lead.created_at)}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <GhostBtn onClick={handleGenerateEmail} disabled={emailAI.isPending}>
              <Mail className="h-3 w-3" /> {emailAI.isPending ? "Drafting…" : "Generate Email"}
            </GhostBtn>
            <GhostBtn onClick={handleRefreshResearch} disabled={researchAI.isPending || !company}>
              <RefreshCw className="h-3 w-3" />{" "}
              {researchAI.isPending ? "Researching…" : "Refresh Research"}
            </GhostBtn>
            <GhostBtn onClick={handleReEnrich} disabled={enrichAI.isPending || !company}>
              <UserPlus className="h-3 w-3" />{" "}
              {enrichAI.isPending ? "Enriching…" : "Re-enrich Contact"}
            </GhostBtn>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
              Lead information
            </p>
            <div className="divide-y divide-border">
              <InfoRow icon={Users} label="Full name" value={fullName} />
              <InfoRow icon={Users} label="Job title" value={title} />
              <InfoRow icon={Users} label="Department" value={department} />
              <InfoRow icon={Users} label="Seniority" value={seniority} />
              <InfoRow icon={Building2} label="Company" value={company?.name} />
              <InfoRow
                icon={Mail}
                label="Email"
                value={email}
                href={email ? `mailto:${email}` : undefined}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={phone}
                href={phone ? `tel:${phone}` : undefined}
              />
              <InfoRow
                icon={Linkedin}
                label="LinkedIn"
                value={linkedin}
                href={linkedin ?? undefined}
              />
              <InfoRow
                icon={Sparkles}
                label="AI confidence"
                value={confidence != null ? `${confidence}` : null}
              />
              <InfoRow icon={Sparkles} label="Discovery reason" value={discoveryReason} />
              <InfoRow
                icon={Calendar}
                label="Discovered"
                value={lead.created_at ? new Date(lead.created_at).toLocaleString() : null}
              />
            </div>
          </div>

          {(company?.ai_summary || research?.summary || company?.recommended_outreach) && (
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                Company & Research
              </p>
              {company?.ai_summary && (
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">Company summary</p>
                  <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                    {company.ai_summary}
                  </p>
                </div>
              )}
              {research?.summary && (
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">Latest research</p>
                  <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                    {research.summary}
                  </p>
                </div>
              )}
              {company?.recommended_outreach && (
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">
                    Recommended outreach
                  </p>
                  <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                    {company.recommended_outreach}
                  </p>
                </div>
              )}
            </div>
          )}

          {lead.next_action && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">
                Recommended next action
              </p>
              <p className="text-[13px] text-foreground font-medium">{lead.next_action}</p>
            </div>
          )}

          {(insight.why ||
            insight.biggest_opportunity ||
            insight.biggest_risk ||
            insight.outreach_strategy) && (
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                  AI Insight
                </p>
                {lead.ai_scored_at && (
                  <p className="text-[10px] text-foreground-subtle">
                    Scored {timeAgo(lead.ai_scored_at)}
                  </p>
                )}
              </div>
              {insight.why && (
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">Why this score</p>
                  <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                    {insight.why}
                  </p>
                </div>
              )}
              {insight.biggest_opportunity && (
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">
                    Biggest opportunity
                  </p>
                  <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                    {insight.biggest_opportunity}
                  </p>
                </div>
              )}
              {insight.biggest_risk && (
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">Biggest risk</p>
                  <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                    {insight.biggest_risk}
                  </p>
                </div>
              )}
              {insight.outreach_strategy && (
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-1">Outreach strategy</p>
                  <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                    {insight.outreach_strategy}
                  </p>
                </div>
              )}
            </div>
          )}

          {lead.notes && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">
                Notes
              </p>
              <p className="text-[13px] text-foreground-muted whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
              Related emails
            </p>
            {emails.length === 0 ? (
              <p className="text-[12px] text-foreground-subtle italic">Not yet discovered</p>
            ) : (
              <div className="space-y-1.5">
                {emails.map((e: any) => (
                  <Link
                    key={e.id}
                    to="/emails"
                    className="flex items-center justify-between gap-2 text-[12.5px] hover:bg-surface-muted/50 rounded px-1 py-0.5 -mx-1"
                  >
                    <div className="min-w-0 flex-1 truncate text-foreground">
                      {e.subject ?? "(no subject)"}
                    </div>
                    <div className="text-[11px] text-foreground-subtle shrink-0">
                      {e.status}
                      {e.sent_at ? ` · ${timeAgo(e.sent_at)}` : ""}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
              Related meetings
            </p>
            {meetings.length === 0 ? (
              <p className="text-[12px] text-foreground-subtle italic">No meetings yet</p>
            ) : (
              <div className="space-y-1.5">
                {meetings.map((m: any) => (
                  <Link
                    key={m.id}
                    to="/meetings"
                    className="flex items-center justify-between gap-2 text-[12.5px] hover:bg-surface-muted/50 rounded px-1 py-0.5 -mx-1"
                  >
                    <div className="min-w-0 flex-1 truncate text-foreground">{m.title}</div>
                    <div className="text-[11px] text-foreground-subtle shrink-0">
                      {m.starts_at ? new Date(m.starts_at).toLocaleDateString() : "—"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
              Active campaigns
            </p>
            {linkedCampaign ? (
              <Link
                to="/campaigns/$id"
                params={{ id: linkedCampaign.id }}
                className="flex items-center justify-between gap-2 text-[13px] hover:bg-surface-muted/50 rounded px-1 py-1 -mx-1"
              >
                <span className="flex items-center gap-2 text-foreground truncate">
                  <Megaphone className="h-3 w-3 text-foreground-subtle" />
                  {linkedCampaign.name}
                </span>
                <span className="text-[11px] text-foreground-subtle capitalize shrink-0">
                  {linkedCampaign.status}
                </span>
              </Link>
            ) : (
              <p className="text-[12px] text-foreground-subtle italic">Not in a campaign</p>
            )}
          </div>

          {company && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
                Company
              </p>
              <Link
                to="/company/$id"
                params={{ id: company.id }}
                className="flex items-center gap-2 text-[13px] text-foreground hover:underline"
              >
                <Building2 className="h-3.5 w-3.5 text-foreground-subtle" />
                {company.name}
              </Link>
              {company.industry && (
                <p className="text-[11px] text-foreground-subtle mt-1">{company.industry}</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
              Activity timeline
            </p>
            <div className="space-y-2.5">
              <TimelineDot
                label={`Lead created${lead.source ? ` · ${lead.source}` : ""}`}
                time={timeAgo(lead.created_at)}
              />
              {activities.map((a: any) => (
                <TimelineDot
                  key={a.id}
                  label={`${a.action}${a.metadata?.name ? ` · ${a.metadata.name}` : ""}`}
                  time={timeAgo(a.created_at)}
                />
              ))}
              {lead.ai_scored_at && (
                <TimelineDot label="AI scored" time={timeAgo(lead.ai_scored_at)} />
              )}
              {lead.updated_at && lead.updated_at !== lead.created_at && (
                <TimelineDot label="Updated" time={timeAgo(lead.updated_at)} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
