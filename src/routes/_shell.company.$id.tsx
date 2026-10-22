import { createFileRoute, Link } from "@/lib/router-compat";
import { useMemo } from "react";
import { Building2, ExternalLink, Mail, MapPin, Sparkles, Users } from "lucide-react";
import {
  useCompanies,
  useContacts,
  useDeals,
  useLeads,
  useResearchReports,
} from "@/hooks/use-data";
import { useAIResearch, useAIDiscoverDecisionMakers } from "@/hooks/use-ai";
import { EmptyState, PageHeader, PrimaryBtn } from "@/components/app/data-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/company/$id")({
  head: () => ({ meta: [{ title: "Company — SalesOS AI" }] }),
  component: CompanyDetail,
});

function CompanyDetail() {
  const { id } = Route.useParams();
  const companies = useCompanies();
  const contacts = useContacts();
  const leads = useLeads();
  const deals = useDeals();
  const reports = useResearchReports();
  const research = useAIResearch();
  const discover = useAIDiscoverDecisionMakers();
  const company = (companies.data ?? []).find((row: any) => row.id === id);
  const companyContacts = useMemo(
    () => (contacts.data ?? []).filter((row: any) => row.company_id === id),
    [contacts.data, id],
  );
  const companyLeads = useMemo(
    () => (leads.data ?? []).filter((row: any) => row.company_id === id),
    [leads.data, id],
  );
  const companyDeals = useMemo(
    () => (deals.data ?? []).filter((row: any) => row.company_id === id),
    [deals.data, id],
  );
  const companyReports = useMemo(
    () => (reports.data ?? []).filter((row: any) => row.company_id === id),
    [reports.data, id],
  );

  if (companies.isLoading)
    return <div className="p-8 text-sm text-foreground-muted">Loading company…</div>;
  if (!company)
    return (
      <div className="p-8">
        <EmptyState
          icon={Building2}
          title="Company not found"
          description="It may have been removed or may belong to another workspace."
        />
      </div>
    );

  const website = company.website || (company.domain ? `https://${company.domain}` : null);
  const runResearch = async () => {
    if (!website) return toast.error("Add a company website before running research.");
    try {
      await research.mutateAsync({ url: website, companyId: id, force: true });
    } catch {
      /* mutation displays the error */
    }
  };
  const findPeople = async () => {
    try {
      const result: any = await discover.mutateAsync({ companyId: id, count: 8 });
      toast.success(`${result?.output?.created ?? 0} new decision makers added`);
    } catch {
      /* mutation displays the error */
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title={company.name}
        subtitle={
          [company.industry, company.headquarters || company.location]
            .filter(Boolean)
            .join(" · ") || "Company account"
        }
        action={
          <div className="flex gap-2">
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-[13px] text-foreground-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Website
              </a>
            )}
            <PrimaryBtn onClick={runResearch} disabled={research.isPending}>
              <Sparkles className="h-3.5 w-3.5" />
              {research.isPending ? "Researching…" : "Refresh research"}
            </PrimaryBtn>
          </div>
        }
      />
      <main className="p-6 space-y-6 max-w-7xl">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Contacts" value={companyContacts.length} icon={Users} />
          <Metric label="Leads" value={companyLeads.length} icon={Users} />
          <Metric
            label="Open deals"
            value={
              companyDeals.filter(
                (d: any) => !["won", "lost"].includes(String(d.stage).toLowerCase()),
              ).length
            }
            icon={Building2}
          />
          <Metric label="Research reports" value={companyReports.length} icon={Sparkles} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold">Account brief</h2>
              <span className="text-[11px] text-foreground-subtle">
                {company.last_research_at
                  ? `Updated ${new Date(company.last_research_at).toLocaleDateString()}`
                  : "No research yet"}
              </span>
            </div>
            <p className="text-[13px] leading-6 text-foreground-muted">
              {company.executive_summary ||
                company.ai_summary ||
                company.description ||
                "Run company research to generate a sourced account brief."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="Website" value={company.domain || company.website || "—"} />
              <Fact label="Industry" value={company.industry || "—"} />
              <Fact label="Company size" value={company.size || "—"} />
              <Fact label="Revenue" value={company.revenue || "—"} />
              <Fact label="Business model" value={company.business_model || "—"} />
              <Fact
                label="ICP fit"
                value={company.icp_score == null ? "—" : `${company.icp_score}/100`}
              />
            </div>
            {company.recommended_outreach && (
              <div className="rounded-lg bg-surface-muted/50 p-4">
                <p className="text-[11px] uppercase tracking-wide text-foreground-subtle mb-1">
                  Recommended approach
                </p>
                <p className="text-[13px] text-foreground-muted leading-5">
                  {company.recommended_outreach}
                </p>
              </div>
            )}
            {!!company.tech_stack?.length && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-foreground-subtle mb-2">
                  Technology
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {company.tech_stack.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">People</h2>
              <button
                onClick={findPeople}
                disabled={discover.isPending}
                className="inline-flex items-center gap-1.5 text-[12px] text-foreground-muted hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {discover.isPending ? "Finding…" : "Find decision makers"}
              </button>
            </div>
            {companyContacts.length === 0 && companyLeads.length === 0 ? (
              <p className="text-[13px] text-foreground-subtle">
                No contacts or leads linked to this company yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {companyContacts.map((person: any) => (
                  <div key={person.id} className="py-3">
                    <p className="text-[13px] font-medium">
                      {person.full_name || person.name || person.email || "Contact"}
                    </p>
                    <p className="text-[12px] text-foreground-muted">
                      {[person.title, person.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))}
                {companyLeads.map((lead: any) => (
                  <Link key={lead.id} to={`/lead/${lead.id}`} className="block py-3">
                    <p className="text-[13px] font-medium">
                      {lead.full_name || lead.name || "Lead"}
                    </p>
                    <p className="text-[12px] text-foreground-muted">
                      {[lead.title, lead.stage, lead.score != null ? `Score ${lead.score}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-[15px] font-semibold mb-3">Deals</h2>
            {companyDeals.length === 0 ? (
              <p className="text-[13px] text-foreground-subtle">No opportunities yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {companyDeals.map((deal: any) => (
                  <Link
                    to="/crm"
                    key={deal.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <span className="text-[13px]">{deal.name}</span>
                    <span className="text-[12px] text-foreground-muted">
                      {deal.stage} ·{" "}
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(Number(deal.value || 0))}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-[15px] font-semibold mb-3">Research history</h2>
            {companyReports.length === 0 ? (
              <p className="text-[13px] text-foreground-subtle">No research reports yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {companyReports.slice(0, 5).map((report: any) => (
                  <div key={report.id} className="py-3">
                    <p className="text-[13px] font-medium">
                      {report.summary || "Company research"}
                    </p>
                    <p className="mt-1 text-[11px] text-foreground-muted">
                      {new Date(report.created_at).toLocaleString()}{" "}
                      {report.confidence_score != null
                        ? `· ${report.confidence_score}% confidence`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <p className="flex items-center gap-2 text-[12px] text-foreground-subtle">
          <MapPin className="h-3.5 w-3.5" />
          {company.headquarters || company.location || "Location not set"} <span>·</span>
          <Mail className="h-3.5 w-3.5" />
          {company.domain || "No domain"}
        </p>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] text-foreground-subtle">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-foreground-subtle">{label}</p>
      <p className="mt-1 text-[12.5px] text-foreground truncate">{value}</p>
    </div>
  );
}
