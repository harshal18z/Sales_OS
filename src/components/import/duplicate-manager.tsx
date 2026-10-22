import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GitMerge, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@/lib/query";
import { useCompanies, useContacts } from "@/hooks/use-data";
import { GhostBtn, Modal, PrimaryBtn } from "@/components/app/data-ui";
import { groupDuplicates, type DuplicateGroup } from "@/lib/import/utils";

type Kind = "companies" | "contacts";

export function DuplicateManagerModal({
  open,
  onClose,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  kind: Kind;
}) {
  const qc = useQueryClient();
  const companies = useCompanies();
  const contacts = useContacts();
  const rows = kind === "companies" ? (companies.data ?? []) : (contacts.data ?? []);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups: DuplicateGroup<any>[] = useMemo(() => {
    if (kind === "companies") {
      return groupDuplicates(rows as any[], (r) =>
        r.domain ? String(r.domain).toLowerCase() : null,
      );
    }
    return groupDuplicates(rows as any[], (r) => (r.email ? String(r.email).toLowerCase() : null));
  }, [rows, kind]);

  async function mergeGroup(group: DuplicateGroup<any>, keeperId: string) {
    setBusy(true);
    try {
      const dupIds = group.rows.filter((r) => r.id !== keeperId).map((r) => r.id as string);
      if (kind === "companies") {
        // Repoint child rows to keeper.
        await supabase.from("contacts").update({ company_id: keeperId }).in("company_id", dupIds);
        await supabase.from("leads").update({ company_id: keeperId }).in("company_id", dupIds);
        await supabase.from("crm_deals").update({ company_id: keeperId }).in("company_id", dupIds);
        await supabase.from("meetings").update({ company_id: keeperId }).in("company_id", dupIds);
        await supabase
          .from("research_reports")
          .update({ company_id: keeperId })
          .in("company_id", dupIds);
        await supabase
          .from("companies")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", dupIds);
      } else {
        await supabase.from("leads").update({ contact_id: keeperId }).in("contact_id", dupIds);
        await supabase
          .from("contacts")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", dupIds);
      }
      toast.success(`Merged ${dupIds.length} duplicate${dupIds.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: [kind] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["crm_deals"] });
      setExpanded(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Duplicate ${kind === "companies" ? "Companies" : "Contacts"}`}
    >
      <div className="space-y-3 min-w-[520px]">
        {groups.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-muted/40 p-6 text-center">
            <ShieldAlert className="h-4 w-4 text-foreground-muted mx-auto mb-2" />
            <p className="text-[13px] text-foreground">No duplicates detected.</p>
            <p className="text-[11.5px] text-foreground-subtle mt-1">
              Matching on {kind === "companies" ? "normalized domain" : "email address"}.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-foreground-muted">
              {groups.length} duplicate group{groups.length === 1 ? "" : "s"} found. Pick the record
              to keep — all references will be repointed and the others soft-deleted.
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.key} className="rounded-lg border border-border bg-surface">
                  <button
                    onClick={() => setExpanded(expanded === g.key ? null : g.key)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  >
                    <div>
                      <p className="text-[12.5px] font-medium text-foreground">{g.key}</p>
                      <p className="text-[11px] text-foreground-subtle">{g.rows.length} records</p>
                    </div>
                    <GitMerge className="h-3.5 w-3.5 text-foreground-muted" />
                  </button>
                  {expanded === g.key && (
                    <div className="border-t border-border divide-y divide-border">
                      {g.rows.map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[12.5px] text-foreground truncate">
                              {kind === "companies" ? r.name : r.full_name} ·{" "}
                              <span className="text-foreground-subtle">
                                {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </p>
                            <p className="text-[11px] text-foreground-subtle truncate">
                              {kind === "companies" ? (r.industry ?? "—") : (r.title ?? "—")}
                            </p>
                          </div>
                          <PrimaryBtn onClick={() => mergeGroup(g, r.id)} disabled={busy}>
                            Keep this
                          </PrimaryBtn>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end pt-2 border-t border-border">
          <GhostBtn onClick={onClose}>Close</GhostBtn>
        </div>
      </div>
    </Modal>
  );
}
