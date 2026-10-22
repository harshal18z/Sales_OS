import { useMemo, useRef, useState } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useQueryClient } from "@/lib/query";
import { GhostBtn, Modal, PrimaryBtn, Select } from "@/components/app/data-ui";

type EntityKey = "companies" | "contacts" | "leads" | "crm_deals";

interface EntitySpec {
  label: string;
  table: EntityKey;
  queryKey: string;
  /** target column -> array of candidate header names (case-insensitive) */
  fields: {
    key: string;
    label: string;
    required?: boolean;
    aliases: string[];
  }[];
}

const SPECS: Record<EntityKey, EntitySpec> = {
  companies: {
    label: "Companies",
    table: "companies",
    queryKey: "companies",
    fields: [
      {
        key: "name",
        label: "Name",
        required: true,
        aliases: ["name", "company", "company name", "account"],
      },
      { key: "domain", label: "Domain", aliases: ["domain", "website", "url"] },
      { key: "industry", label: "Industry", aliases: ["industry", "sector"] },
      { key: "size", label: "Size", aliases: ["size", "employees", "headcount"] },
      { key: "revenue", label: "Revenue", aliases: ["revenue", "arr"] },
      { key: "location", label: "Location", aliases: ["location", "city", "country", "region"] },
      { key: "description", label: "Description", aliases: ["description", "about", "notes"] },
    ],
  },
  contacts: {
    label: "Contacts",
    table: "contacts",
    queryKey: "contacts",
    fields: [
      {
        key: "full_name",
        label: "Full name",
        required: true,
        aliases: ["full name", "name", "contact", "contact name"],
      },
      { key: "email", label: "Email", aliases: ["email", "email address"] },
      { key: "phone", label: "Phone", aliases: ["phone", "mobile", "phone number"] },
      { key: "title", label: "Title", aliases: ["title", "job title", "role", "position"] },
      { key: "linkedin_url", label: "LinkedIn URL", aliases: ["linkedin", "linkedin url"] },
    ],
  },
  leads: {
    label: "Leads",
    table: "leads",
    queryKey: "leads",
    fields: [
      { key: "source", label: "Source", aliases: ["source", "lead source"] },
      { key: "stage", label: "Stage", aliases: ["stage", "status"] },
      { key: "score", label: "Score", aliases: ["score", "lead score"] },
      { key: "intent_score", label: "Intent score", aliases: ["intent", "intent score"] },
      { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
    ],
  },
  crm_deals: {
    label: "Deals",
    table: "crm_deals",
    queryKey: "crm_deals",
    fields: [
      {
        key: "name",
        label: "Name",
        required: true,
        aliases: ["name", "deal", "deal name", "opportunity"],
      },
      { key: "stage", label: "Stage", aliases: ["stage", "status"] },
      { key: "value", label: "Value", aliases: ["value", "amount", "deal value"] },
      { key: "currency", label: "Currency", aliases: ["currency"] },
      { key: "probability", label: "Probability", aliases: ["probability", "confidence"] },
      {
        key: "expected_close_date",
        label: "Close date",
        aliases: ["close date", "expected close date", "expected close"],
      },
      { key: "notes", label: "Notes", aliases: ["notes", "description"] },
    ],
  },
};

// Minimal CSV parser (handles quoted values with embedded commas + doubled quotes).
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function autoMap(headers: string[], spec: EntitySpec): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const f of spec.fields) {
    const idx = norm.findIndex((h) => f.aliases.includes(h));
    map[f.key] = idx >= 0 ? idx : null;
  }
  return map;
}

