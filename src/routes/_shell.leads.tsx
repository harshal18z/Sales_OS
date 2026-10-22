import { createFileRoute, useNavigate } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  Download,
  Flame,
  Linkedin,
  Mail,
  Megaphone,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Snowflake,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@/lib/query";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  useCampaigns,
  useCompanies,
  useDeleteRow,
  useInsertRow,
  useLeads,
  useUpdateRow,
} from "@/hooks/use-data";
import { useAIEmail, useAILeadScore } from "@/hooks/use-ai";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { ImportWizardModal } from "@/components/import/import-wizard";
import { BulkToolbar } from "@/components/import/bulk-toolbar";
import { downloadCSV, toCSV } from "@/lib/import/utils";
import {
  EmptyState,
  Field,
  GhostBtn,
  Modal,
  PageHeader,
  PrimaryBtn,
  Select,
  SkeletonList,
  TextArea,
  TextInput,
} from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/leads")({
  head: () => ({ meta: [{ title: "Leads — SalesOS AI" }] }),
  component: LeadsPage,
});

const STAGES = ["new", "working", "engaged", "qualified", "unqualified"] as const;

function timeAgo(iso: string) {
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

function LeadsPage() {
  const { data: rows = [], isLoading } = useLeads();
  const { data: companies = [] } = useCompanies();
  const insert = useInsertRow("leads", "leads");
  const update = useUpdateRow("leads", "leads");
  const del = useDeleteRow("leads", "leads");
  const scoreAI = useAILeadScore();

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"score" | "intent" | "priority" | "recent">("score");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignOwner, setAssignOwner] = useState("");
  const [bulkStage, setBulkStage] = useState("");
  const [busy, setBusy] = useState(false);
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const members = useWorkspaceMembers();

  const companyMap = useMemo(() => {
    const m = new Map<string, any>();
    (companies as any[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [companies]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows as any[]) {
      const d = r.ai_insight?.department;
      if (typeof d === "string" && d.trim()) set.add(d);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const priorityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const arr = (rows as any[]).filter((r) => {
      const c = companyMap.get(r.company_id);
      const insight = (r.ai_insight ?? {}) as Record<string, any>;
      const matchQ =
        !q ||
        c?.name?.toLowerCase().includes(q) ||
        r.source?.toLowerCase().includes(q) ||
        String(insight.full_name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(insight.role ?? insight.title ?? "")
          .toLowerCase()
          .includes(q);
      const matchS = !stageFilter || r.stage === stageFilter;
      const matchDept = !departmentFilter || insight.department === departmentFilter;
      const matchConf = !confidenceFilter || insight.confidence_label === confidenceFilter;
      let matchAvail = true;
      if (availabilityFilter === "email") matchAvail = !!insight.email_available;
      else if (availabilityFilter === "phone") matchAvail = !!insight.phone_available;
      else if (availabilityFilter === "linkedin") matchAvail = !!insight.linkedin_available;
      else if (availabilityFilter === "verified_email")
        matchAvail = insight.email_quality === "verified";
      return matchQ && matchS && matchDept && matchConf && matchAvail;
    });
    return arr.sort((a, b) => {
      if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === "intent") return (b.intent_score ?? 0) - (a.intent_score ?? 0);
      if (sortBy === "priority")
        return (priorityRank[b.priority ?? ""] ?? 0) - (priorityRank[a.priority ?? ""] ?? 0);
      return (
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime()
      );
    });
  }, [
    rows,
    query,
    stageFilter,
    departmentFilter,
    confidenceFilter,
    availabilityFilter,
    sortBy,
    companyMap,
  ]);

  const selected = (rows as any[]).find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  async function handleStageChange(id: string, stage: string) {
    try {
      await update.mutateAsync({ id, values: { stage } });
      toast.success(`Moved to ${stage}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    const allSelected = filtered.every((l: any) => selectedIds.has(l.id));
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((l: any) => l.id)));
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !confirm(`Delete ${ids.length} leads?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);
    if (error) toast.error(error.message);
    else {
      if (workspaceId)
        await supabase
          .from("activity_logs")
          .insert({
            workspace_id: workspaceId,
            entity_type: "leads",
            entity_id: null,
            action: "bulk.delete",
            metadata: { count: ids.length } as never,
          });
      toast.success(`Deleted ${ids.length}`);
      clearSelection();
      qc.invalidateQueries({ queryKey: ["leads"] });
    }
    setBusy(false);
  }
  async function handleBulkStage() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !bulkStage) return;
    setBusy(true);
    const { error } = await supabase.from("leads").update({ stage: bulkStage }).in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success(`Moved ${ids.length} to ${bulkStage}`);
      setBulkStage("");
      qc.invalidateQueries({ queryKey: ["leads"] });
    }
    setBusy(false);
  }
  async function handleBulkAssign() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !assignOwner) return;
    setBusy(true);
    const { error } = await supabase.from("leads").update({ owner_id: assignOwner }).in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success(`Assigned ${ids.length}`);
      setAssignOwner("");
      qc.invalidateQueries({ queryKey: ["leads"] });
    }
    setBusy(false);
  }
  async function handleBulkAnalyze() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const id of ids) {
      try {
        await scoreAI.mutateAsync({ leadId: id });
        ok++;
      } catch {
        /* ignore */
      }
    }
    toast.success(`Scored ${ok} of ${ids.length}`);
    setBusy(false);
  }
  function handleExport() {
    const source =
      selectedIds.size > 0 ? filtered.filter((l: any) => selectedIds.has(l.id)) : filtered;
    if (source.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const csv = toCSV(
      source.map((l: any) => ({
        company: companyMap.get(l.company_id)?.name ?? "",
        stage: l.stage,
        source: l.source,
        score: l.score,
        intent_score: l.intent_score,
        temperature: l.temperature,
        priority: l.priority,
        notes: l.notes,
      })),
      ["company", "stage", "source", "score", "intent_score", "temperature", "priority", "notes"],
    );
    downloadCSV(`leads-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${source.length}`);
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Leads"
        subtitle={`${filtered.length} of ${rows.length}`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads"
                className="h-8 w-56 rounded-md bg-surface-muted border border-border pl-8 pr-3 text-xs text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
              title="Filter by department"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
              title="Filter by confidence"
            >
              <option value="">Any confidence</option>
              <option value="high">High confidence</option>
              <option value="medium">Medium confidence</option>
              <option value="low">Low confidence</option>
            </select>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
              title="Filter by contact availability"
            >
              <option value="">Any contact</option>
              <option value="email">Has email</option>
              <option value="verified_email">Verified email</option>
              <option value="phone">Has phone</option>
              <option value="linkedin">Has LinkedIn</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
              title="Sort by"
            >
              <option value="score">Sort: AI Score</option>
              <option value="intent">Sort: Intent</option>
              <option value="priority">Sort: Priority</option>
              <option value="recent">Sort: Recent</option>
            </select>
            <GhostBtn onClick={handleExport}>
              <Download className="h-3 w-3" /> Export
            </GhostBtn>
            <GhostBtn onClick={() => setImportOpen(true)}>
              <Upload className="h-3 w-3" /> Import
            </GhostBtn>
            <PrimaryBtn onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New lead
            </PrimaryBtn>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-0 min-h-[calc(100vh-8rem)]">
        <div className="col-span-12 lg:col-span-7 border-r border-border">
          <div className="p-6">
            {isLoading ? (
              <SkeletonList count={6} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={rows.length === 0 ? "No leads yet" : "No matches"}
                description={
                  rows.length === 0
                    ? "Add your first lead to start tracking."
                    : "Try adjusting your filters."
                }
                action={
                  rows.length === 0 && (
                    <PrimaryBtn onClick={() => setCreating(true)}>
                      <Plus className="h-3.5 w-3.5" /> New lead
                    </PrimaryBtn>
                  )
                }
              />
            ) : (
              <>
                <BulkToolbar count={selectedIds.size} onClear={clearSelection}>
                  <GhostBtn onClick={handleBulkAnalyze} disabled={busy}>
                    <Sparkles className="h-3 w-3" /> Analyze
                  </GhostBtn>
                  <select
                    value={bulkStage}
                    onChange={(e) => setBulkStage(e.target.value)}
                    className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
                  >
                    <option value="">Change stage…</option>
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <GhostBtn onClick={handleBulkStage} disabled={busy || !bulkStage}>
                    Apply
                  </GhostBtn>
                  <select
                    value={assignOwner}
                    onChange={(e) => setAssignOwner(e.target.value)}
                    className="h-8 rounded-md bg-surface-muted border border-border px-2 text-xs text-foreground"
                  >
                    <option value="">Assign owner…</option>
                    {(members.data ?? []).map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name ?? m.email ?? m.user_id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <GhostBtn onClick={handleBulkAssign} disabled={busy || !assignOwner}>
                    <UserPlus className="h-3 w-3" /> Assign
                  </GhostBtn>
                  <GhostBtn onClick={handleExport}>
                    <Download className="h-3 w-3" /> Export
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
                            aria-label="Select all"
                            checked={
                              filtered.length > 0 &&
                              filtered.every((l: any) => selectedIds.has(l.id))
                            }
                            onChange={toggleAll}
                            className="h-3.5 w-3.5 rounded border-border"
                          />
                        </th>
                        <th className="px-4 py-2.5 font-medium">Company</th>
                        <th className="px-4 py-2.5 font-medium">Temp</th>
                        <th className="px-4 py-2.5 font-medium">Stage</th>
                        <th className="px-4 py-2.5 font-medium">AI Score</th>
                        <th className="px-4 py-2.5 font-medium">Intent</th>
                        <th className="px-4 py-2.5 font-medium">Next action</th>
                        <th className="px-4 py-2.5 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((l: any) => {
                        const c = companyMap.get(l.company_id);
                        const scored = !!l.ai_scored_at;
                        const isScoring = scoreAI.isPending && scoreAI.variables?.leadId === l.id;
                        return (
                          <tr
                            key={l.id}
                            onClick={() => setSelectedId(l.id)}
                            className={`cursor-pointer hover:bg-surface-muted/40 transition ${selectedId === l.id ? "bg-surface-muted/60" : ""}`}
                          >
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label="Select lead"
                                checked={selectedIds.has(l.id)}
                                onChange={() => toggleRow(l.id)}
                                className="h-3.5 w-3.5 rounded border-border"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-foreground font-medium truncate">
                                {c?.name ?? "—"}
                              </div>
                              {c?.industry && (
                                <div className="text-[11px] text-foreground-subtle truncate">
                                  {c.industry}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <TempBadge t={l.temperature} />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={l.stage}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleStageChange(l.id, e.target.value)}
                                className="h-7 rounded-md bg-surface-muted border border-border px-2 text-[11px] text-foreground"
                              >
                                {STAGES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              {scored ? (
                                <div className="flex items-center gap-2">
                                  <PriorityDot p={l.priority} />
                                  <span className="text-foreground font-medium tabular-nums">
                                    {l.score ?? 0}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    scoreAI.mutate({ leadId: l.id });
                                  }}
                                  disabled={isScoring}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 h-6 text-[11px] text-foreground-muted hover:text-foreground disabled:opacity-60"
                                >
                                  <Sparkles className="h-2.5 w-2.5" />
                                  {isScoring ? "Analyzing…" : "Analyze"}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-foreground-muted tabular-nums">
                              {l.intent_score ?? 0}
                            </td>
                            <td className="px-4 py-3 text-foreground-muted truncate max-w-[180px]">
                              {l.next_action ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditing(l);
                                  }}
                                  className="h-7 w-7 grid place-items-center rounded-md border border-border text-foreground-muted hover:text-foreground"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(l.id);
                                  }}
                                  className="h-7 w-7 grid place-items-center rounded-md border border-border text-foreground-muted hover:text-foreground"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-5 bg-surface/40">
          <div className="p-6">
            {!selected ? (
              <div className="text-[12px] text-foreground-subtle">
                Select a lead to see the timeline.
              </div>
            ) : (
              <LeadDetailPanel
                lead={selected}
                company={companyMap.get(selected.company_id)}
                onEdit={() => setEditing(selected)}
              />
            )}
          </div>
        </aside>
      </div>

      <LeadForm
        open={creating}
        companies={companies as any[]}
        onClose={() => setCreating(false)}
        onSubmit={async (v) => {
          try {
            await insert.mutateAsync(v);
            toast.success("Lead created");
            setCreating(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <LeadForm
        open={!!editing}
        initial={editing}
        companies={companies as any[]}
        onClose={() => setEditing(null)}
        onSubmit={async (v) => {
          try {
            await update.mutateAsync({ id: editing.id, values: v });
            toast.success("Updated");
            setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <ImportWizardModal open={importOpen} entity="leads" onClose={() => setImportOpen(false)} />
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

function LeadDetailPanel({
  lead,
  company,
  onEdit,
}: {
  lead: any;
  company: any;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const scoreAI = useAILeadScore();
  const emailAI = useAIEmail();
  const updateLead = useUpdateRow("leads", "leads");
  const { workspaceId } = useWorkspace();
  const { data: campaigns = [] } = useCampaigns();
  const [addCampaignOpen, setAddCampaignOpen] = useState(false);
  const [chosenCampaign, setChosenCampaign] = useState<string>(lead.campaign_id ?? "");

  const insight = (lead.ai_insight ?? {}) as Record<string, any>;

  const { data: contact } = useQuery({
    queryKey: ["contact", lead.contact_id],
    enabled: !!lead.contact_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", lead.contact_id)
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
        .eq("id", company.latest_research_report_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: emails = [] } = useQuery({
    queryKey: ["emails", "lead", lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("emails")
        .select("id, subject, status, sent_at, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activity_logs", "lead", lead.id],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, metadata, created_at")
        .eq("workspace_id", workspaceId!)
        .eq("entity_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const linkedCampaign = (campaigns as any[]).find((c) => c.id === lead.campaign_id);
  const fullName = contact?.full_name ?? insight.name ?? insight.full_name ?? null;
  const title = contact?.title ?? insight.title ?? insight.job_title ?? null;
  const email = contact?.email ?? insight.email ?? null;
  const phone = contact?.phone ?? insight.phone ?? null;
  const linkedin = contact?.linkedin_url ?? insight.linkedin_url ?? null;
  const department = insight.department ?? null;
  const seniority = insight.seniority ?? null;
  const confidence = insight.confidence_score ?? insight.confidence ?? lead.score ?? null;
  const discoveryReason = insight.discovery_reason ?? insight.reason ?? insight.why ?? null;
  const discoveryTs = insight.discovered_at ?? lead.created_at;

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

  async function handleAddCampaign() {
    if (!chosenCampaign) return;
    try {
      await updateLead.mutateAsync({ id: lead.id, values: { campaign_id: chosenCampaign } });
      toast.success("Added to campaign");
      setAddCampaignOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">Lead</p>
          <h2 className="text-[16px] font-semibold text-foreground mt-1 truncate">
            {fullName ?? "Not yet discovered"}
          </h2>
          <p className="text-[12px] text-foreground-muted mt-0.5 truncate">
            {title ?? "—"}
            {company?.name ? ` · ${company.name}` : ""}
          </p>
          <p className="text-[11px] text-foreground-subtle mt-0.5">Stage: {lead.stage}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <GhostBtn onClick={onEdit}>
            <Pencil className="h-3 w-3" /> Edit
          </GhostBtn>
          <PrimaryBtn
            onClick={() => scoreAI.mutate({ leadId: lead.id })}
            disabled={scoreAI.isPending}
          >
            <Sparkles className="h-3 w-3" />
            {scoreAI.isPending && scoreAI.variables?.leadId === lead.id
              ? "Analyzing…"
              : lead.ai_scored_at
                ? "Re-analyze"
                : "Analyze"}
          </PrimaryBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="text-[11px] text-foreground-subtle">
          Last activity {timeAgo(lead.last_activity_at ?? lead.updated_at ?? lead.created_at)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <GhostBtn onClick={handleGenerateEmail} disabled={emailAI.isPending}>
          <Mail className="h-3 w-3" /> {emailAI.isPending ? "Drafting…" : "Generate Email"}
        </GhostBtn>
        <GhostBtn onClick={() => setAddCampaignOpen(true)}>
          <Megaphone className="h-3 w-3" /> Add to Campaign
        </GhostBtn>
        <GhostBtn onClick={() => navigate({ to: "/meetings" })}>
          <Calendar className="h-3 w-3" /> Schedule Meeting
        </GhostBtn>
        <GhostBtn
          onClick={() =>
            company?.id && navigate({ to: "/company/$id", params: { id: company.id } })
          }
          disabled={!company?.id}
        >
          <Building2 className="h-3 w-3" /> Open Company
        </GhostBtn>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
          Lead Intelligence
        </p>
        <div className="divide-y divide-border">
          <InfoRow icon={Users} label="Full name" value={fullName} />
          <InfoRow icon={Users} label="Job title" value={title} />
          <InfoRow icon={Users} label="Department" value={department} />
          <InfoRow icon={Users} label="Seniority" value={seniority} />
          <InfoRow icon={Building2} label="Company" value={company?.name} />
          <InfoRow
            icon={Mail}
            label="Work email"
            value={email}
            href={email ? `mailto:${email}` : undefined}
          />
          <InfoRow icon={Linkedin} label="LinkedIn" value={linkedin} href={linkedin ?? undefined} />
          <InfoRow
            icon={Phone}
            label="Phone"
            value={phone}
            href={phone ? `tel:${phone}` : undefined}
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
            value={discoveryTs ? new Date(discoveryTs).toLocaleString() : null}
          />
        </div>
      </div>

      {(company?.ai_summary || research?.summary || company?.recommended_outreach) && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
            Company & Research
          </p>
          {company?.ai_summary ? (
            <div>
              <p className="text-[11px] font-medium text-foreground mb-1">Company summary</p>
              <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                {company.ai_summary}
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-foreground-subtle italic">
              Company summary: Not yet discovered
            </p>
          )}
          {research?.summary ? (
            <div>
              <p className="text-[11px] font-medium text-foreground mb-1">Latest research</p>
              <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                {research.summary}
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-foreground-subtle italic">
              Latest research: Not yet discovered
            </p>
          )}
          {company?.recommended_outreach ? (
            <div>
              <p className="text-[11px] font-medium text-foreground mb-1">Recommended outreach</p>
              <p className="text-[12.5px] text-foreground-muted leading-relaxed">
                {company.recommended_outreach}
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-foreground-subtle italic">
              Recommended outreach: Not yet discovered
            </p>
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

      {lead.ai_insight &&
        (insight.why ||
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
                <p className="text-[12.5px] text-foreground-muted leading-relaxed">{insight.why}</p>
              </div>
            )}
            {insight.biggest_opportunity && (
              <div>
                <p className="text-[11px] font-medium text-foreground mb-1">Biggest opportunity</p>
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

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
          Related emails
        </p>
        {emails.length === 0 ? (
          <p className="text-[12px] text-foreground-subtle italic">Not yet discovered</p>
        ) : (
          <div className="space-y-1.5">
            {emails.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                <div className="min-w-0 flex-1 truncate text-foreground">
                  {e.subject ?? "(no subject)"}
                </div>
                <div className="text-[11px] text-foreground-subtle shrink-0">
                  {e.status}
                  {e.sent_at ? ` · ${timeAgo(e.sent_at)}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">
          Related campaign
        </p>
        {linkedCampaign ? (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-foreground truncate">{linkedCampaign.name}</span>
            <button
              onClick={() => navigate({ to: "/campaigns/$id", params: { id: linkedCampaign.id } })}
              className="text-[11px] text-foreground-muted hover:text-foreground"
            >
              Open →
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-foreground-subtle italic">Not yet discovered</p>
        )}
      </div>

      {lead.notes && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-1.5">
            Notes
          </p>
          <p className="text-[13px] text-foreground-muted whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-3">
          Activity timeline
        </p>
        <div className="space-y-2.5">
          <TimelineDot
            label={`Discovered${insight.source ? ` · ${insight.source}` : ""}`}
            time={timeAgo(lead.created_at)}
          />
          {activities.map((a: any) => (
            <TimelineDot
              key={a.id}
              label={`${a.action}${a.metadata?.name ? ` · ${a.metadata.name}` : ""}`}
              time={timeAgo(a.created_at)}
            />
          ))}
          {lead.updated_at && lead.updated_at !== lead.created_at && (
            <TimelineDot label="Updated" time={timeAgo(lead.updated_at)} />
          )}
        </div>
      </div>

      <Modal
        open={addCampaignOpen}
        onClose={() => setAddCampaignOpen(false)}
        title="Add to campaign"
      >
        <div className="space-y-3">
          <Field label="Campaign">
            <Select value={chosenCampaign} onChange={(e) => setChosenCampaign(e.target.value)}>
              <option value="">Select a campaign…</option>
              {(campaigns as any[]).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <GhostBtn onClick={() => setAddCampaignOpen(false)}>Cancel</GhostBtn>
            <PrimaryBtn
              onClick={handleAddCampaign}
              disabled={!chosenCampaign || updateLead.isPending}
            >
              <Send className="h-3 w-3" /> Add
            </PrimaryBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
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

function LeadForm({
  open,
  onClose,
  onSubmit,
  companies,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: any) => Promise<void>;
  companies: any[];
  initial?: any;
}) {
  const [company_id, setCompany] = useState(initial?.company_id ?? "");
  const [stage, setStage] = useState<string>(initial?.stage ?? "new");
  const [score, setScore] = useState<number>(initial?.score ?? 0);
  const [intent_score, setIntent] = useState<number>(initial?.intent_score ?? 0);
  const [source, setSource] = useState(initial?.source ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  useMemo(() => {
    setCompany(initial?.company_id ?? "");
    setStage(initial?.stage ?? "new");
    setScore(initial?.score ?? 0);
    setIntent(initial?.intent_score ?? 0);
    setSource(initial?.source ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit lead" : "New lead"}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          await onSubmit({
            company_id: company_id || null,
            stage,
            score: Number(score) || 0,
            intent_score: Number(intent_score) || 0,
            source: source || null,
            notes: notes || null,
          });
          setSubmitting(false);
        }}
        className="space-y-3"
      >
        <Field label="Company">
          <Select value={company_id} onChange={(e) => setCompany(e.target.value)}>
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Stage">
            <Select value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Score">
            <TextInput
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            />
          </Field>
          <Field label="Intent">
            <TextInput
              type="number"
              min={0}
              max={100}
              value={intent_score}
              onChange={(e) => setIntent(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Source">
          <TextInput
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Inbound, LinkedIn, Referral…"
          />
        </Field>
        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn type="submit" disabled={submitting}>
            {initial ? "Save" : "Create"}
          </PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}
