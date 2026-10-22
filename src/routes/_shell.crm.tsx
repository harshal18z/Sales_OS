import { createFileRoute } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DollarSign, Plus, Trash2, TrendingUp } from "lucide-react";
import { useCompanies, useDeals, useDeleteRow, useInsertRow, useUpdateRow } from "@/hooks/use-data";
import {
  EmptyState,
  Field,
  GhostBtn,
  Modal,
  PageHeader,
  PrimaryBtn,
  Select,
  TextArea,
  TextInput,
} from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/crm")({
  head: () => ({ meta: [{ title: "CRM — SalesOS AI" }] }),
  component: CRMPage,
});

const STAGES = ["discovery", "qualified", "proposal", "negotiation", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

function CRMPage() {
  const { data: deals = [], isLoading } = useDeals();
  const { data: companies = [] } = useCompanies();
  const insert = useInsertRow("crm_deals", "crm_deals");
  const update = useUpdateRow("crm_deals", "crm_deals");
  const del = useDeleteRow("crm_deals", "crm_deals");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const companyMap = useMemo(() => {
    const m = new Map<string, any>();
    (companies as any[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [companies]);

  const grouped = useMemo(() => {
    const g: Record<Stage, any[]> = {
      discovery: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      won: [],
      lost: [],
    };
    (deals as any[]).forEach((d) => {
      const s = (d.stage as Stage) ?? "discovery";
      if (g[s]) g[s].push(d);
    });
    return g;
  }, [deals]);

  const totals = useMemo(() => {
    const total = (deals as any[]).reduce((s, d) => s + Number(d.value ?? 0), 0);
    const weighted = (deals as any[]).reduce(
      (s, d) => s + Number(d.value ?? 0) * (Number(d.probability ?? 0) / 100),
      0,
    );
    const won = (deals as any[])
      .filter((d) => d.stage === "won")
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    return { total, weighted, won };
  }, [deals]);

  async function moveStage(id: string, stage: Stage) {
    try {
      await update.mutateAsync({ id, values: { stage } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this deal?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Pipeline"
        subtitle={`${deals.length} deals · ${fmtMoney(totals.total)} total · ${fmtMoney(totals.weighted)} weighted`}
        action={
          <PrimaryBtn onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> New deal
          </PrimaryBtn>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={DollarSign} label="Total pipeline" value={fmtMoney(totals.total)} />
          <StatCard icon={TrendingUp} label="Weighted forecast" value={fmtMoney(totals.weighted)} />
          <StatCard icon={DollarSign} label="Closed won" value={fmtMoney(totals.won)} />
          <StatCard
            icon={TrendingUp}
            label="Open deals"
            value={String(deals.length - grouped.won.length - grouped.lost.length)}
          />
        </div>

        {isLoading ? (
          <div className="text-[12px] text-foreground-subtle">Loading pipeline…</div>
        ) : deals.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No deals yet"
            description="Add your first deal to start building the pipeline."
            action={
              <PrimaryBtn onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> New deal
              </PrimaryBtn>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {STAGES.map((stage) => (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) moveStage(dragId, stage);
                  setDragId(null);
                }}
                className="rounded-xl border border-border bg-surface min-h-[300px] flex flex-col"
              >
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-medium text-foreground capitalize">
                      {stage}
                    </span>
                    <span className="text-[10px] text-foreground-subtle">
                      {grouped[stage].length}
                    </span>
                  </div>
                  <span className="text-[10px] text-foreground-subtle">
                    {fmtMoney(grouped[stage].reduce((s, d) => s + Number(d.value ?? 0), 0))}
                  </span>
                </div>
                <div className="flex-1 p-2 space-y-1.5 overflow-auto">
                  {grouped[stage].map((d: any) => {
                    const c = companyMap.get(d.company_id);
                    return (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onClick={() => setEditing(d)}
                        className="rounded-lg border border-border bg-surface hover:border-border-strong transition p-2.5 cursor-grab active:cursor-grabbing"
                      >
                        <p className="text-[12.5px] font-medium text-foreground truncate">
                          {d.name}
                        </p>
                        <p className="text-[11px] text-foreground-subtle truncate mt-0.5">
                          {c?.name ?? "—"}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11.5px] text-foreground font-medium">
                            {fmtMoney(Number(d.value ?? 0))}
                          </span>
                          <span className="text-[10px] text-foreground-subtle">
                            {d.probability ?? 0}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-surface-muted overflow-hidden">
                          <div
                            className="h-full bg-foreground rounded-full"
                            style={{ width: `${d.probability ?? 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DealForm
        open={creating}
        companies={companies as any[]}
        onClose={() => setCreating(false)}
        onSubmit={async (v) => {
          try {
            await insert.mutateAsync(v);
            toast.success("Deal created");
            setCreating(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <DealForm
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
        onDelete={async () => {
          await handleDelete(editing.id);
          setEditing(null);
        }}
      />
    </div>
  );
}

function StatCard({
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
      <div className="mt-2 text-[20px] font-semibold text-foreground tracking-tight">{value}</div>
    </div>
  );
}

function DealForm({
  open,
  onClose,
  onSubmit,
  companies,
  initial,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: any) => Promise<void>;
  companies: any[];
  initial?: any;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [company_id, setCompany] = useState(initial?.company_id ?? "");
  const [stage, setStage] = useState<string>(initial?.stage ?? "discovery");
  const [value, setValue] = useState<number>(Number(initial?.value ?? 0));
  const [probability, setProbability] = useState<number>(Number(initial?.probability ?? 20));
  const [expected_close_date, setClose] = useState<string>(initial?.expected_close_date ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  useMemo(() => {
    setName(initial?.name ?? "");
    setCompany(initial?.company_id ?? "");
    setStage(initial?.stage ?? "discovery");
    setValue(Number(initial?.value ?? 0));
    setProbability(Number(initial?.probability ?? 20));
    setClose(initial?.expected_close_date ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit deal" : "New deal"}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          await onSubmit({
            name,
            company_id: company_id || null,
            stage,
            value,
            probability,
            expected_close_date: expected_close_date || null,
            notes: notes || null,
          });
          setSubmitting(false);
        }}
        className="space-y-3"
      >
        <Field label="Deal name">
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
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
          <Field label="Stage">
            <Select value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Value ($)">
            <TextInput
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </Field>
          <Field label="Probability %">
            <TextInput
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
            />
          </Field>
          <Field label="Close date">
            <TextInput
              type="date"
              value={expected_close_date ?? ""}
              onChange={(e) => setClose(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs text-foreground-muted hover:text-foreground mr-auto"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn type="submit" disabled={submitting || !name}>
            {initial ? "Save" : "Create"}
          </PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}
