import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileText, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useQueryClient } from "@/lib/query";
import { GhostBtn, Modal, PrimaryBtn, Select } from "@/components/app/data-ui";
import {
  autoMap,
  coerceValue,
  downloadCSV,
  guessCompanyName,
  IMPORT_SPECS,
  normalizeDomain,
  normalizeEmail,
  normalizeString,
  parseCSV,
  toCSV,
  type EntityKey,
} from "@/lib/import/utils";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type CleanOptions = {
  normalize: boolean;
  detectDuplicates: boolean;
  autoLinkCompanies: boolean;
  inferCompanyName: boolean;
};

const DEFAULT_CLEAN: CleanOptions = {
  normalize: true,
  detectDuplicates: true,
  autoLinkCompanies: true,
  inferCompanyName: true,
};

type ErrorRow = { row: number; reason: string; raw: Record<string, string> };

export function ImportWizardModal({
  open,
  onClose,
  entity: initialEntity,
}: {
  open: boolean;
  onClose: () => void;
  entity: EntityKey;
}) {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [entity, setEntity] = useState<EntityKey>(initialEntity);
  const spec = IMPORT_SPECS[entity];

  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [clean, setClean] = useState<CleanOptions>(DEFAULT_CLEAN);
  const [progress, setProgress] = useState({ done: 0, total: 0, inserted: 0, failed: 0 });
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const dataRows = useMemo(() => (rows.length > 0 ? rows.slice(1) : []), [rows]);

  const missingCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of spec.fields) {
      const idx = mapping[f.key];
      if (idx == null) { m[f.key] = dataRows.length; continue; }
      m[f.key] = dataRows.reduce((acc, r) => acc + ((r[idx] ?? "").trim() === "" ? 1 : 0), 0);
    }
    return m;
  }, [dataRows, mapping, spec.fields]);

  const dupPreview = useMemo(() => {
    if (!clean.detectDuplicates) return 0;
    const idxDomain = mapping["domain"] ?? mapping["company_domain"] ?? null;
    const idxEmail = mapping["email"] ?? null;
    const seen = new Set<string>();
    let dups = 0;
    for (const r of dataRows) {
      const key = (idxEmail != null ? normalizeEmail(r[idxEmail]) : null)
        ?? (idxDomain != null ? normalizeDomain(r[idxDomain]) : null);
      if (!key) continue;
      if (seen.has(key)) dups++;
      else seen.add(key);
    }
    return dups;
  }, [dataRows, mapping, clean.detectDuplicates]);

  const canNext = useMemo(() => {
    if (step === 1) return rows.length > 0;
    if (step === 2) return dataRows.length > 0;
    if (step === 3) return spec.fields.filter((f) => f.required).every((f) => mapping[f.key] != null);
    return true;
  }, [step, rows.length, dataRows.length, mapping, spec.fields]);

  function reset() {
    setRows([]); setHeaders([]); setMapping({}); setErrors([]);
    setProgress({ done: 0, total: 0, inserted: 0, failed: 0 });
    setStep(1); setFinished(false); setRunning(false);
    cancelRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    if (running) return;
    reset();
    onClose();
  }

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) { toast.error("CSV needs a header row and at least one data row."); return; }
    setRows(parsed);
    setHeaders(parsed[0]);
    setMapping(autoMap(parsed[0], spec));
    setStep(2);
  }, [spec]);

  async function runImport() {
    if (!workspaceId) return;
    setRunning(true); setFinished(false);
    setErrors([]);
    setProgress({ done: 0, total: dataRows.length, inserted: 0, failed: 0 });

    // Pre-fetch company index if we need to auto-link.
    const needsCompanyLink = entity === "leads" || entity === "contacts";
    const companyByDomain = new Map<string, string>();
    const companyByName = new Map<string, string>();
    if (needsCompanyLink && clean.autoLinkCompanies) {
      const { data } = await supabase
        .from("companies")
        .select("id, name, domain")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);
      for (const c of (data ?? []) as { id: string; name: string; domain: string | null }[]) {
        if (c.domain) companyByDomain.set(c.domain.toLowerCase(), c.id);
        if (c.name) companyByName.set(c.name.toLowerCase(), c.id);
      }
    }

    // Existing duplicate index for the target table.
    const existingKeys = new Set<string>();
    if (clean.detectDuplicates) {
      if (entity === "companies") {
        const { data } = await supabase.from("companies").select("domain").eq("workspace_id", workspaceId).is("deleted_at", null);
        for (const r of (data ?? []) as { domain: string | null }[]) if (r.domain) existingKeys.add(r.domain.toLowerCase());
      } else if (entity === "contacts") {
        const { data } = await supabase.from("contacts").select("email").eq("workspace_id", workspaceId).is("deleted_at", null);
        for (const r of (data ?? []) as { email: string | null }[]) if (r.email) existingKeys.add(r.email.toLowerCase());
      }
    }

    const collected: { payload: Record<string, unknown>; raw: Record<string, string>; row: number }[] = [];
    const failedLocal: ErrorRow[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const raw: Record<string, string> = {};
      headers.forEach((h, j) => { raw[h] = r[j] ?? ""; });
      const payload: Record<string, unknown> = { workspace_id: workspaceId };

      for (const f of spec.fields) {
        const idx = mapping[f.key];
        if (idx == null) continue;
        const cell = r[idx];
        if (cell == null) continue;
        const value = clean.normalize ? coerceValue(f, cell) : (cell.trim() || null);
        if (value == null || value === "") continue;
        if (f.key === "company_name" || f.key === "company_domain") { payload[f.key] = value; continue; }
        payload[f.key] = value;
      }

      // AI: infer missing company name from domain (companies)
      if (entity === "companies" && clean.inferCompanyName && !payload.name) {
        const inferred = guessCompanyName(payload.domain as string | null | undefined);
        if (inferred) payload.name = inferred;
      }

      // Auto-link company for leads / contacts.
      if (needsCompanyLink) {
        const cDom = normalizeDomain(payload.company_domain as string | null | undefined);
        const cName = normalizeString(payload.company_name as string | null | undefined);
        let companyId: string | null = null;
        if (cDom && companyByDomain.has(cDom)) companyId = companyByDomain.get(cDom)!;
        else if (cName && companyByName.has(cName.toLowerCase())) companyId = companyByName.get(cName.toLowerCase())!;
        else if (clean.autoLinkCompanies && (cDom || cName)) {
          const { data: created, error } = await supabase
            .from("companies")
            .insert({ workspace_id: workspaceId, name: cName ?? cDom ?? "Unknown", domain: cDom })
            .select("id, name, domain")
            .single();
          if (!error && created) {
            companyId = created.id;
            if (created.domain) companyByDomain.set(created.domain.toLowerCase(), created.id);
            if (created.name) companyByName.set(created.name.toLowerCase(), created.id);
          }
        }
        if (companyId) payload.company_id = companyId;
        delete payload.company_domain;
        delete payload.company_name;
      }

      // Required field validation.
      const missing = spec.fields.filter((f) => f.required).find((f) => {
        if (f.key === "company_name" && entity === "leads") return !payload.company_id;
        return payload[f.key] == null || payload[f.key] === "";
      });
      if (missing) {
        failedLocal.push({ row: i + 2, reason: `Missing required field: ${missing.label}`, raw });
        continue;
      }

      // In-batch and existing duplicate detection.
      if (clean.detectDuplicates) {
        const dupKey = entity === "companies"
          ? (payload.domain as string | undefined)
          : entity === "contacts"
            ? (payload.email as string | undefined)
            : null;
        if (dupKey) {
          if (existingKeys.has(dupKey)) {
            failedLocal.push({ row: i + 2, reason: `Duplicate ${entity === "companies" ? "domain" : "email"}: ${dupKey}`, raw });
            continue;
          }
          existingKeys.add(dupKey);
        }
      }

      collected.push({ payload, raw, row: i + 2 });
    }

    // Insert in batches of 200 for progress feedback.
    let inserted = 0;
    const BATCH = 200;
    for (let i = 0; i < collected.length; i += BATCH) {
      if (cancelRef.current) break;
      const chunk = collected.slice(i, i + BATCH);
      const { error, data } = await supabase
        .from(spec.table as never)
        .insert(chunk.map((c) => c.payload) as never)
        .select("id");
      if (error) {
        for (const c of chunk) failedLocal.push({ row: c.row, reason: error.message, raw: c.raw });
      } else {
        inserted += data?.length ?? chunk.length;
      }
      setProgress({ done: Math.min(collected.length, i + chunk.length), total: dataRows.length, inserted, failed: failedLocal.length });
      // Yield to UI
      await new Promise((r) => setTimeout(r, 10));
    }

    // Audit log.
    if (inserted > 0 || failedLocal.length > 0) {
      await supabase.from("activity_logs").insert({
        workspace_id: workspaceId,
        entity_type: spec.table,
        entity_id: null,
        action: "csv.imported",
        metadata: {
          entity: spec.table,
          inserted,
          failed: failedLocal.length,
          total: dataRows.length,
          cleaned: clean.normalize,
          duplicates_blocked: failedLocal.filter((e) => /^duplicate/i.test(e.reason)).length,
        } as never,
      });
    }

    setProgress({ done: dataRows.length, total: dataRows.length, inserted, failed: failedLocal.length });
    setErrors(failedLocal);
    setRunning(false);
    setFinished(true);
    setStep(6);
    qc.invalidateQueries({ queryKey: [spec.queryKey] });
    qc.invalidateQueries({ queryKey: ["activity_logs"] });
    if (inserted > 0) toast.success(`Imported ${inserted} ${spec.label.toLowerCase()}`);
    if (inserted === 0 && failedLocal.length > 0) toast.error("No rows imported");
  }

  async function retryFailedRows() {
    if (errors.length === 0) return;
    // Retry only rows whose errors weren't semantic (skip missing required / dup).
    const retryable = errors.filter((e) => !/^Missing required|^Duplicate/i.test(e.reason));
    if (retryable.length === 0) { toast.info("No retryable rows — errors are validation issues, not transient."); return; }
    setRunning(true);
    let inserted = 0;
    const stillFailed: ErrorRow[] = errors.filter((e) => /^Missing required|^Duplicate/i.test(e.reason));
    for (const e of retryable) {
      // Rebuild minimal payload from raw + mapping.
      const payload: Record<string, unknown> = { workspace_id: workspaceId };
      for (const f of spec.fields) {
        const idx = mapping[f.key]; if (idx == null) continue;
        const cell = headers[idx] ? e.raw[headers[idx]] : "";
        if (!cell) continue;
        const v = clean.normalize ? coerceValue(f, cell) : cell.trim();
        if (v != null && v !== "") payload[f.key] = v;
      }
      const { error } = await supabase.from(spec.table as never).insert(payload as never);
      if (error) stillFailed.push({ ...e, reason: error.message });
      else inserted++;
    }
    setErrors(stillFailed);
    setProgress((p) => ({ ...p, inserted: p.inserted + inserted, failed: stillFailed.length }));
    setRunning(false);
    qc.invalidateQueries({ queryKey: [spec.queryKey] });
    toast.success(`Retried ${retryable.length} rows · ${inserted} recovered`);
  }

  function downloadErrorReport() {
    const csv = toCSV(
      errors.map((e) => ({ row: e.row, reason: e.reason, ...e.raw })),
      ["row", "reason", ...headers],
    );
    downloadCSV(`${spec.table}-import-errors.csv`, csv);
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Import ${spec.label}`}>
      <div className="space-y-4 min-w-[520px]">
        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-foreground-muted">Entity</label>
              <Select value={entity} onChange={(e) => { setEntity(e.target.value as EntityKey); setRows([]); setHeaders([]); setMapping({}); }}>
                <option value="companies">Companies</option>
                <option value="contacts">Contacts</option>
                <option value="leads">Leads</option>
              </Select>
            </div>
            <label className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-muted transition">
              <div className="h-10 w-10 rounded-lg bg-surface border border-border grid place-items-center">
                <Upload className="h-4 w-4 text-foreground-muted" />
              </div>
              <p className="text-[13px] font-medium text-foreground">Drop a CSV or click to browse</p>
              <p className="text-[11.5px] text-foreground-subtle">First row must be column headers</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
              <FileText className="h-4 w-4 text-foreground-muted" />
              <p className="text-[12.5px] font-medium text-foreground flex-1">
                {headers.length} columns · {dataRows.length} rows detected
              </p>
              <button onClick={reset} className="h-7 w-7 grid place-items-center rounded-md border border-border text-foreground-muted hover:text-foreground" aria-label="Clear">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-[11.5px]">
                  <thead className="bg-surface-muted/60 sticky top-0">
                    <tr>{headers.map((h, i) => <th key={i} className="px-2.5 py-2 text-left font-medium text-foreground-muted whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dataRows.slice(0, 8).map((r, i) => (
                      <tr key={i}>{headers.map((_, j) => <td key={j} className="px-2.5 py-1.5 text-foreground truncate max-w-[160px]">{r[j] ?? ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11px] text-foreground-subtle">Showing first 8 of {dataRows.length} rows.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">Field mapping</p>
            {spec.fields.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <label className="text-[12.5px] text-foreground w-48 shrink-0">
                  {f.label}
                  {f.required && <span className="text-foreground-subtle"> *</span>}
                </label>
                <Select
                  value={mapping[f.key] == null ? "" : String(mapping[f.key])}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                >
                  <option value="">— Skip —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </Select>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-foreground-subtle flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> AI Assistance
              </p>
              <Toggle label="Clean & normalize (domains, phones, emails, casing)" checked={clean.normalize} onChange={(v) => setClean((c) => ({ ...c, normalize: v }))} />
              <Toggle label="Detect duplicates and skip them" checked={clean.detectDuplicates} onChange={(v) => setClean((c) => ({ ...c, detectDuplicates: v }))} />
              {(entity === "leads" || entity === "contacts") && (
                <Toggle label="Auto-link contacts/leads to companies (create if missing)" checked={clean.autoLinkCompanies} onChange={(v) => setClean((c) => ({ ...c, autoLinkCompanies: v }))} />
              )}
              {entity === "companies" && (
                <Toggle label="Infer missing company names from domains" checked={clean.inferCompanyName} onChange={(v) => setClean((c) => ({ ...c, inferCompanyName: v }))} />
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-foreground-subtle mb-2">Validation preview</p>
              <ul className="text-[12px] text-foreground-muted space-y-1">
                {spec.fields.filter((f) => f.required).map((f) => {
                  const missing = missingCounts[f.key] ?? 0;
                  const bad = missing > 0;
                  return (
                    <li key={f.key} className="flex items-center gap-2">
                      {bad ? <AlertCircle className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      <span className="text-foreground">{f.label}</span>
                      <span>· {bad ? `${missing} rows missing this field` : "all rows have a value"}</span>
                    </li>
                  );
                })}
                {clean.detectDuplicates && (
                  <li className="flex items-center gap-2 text-foreground-muted">
                    <Sparkles className="h-3 w-3" /> {dupPreview} in-file duplicates will be skipped
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-foreground-muted">
              Importing {dataRows.length} rows into {spec.label.toLowerCase()}.
            </p>
            <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full bg-foreground transition-[width] duration-200"
                style={{ width: `${progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11.5px] text-foreground-muted tabular-nums">
              <span>{progress.done} / {progress.total} rows</span>
              <span>{progress.inserted} inserted · {progress.failed} failed</span>
            </div>
          </div>
        )}

        {step === 6 && finished && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-4 flex items-start gap-3">
              {progress.inserted > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" /> : <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
              <div className="flex-1">
                <p className="text-[13px] font-medium text-foreground">
                  Imported <span className="tabular-nums">{progress.inserted}</span> · Failed <span className="tabular-nums">{progress.failed}</span>
                </p>
                <p className="text-[11.5px] text-foreground-subtle mt-0.5">Out of {progress.total} rows.</p>
              </div>
              {errors.length > 0 && (
                <GhostBtn onClick={downloadErrorReport}>
                  <Download className="h-3 w-3" /> Errors CSV
                </GhostBtn>
              )}
            </div>
            {errors.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-[11.5px]">
                  <thead className="bg-surface-muted/60 sticky top-0">
                    <tr><th className="px-2.5 py-2 text-left font-medium">Row</th><th className="px-2.5 py-2 text-left font-medium">Reason</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {errors.slice(0, 100).map((e, i) => (
                      <tr key={i}><td className="px-2.5 py-1.5 tabular-nums">{e.row}</td><td className="px-2.5 py-1.5 text-foreground-muted">{e.reason}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            {step > 1 && step < 5 && (
              <GhostBtn onClick={() => setStep((s) => (s - 1) as Step)}>
                <ArrowLeft className="h-3 w-3" /> Back
              </GhostBtn>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!finished && <GhostBtn onClick={handleClose} disabled={running}>Cancel</GhostBtn>}
            {step === 4 && (
              <PrimaryBtn onClick={() => { setStep(5); void runImport(); }} disabled={!canNext}>
                Start import <ArrowRight className="h-3 w-3" />
              </PrimaryBtn>
            )}
            {step < 4 && (
              <PrimaryBtn onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canNext}>
                Next <ArrowRight className="h-3 w-3" />
              </PrimaryBtn>
            )}
            {step === 6 && finished && (
              <>
                {errors.some((e) => !/^Missing required|^Duplicate/i.test(e.reason)) && (
                  <GhostBtn onClick={retryFailedRows} disabled={running}>Retry failed</GhostBtn>
                )}
                <PrimaryBtn onClick={handleClose}>Close</PrimaryBtn>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = ["Upload", "Preview", "Map", "Validate", "Import", "Report"];
  return (
    <ol className="flex items-center gap-1.5 text-[10.5px] text-foreground-subtle">
      {items.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span className={`h-4 w-4 grid place-items-center rounded-full text-[9px] font-medium ${active ? "bg-foreground text-background" : done ? "bg-surface-muted text-foreground border border-border" : "bg-surface border border-border"}`}>
              {n}
            </span>
            <span className={active ? "text-foreground font-medium" : done ? "text-foreground-muted" : ""}>{label}</span>
            {i < items.length - 1 && <span className="text-border">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-border" />
      <span className="text-[12.5px] text-foreground">{label}</span>
    </label>
  );
}
