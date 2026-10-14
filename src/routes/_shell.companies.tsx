import { createFileRoute, useNavigate } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Download, GitMerge, Loader2, Mail, Megaphone, Pencil, Plus, RefreshCw, Search, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@/lib/query";
import { useWorkspace } from "@/hooks/use-workspace";
import { useCompanies, useContacts, useDeleteRow, useInsertRow, useLeads, useUpdateRow } from "@/hooks/use-data";
import { useAIDiscoverDecisionMakers, useAIEmail, useAIResearch } from "@/hooks/use-ai";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import {
  EmptyState, Field, GhostBtn, Modal, PageHeader, PrimaryBtn, Select,
  SkeletonList, TextArea, TextInput,
} from "@/components/app/data-ui";
import { ImportWizardModal } from "@/components/import/import-wizard";
import { BulkToolbar } from "@/components/import/bulk-toolbar";
import { DuplicateManagerModal } from "@/components/import/duplicate-manager";
import { downloadCSV, toCSV } from "@/lib/import/utils";

export const Route = createFileRoute("/_shell/companies")({
  head: () => ({ meta: [{ title: "Companies — SalesOS AI" }] }),
  component: CompaniesPage,
});

const PAGE_SIZE = 20;

function CompaniesPage() {
  const { data: rows = [], isLoading } = useCompanies();
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const members = useWorkspaceMembers();
  const insert = useInsertRow("companies", "companies");
  const insertCampaign = useInsertRow("campaigns", "campaigns");
  const update = useUpdateRow("companies", "companies");
  const del = useDeleteRow("companies", "companies");
  const research = useAIResearch();
  const discover = useAIDiscoverDecisionMakers();
  const email = useAIEmail();
  const { data: allLeads = [] } = useLeads();
  const { data: allContacts = [] } = useContacts();

  const [query, setQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignOwner, setAssignOwner] = useState("");
  const [busy, setBusy] = useState(false);

  const industries = useMemo(() => {
    const s = new Set<string>();
    (rows as any[]).forEach((r) => r.industry && s.add(r.industry));
    return Array.from(s);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows as any[]).filter((r) => {
      const matchQ = !q || r.name?.toLowerCase().includes(q) || r.domain?.toLowerCase().includes(q);
      const matchI = !industryFilter || r.industry === industryFilter;
      return matchQ && matchI;
    });
  }, [rows, query, industryFilter]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const selected = (rows as any[]).find((r) => r.id === selectedId) ?? null;

  async function handleDelete(id: string) {
    if (!confirm("Delete this company?")) return;
    try {
      await del.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function togglePage() {
    const allSelected = paged.every((c: any) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of paged as any[]) allSelected ? next.delete(c.id) : next.add(c.id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} companies?`)) return;
    setBusy(true);
    const { error } = await supabase.from("companies").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    if (error) toast.error(error.message);
    else {
      if (workspaceId) await supabase.from("activity_logs").insert({ workspace_id: workspaceId, entity_type: "companies", entity_id: null, action: "bulk.delete", metadata: { count: ids.length } as never });
      toast.success(`Deleted ${ids.length} companies`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["companies"] });
    }
    setBusy(false);
  }

  async function handleBulkAssignOwner() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !assignOwner) return;
    setBusy(true);
    const { error } = await supabase.from("companies").update({ owner_id: assignOwner }).in("id", ids);
    if (error) toast.error(error.message);
    else {
      if (workspaceId) await supabase.from("activity_logs").insert({ workspace_id: workspaceId, entity_type: "companies", entity_id: null, action: "bulk.assign_owner", metadata: { count: ids.length, owner_id: assignOwner } as never });
      toast.success(`Assigned ${ids.length} companies`);
      setAssignOwner("");
      qc.invalidateQueries({ queryKey: ["companies"] });
    }
    setBusy(false);
  }

  function handleExport() {
    const source = selectedIds.size > 0 ? filtered.filter((r: any) => selectedIds.has(r.id)) : filtered;
    if (source.length === 0) { toast.error("Nothing to export"); return; }
    const csv = toCSV(
      source.map((r: any) => ({
        name: r.name, domain: r.domain, industry: r.industry, size: r.size,
        revenue: r.revenue, location: r.location, description: r.description,
      })),
      ["name", "domain", "industry", "size", "revenue", "location", "description"],
    );
    downloadCSV(`companies-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${source.length} companies`);
  }

  function companyUrl(c: any): string | null {
    if (!c) return null;
    if (c.website) return c.website;
    if (c.domain) return c.domain.startsWith("http") ? c.domain : `https://${c.domain}`;
    return null;
  }

  async function handleRefreshResearch() {
    const url = companyUrl(selected);
    if (!url) { toast.error("Add a website or domain first"); return; }
    try {
      await research.mutateAsync({ url, companyId: selected.id, force: true });
    } catch { /* toast handled */ }
  }

  async function handleDiscoverDecisionMakers() {
    if (!selected) return;
    try {
      const res: any = await discover.mutateAsync({ companyId: selected.id, count: 8 });
      const o = res?.output ?? res;
      toast.success(`${o?.created ?? 0} new · ${o?.updated ?? 0} updated`);
    } catch { /* toast handled */ }
  }

  async function handleGenerateOutreach() {
    if (!selected) return;
    try {
      await email.mutateAsync({
        emailType: "cold",
        companyId: selected.id,
        save: true,
      });
      navigate({ to: "/emails" });
    } catch { /* toast handled */ }
  }

  async function handleCreateCampaign() {
    if (!selected) return;
    try {
      const row = await insertCampaign.mutateAsync({
        name: `Outreach — ${selected.name}`,
        status: "draft",
        channel: "email",
        goal: `Outreach sequence for ${selected.name}`,
        description: selected.ai_summary ?? null,
      });
      const id = (row as any)?.id;
      toast.success("Campaign created");
      if (id) navigate({ to: "/campaigns/$id", params: { id } });
      else navigate({ to: "/campaigns" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Companies"
        subtitle={`${filtered.length} of ${rows.length}`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                placeholder="Search companies"
                className="h-8 w-56 rounded-md bg-surface-muted border border-border pl-8 pr-3 text-xs text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={industryFilter}
              onChange={(e) => { setIndustryFilter(e.target.value); setPage(0); }}
              className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
            >
              <option value="">All industries</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <GhostBtn onClick={() => setDupOpen(true)}><GitMerge className="h-3 w-3" /> Duplicates</GhostBtn>
            <GhostBtn onClick={handleExport}><Download className="h-3 w-3" /> Export</GhostBtn>
            <GhostBtn onClick={() => setImportOpen(true)}><Upload className="h-3 w-3" /> Import</GhostBtn>
            <PrimaryBtn onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New company
            </PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-0 min-h-[calc(100vh-8rem)]">
        {/* List */}
        <div className="col-span-12 lg:col-span-7 border-r border-border">
          <div className="p-6">
            {isLoading ? (
              <SkeletonList count={6} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={rows.length === 0 ? "No companies yet" : "No matches"}
                description={rows.length === 0 ? "Add your first target account to start building intelligence." : "Try adjusting your filters."}
                action={rows.length === 0 && (
                  <PrimaryBtn onClick={() => setCreating(true)}>
                    <Plus className="h-3.5 w-3.5" /> New company
                  </PrimaryBtn>
                )}
              />
            ) : (
              <>
                <BulkToolbar count={selectedIds.size} onClear={clearSelection}>
                  <GhostBtn onClick={handleExport}><Download className="h-3 w-3" /> Export selected</GhostBtn>
                  <select
                    value={assignOwner}
                    onChange={(e) => setAssignOwner(e.target.value)}
                    className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
                  >
                    <option value="">Assign owner…</option>
                    {(members.data ?? []).map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email ?? m.user_id.slice(0, 8)}</option>
                    ))}
                  </select>
                  <GhostBtn onClick={handleBulkAssignOwner} disabled={busy || !assignOwner}>
                    <UserPlus className="h-3 w-3" /> Assign
                  </GhostBtn>
                  <GhostBtn onClick={handleBulkDelete} disabled={busy}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </GhostBtn>
                </BulkToolbar>
                <div className="rounded-xl border border-border bg-surface overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead className="bg-surface-muted/50 border-b border-border">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-foreground-subtle">
                        <th className="px-3 py-2.5 w-8">
                          <input
                            type="checkbox"
                            aria-label="Select page"
                            checked={paged.length > 0 && paged.every((c: any) => selectedIds.has(c.id))}
                            onChange={togglePage}
                            className="h-3.5 w-3.5 rounded border-border"
                          />
                        </th>
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Industry</th>
                        <th className="px-4 py-2.5 font-medium">Size</th>
                        <th className="px-4 py-2.5 font-medium">Location</th>
                        <th className="px-4 py-2.5 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paged.map((c: any) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className={`cursor-pointer hover:bg-surface-muted/40 transition ${selectedId === c.id ? "bg-surface-muted/60" : ""}`}
                        >
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${c.name}`}
                              checked={selectedIds.has(c.id)}
                              onChange={() => toggleRow(c.id)}
                              className="h-3.5 w-3.5 rounded border-border"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-md bg-surface-muted border border-border grid place-items-center text-[10px] font-medium text-foreground-muted">
                                {c.name?.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-foreground font-medium truncate">{c.name}</div>
                                {c.domain && <div className="text-[11px] text-foreground-subtle truncate">{c.domain}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground-muted">{c.industry ?? "—"}</td>
                          <td className="px-4 py-3 text-foreground-muted">{c.size ?? "—"}</td>
                          <td className="px-4 py-3 text-foreground-muted">{c.location ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                                className="h-7 w-7 grid place-items-center rounded-md border border-border text-foreground-muted hover:text-foreground"
                                aria-label="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                className="h-7 w-7 grid place-items-center rounded-md border border-border text-foreground-muted hover:text-foreground"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-[12px] text-foreground-muted">
                    <span>Page {page + 1} of {totalPages}</span>
                    <div className="flex gap-2">
                      <GhostBtn onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</GhostBtn>
                      <GhostBtn onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</GhostBtn>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detail */}
        <aside className="col-span-12 lg:col-span-5 bg-surface/40">
          <div className="p-6">
            {!selected ? (
              <div className="text-[12px] text-foreground-subtle">Select a company to see details.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-surface-muted border border-border grid place-items-center text-[13px] font-medium text-foreground-muted">
                    {selected.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[16px] font-semibold text-foreground">{selected.name}</h2>
                    {(selected.website || selected.domain) && (
                      <a
                        href={selected.website ?? `https://${selected.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] text-foreground-muted hover:text-foreground"
                      >
                        {selected.website ?? selected.domain}
                      </a>
                    )}
                  </div>
                  <GhostBtn onClick={() => setEditing(selected)}>
                    <Pencil className="h-3 w-3" /> Edit
                  </GhostBtn>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2.5">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <GhostBtn onClick={handleRefreshResearch} disabled={research.isPending}>
                      {research.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Refresh Research
                    </GhostBtn>
                    <GhostBtn onClick={handleDiscoverDecisionMakers} disabled={discover.isPending}>
                      {discover.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                      Discover Decision Makers
                    </GhostBtn>
                    <GhostBtn onClick={handleGenerateOutreach} disabled={email.isPending}>
                      {email.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                      Generate Outreach
                    </GhostBtn>
                    <GhostBtn onClick={handleCreateCampaign} disabled={insertCampaign.isPending}>
                      {insertCampaign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
                      Create Campaign
                    </GhostBtn>
                  </div>
                </div>

                <DiscoveredLeads
                  leads={(allLeads as any[]).filter((l) => l.company_id === selected.id)}
                  contacts={allContacts as any[]}
                  onOpen={() => navigate({ to: "/leads" })}
                />




                <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4">
                  <MetaRow label="Industry" value={selected.industry} />
                  <MetaRow label="Business Model" value={selected.business_model} />
                  <MetaRow label="Size" value={selected.size} />
                  <MetaRow label="Revenue" value={selected.revenue} />
                  <MetaRow label="Location" value={selected.location} />
                  <MetaRow
                    label="Last Research"
                    value={selected.last_research_at ? new Date(selected.last_research_at).toLocaleString() : null}
                  />
                </dl>

                {(selected.icp_score != null || selected.confidence_score != null) && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">AI Scores</p>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreBar label="ICP Fit" value={selected.icp_score} />
                      <ScoreBar label="Confidence" value={selected.confidence_score} />
                    </div>
                  </div>
                )}

                {selected.ai_summary && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">AI Summary</p>
                    <p className="text-[13px] text-foreground-muted leading-relaxed whitespace-pre-wrap">{selected.ai_summary}</p>
                  </div>
                )}

                {selected.recommended_outreach && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">Recommended Outreach</p>
                    <p className="text-[13px] text-foreground-muted leading-relaxed whitespace-pre-wrap">{selected.recommended_outreach}</p>
                  </div>
                )}

                {selected.products?.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">Products / Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.products.map((p: string) => (
                        <span key={p} className="text-[11px] rounded-md bg-surface-muted border border-border px-2 py-0.5 text-foreground-muted">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.description && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">Description</p>
                    <p className="text-[13px] text-foreground-muted leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                  </div>
                )}

                {selected.tech_stack?.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">Tech Stack</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.tech_stack.map((t: string) => (
                        <span key={t} className="text-[11px] rounded-md bg-surface-muted border border-border px-2 py-0.5 text-foreground-muted">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <CompanyForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (values) => {
          try {
            await insert.mutateAsync(values);
            toast.success("Company created");
            setCreating(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <CompanyForm
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (values) => {
          try {
            await update.mutateAsync({ id: editing.id, values });
            toast.success("Updated");
            setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <ImportWizardModal open={importOpen} entity="companies" onClose={() => setImportOpen(false)} />
      <DuplicateManagerModal open={dupOpen} kind="companies" onClose={() => setDupOpen(false)} />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className="text-[13px] text-foreground mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value?: number | null }) {
  const v = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <dt className="text-[11px] uppercase tracking-wider text-foreground-subtle">{label}</dt>
        <dd className="text-[13px] text-foreground font-medium">{v != null ? `${v}` : "—"}</dd>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full bg-foreground" style={{ width: `${v ?? 0}%` }} />
      </div>
    </div>
  );
}

function DiscoveredLeads({ leads, contacts, onOpen }: { leads: any[]; contacts: any[]; onOpen: (id: string) => void }) {
  if (!leads?.length) return null;
  const sorted = [...leads].sort((a, b) => {
    const ta = new Date(a.ai_scored_at ?? a.last_activity_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.ai_scored_at ?? b.last_activity_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
  const latest = sorted.slice(0, 5);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">Discovered Leads</p>
        <span className="text-[11px] text-foreground-muted">{leads.length} total</span>
      </div>
      <ul className="divide-y divide-border">
        {latest.map((l) => {
          const insight = (l.ai_insight ?? {}) as Record<string, any>;
          const contact = contacts.find((c) => c.id === l.contact_id);
          const name = contact?.full_name ?? insight.name ?? "Lead";
          const title = contact?.title ?? "";
          return (
            <li key={l.id}>
              <button
                onClick={() => onOpen(l.id)}
                className="w-full text-left py-2 flex items-center justify-between hover:bg-surface-muted rounded-md px-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-foreground truncate">{name}</p>
                  <p className="text-[11px] text-foreground-subtle truncate">
                    {[title, insight.department, insight.seniority].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {typeof l.score === "number" && (
                  <span className="text-[11px] text-foreground-muted ml-2">{l.score}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompanyForm({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: any) => Promise<void>;
  initial?: any;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [size, setSize] = useState(initial?.size ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  // reset when initial changes
  useMemo(() => {
    setName(initial?.name ?? "");
    setDomain(initial?.domain ?? "");
    setIndustry(initial?.industry ?? "");
    setSize(initial?.size ?? "");
    setLocation(initial?.location ?? "");
    setDescription(initial?.description ?? "");
  }, [initial]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit company" : "New company"}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          await onSubmit({
            name,
            domain: domain || null,
            industry: industry || null,
            size: size || null,
            location: location || null,
            description: description || null,
          });
          setSubmitting(false);
        }}
        className="space-y-3"
      >
        <Field label="Name"><TextInput required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Domain"><TextInput value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" /></Field>
          <Field label="Industry"><TextInput value={industry} onChange={(e) => setIndustry(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Size">
            <Select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">—</option>
              {["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Location"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        </div>
        <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn type="submit" disabled={submitting || !name}>{initial ? "Save" : "Create"}</PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}
