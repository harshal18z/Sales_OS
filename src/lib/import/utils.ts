// Shared helpers for the Import & Data Management module.
// Client-safe: pure functions only. No Supabase / no server-only APIs.

export type EntityKey = "companies" | "contacts" | "leads";

export type FieldSpec = {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  type?: "string" | "number" | "domain" | "email" | "phone";
};

export type EntitySpec = {
  label: string;
  table: EntityKey;
  queryKey: string;
  fields: FieldSpec[];
};

export const IMPORT_SPECS: Record<EntityKey, EntitySpec> = {
  companies: {
    label: "Companies",
    table: "companies",
    queryKey: "companies",
    fields: [
      { key: "name", label: "Name", required: true, aliases: ["name", "company", "company name", "account", "account name", "organization"] },
      { key: "domain", label: "Domain / Website", type: "domain", aliases: ["domain", "website", "url", "web", "site"] },
      { key: "industry", label: "Industry", aliases: ["industry", "sector", "vertical"] },
      { key: "size", label: "Size", aliases: ["size", "employees", "headcount", "company size"] },
      { key: "revenue", label: "Revenue", aliases: ["revenue", "annual revenue", "arr"] },
      { key: "location", label: "Location", aliases: ["location", "city", "country", "region", "hq"] },
      { key: "description", label: "Description", aliases: ["description", "about", "notes", "summary"] },
    ],
  },
  contacts: {
    label: "Contacts",
    table: "contacts",
    queryKey: "contacts",
    fields: [
      { key: "full_name", label: "Full name", required: true, aliases: ["full name", "name", "contact", "contact name", "person"] },
      { key: "email", label: "Email", type: "email", aliases: ["email", "email address", "e-mail", "mail"] },
      { key: "phone", label: "Phone", type: "phone", aliases: ["phone", "mobile", "phone number", "tel", "telephone"] },
      { key: "title", label: "Title", aliases: ["title", "job title", "role", "position"] },
      { key: "linkedin_url", label: "LinkedIn URL", aliases: ["linkedin", "linkedin url", "linkedin profile"] },
      { key: "company_domain", label: "Company domain (auto-link)", type: "domain", aliases: ["company domain", "company website", "company url", "account domain"] },
      { key: "company_name", label: "Company name (auto-link)", aliases: ["company", "company name", "account", "organization"] },
    ],
  },
  leads: {
    label: "Leads",
    table: "leads",
    queryKey: "leads",
    fields: [
      { key: "company_name", label: "Company (auto-link)", required: true, aliases: ["company", "company name", "account"] },
      { key: "company_domain", label: "Company domain (auto-link)", type: "domain", aliases: ["domain", "website", "company website", "company domain"] },
      { key: "source", label: "Source", aliases: ["source", "lead source"] },
      { key: "stage", label: "Stage", aliases: ["stage", "status"] },
      { key: "score", label: "Score", type: "number", aliases: ["score", "lead score"] },
      { key: "intent_score", label: "Intent score", type: "number", aliases: ["intent", "intent score"] },
      { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
    ],
  },
};

// ---------- CSV parse / stringify ----------
export function parseCSV(text: string): string[][] {
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
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return columns ? columns.join(",") + "\n" : "";
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Normalizers (AI-assisted heuristics) ----------
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let v = String(input).trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  v = v.split("/")[0].split("?")[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return null;
  return v;
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.length < 7) return raw;
  // Preserve leading +; otherwise assume international-friendly compaction.
  if (digits.startsWith("+")) return digits;
  return digits;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

export function normalizeString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function normalizeNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Extract a company name candidate from a full name string, domain, or free text.
export function guessCompanyName(input: string | null | undefined): string | null {
  const d = normalizeDomain(input);
  if (d) {
    const label = d.split(".")[0];
    if (label.length > 1) return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return normalizeString(input);
}

// ---------- Mapping ----------
export function autoMap(headers: string[], spec: EntitySpec): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const f of spec.fields) {
    const idx = norm.findIndex((h) => f.aliases.includes(h));
    map[f.key] = idx >= 0 ? idx : null;
  }
  return map;
}

export function coerceValue(field: FieldSpec, raw: string): unknown {
  const v = raw?.trim();
  if (!v) return null;
  switch (field.type) {
    case "number": return normalizeNumber(v);
    case "domain": return normalizeDomain(v);
    case "email": return normalizeEmail(v);
    case "phone": return normalizePhone(v);
    default: return v;
  }
}

// ---------- Duplicate detection ----------
export type DuplicateGroup<T> = { key: string; rows: T[] };

export function groupDuplicates<T extends Record<string, unknown>>(
  rows: T[],
  keyFn: (r: T) => string | null,
): DuplicateGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    const b = buckets.get(k) ?? [];
    b.push(r);
    buckets.set(k, b);
  }
  return Array.from(buckets.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, rows: list }));
}