function coerce(field: string, value: string): unknown {
  const v = value.trim();
  if (v === "") return null;
  if (["score", "intent_score", "probability", "value"].includes(field)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return v;
}

export function CSVImportModal({
  open,
  onClose,
  entity,
}: {
  open: boolean;
  onClose: () => void;
  entity: EntityKey;
}) {
  const spec = SPECS[entity];
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const dataRows = useMemo(() => (rows.length > 0 ? rows.slice(1) : []), [rows]);

  function reset() {
    setRows([]);
    setHeaders([]);
    setMapping({});
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast.error("CSV must have a header row and at least one data row.");
      return;
    }
    setRows(parsed);
    setHeaders(parsed[0]);
    setMapping(autoMap(parsed[0], spec));
    setResult(null);
  }

  async function runImport() {
    if (!workspaceId) return;
    const required = spec.fields.filter((f) => f.required);
    for (const f of required) {
      if (mapping[f.key] == null) {
        toast.error(`Map a column for "${f.label}".`);
        return;
      }
    }
    setImporting(true);
    let inserted = 0;
    let failed = 0;
    const batch: Record<string, unknown>[] = [];
    for (const r of dataRows) {
      const row: Record<string, unknown> = { workspace_id: workspaceId };
      for (const f of spec.fields) {
        const idx = mapping[f.key];
        if (idx == null) continue;
        const v = r[idx];
        if (v == null) continue;
        const coerced = coerce(f.key, v);
        if (coerced != null) row[f.key] = coerced;
      }
      const hasRequired = required.every((f) => row[f.key] != null && row[f.key] !== "");
      if (!hasRequired) {
        failed++;
        continue;
      }
      batch.push(row);
    }
    // Insert in chunks of 500
    for (let i = 0; i < batch.length; i += 500) {
      const chunk = batch.slice(i, i + 500);
      const { error } = await supabase.from(spec.table).insert(chunk as never);
      if (error) {
        failed += chunk.length;
      } else {
        inserted += chunk.length;
      }
    }
    if (inserted > 0) {
      await supabase.from("activity_logs").insert({
        workspace_id: workspaceId,
        entity_type: spec.table,
        entity_id: null,
        action: "csv.imported",
        metadata: { count: inserted } as never,
      });
    }
    setResult({ inserted, failed });
    setImporting(false);
    qc.invalidateQueries({ queryKey: [spec.queryKey] });
    if (inserted > 0) toast.success(`Imported ${inserted} ${spec.label.toLowerCase()}`);
    if (inserted === 0 && failed > 0) toast.error("No rows imported");
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Import ${spec.label} from CSV`}>
      <div className="space-y-4">
        {rows.length === 0 ? (
          <label className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-muted transition">
            <div className="h-10 w-10 rounded-lg bg-surface border border-border grid place-items-center">
              <Upload className="h-4 w-4 text-foreground-muted" />
            </div>
            <p className="text-[13px] font-medium text-foreground">
              Drop a CSV file or click to browse
            </p>
            <p className="text-[11.5px] text-foreground-subtle">First row must be column headers</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
              <FileText className="h-4 w-4 text-foreground-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-foreground">
                  {headers.length} columns · {dataRows.length} rows
                </p>
              </div>
              <button
                onClick={reset}
                className="h-7 w-7 grid place-items-center rounded-md border border-border text-foreground-muted hover:text-foreground"
                aria-label="Clear file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">
                Field mapping
              </p>
              {spec.fields.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <label className="text-[12.5px] text-foreground w-40 shrink-0">
                    {f.label}
                    {f.required && <span className="text-foreground-subtle"> *</span>}
                  </label>
                  <Select
                    value={mapping[f.key] == null ? "" : String(mapping[f.key])}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [f.key]: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">— Skip —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            {result && (
              <div className="rounded-lg border border-border bg-surface-muted/40 p-3 flex items-start gap-2">
                {result.inserted > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-foreground-muted mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-foreground-muted mt-0.5" />
                )}
                <div className="text-[12.5px] text-foreground-muted">
                  Imported <span className="font-medium text-foreground">{result.inserted}</span>{" "}
                  rows
                  {result.failed > 0 && (
                    <>
                      {" "}
                      · Skipped <span className="font-medium text-foreground">{result.failed}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <GhostBtn onClick={handleClose}>{result ? "Close" : "Cancel"}</GhostBtn>
              {!result && (
                <PrimaryBtn onClick={runImport} disabled={importing || dataRows.length === 0}>
                  {importing ? "Importing…" : `Import ${dataRows.length} rows`}
                </PrimaryBtn>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export type { EntityKey };
