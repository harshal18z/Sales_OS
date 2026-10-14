import { aiJSON } from "./provider.server";
import { normalizeCompanyUrl, scrapeUrl, webSearch } from "./research-providers.server";

type Tick = (progress: number, stage?: string) => Promise<void>;

type DiscoverySupabase = {
  from: (table: string) => any;
};

type CompanyRow = {
  id: string;
  workspace_id: string;
  name?: string | null;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  headquarters?: string | null;
  latest_research_report_id?: string | null;
};

type ReportRow = {
  id?: string | null;
  summary?: string | null;
  report?: Record<string, unknown> | null;
  url?: string | null;
};

type EvidencePage = {
  url: string;
  label: string;
  text: string;
  emails: string[];
  phones: string[];
  linkedinUrls: string[];
  avatarUrls?: string[];
};

type EmailQuality = "verified" | "likely_valid" | "unknown";
type PhoneQuality = "verified" | "business_number" | "unavailable";
type ConfidenceLabel = "high" | "medium" | "low";
type DataSourceType =
  | "Verified Company Contact"
  | "Public Business Directory"
  | "Website Team Page"
  | "Website Contact Page"
  | "Website About Page"
  | "Website Footer"
  | "Structured Data"
  | "Professional Network"
  | "Business Contact";

type DiscoveredContact = {
  full_name: string;
  title?: string | null;
  department?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  confidence?: number | null;
  source_url: string;
  source_label?: string | null;
  data_source_type?: DataSourceType | null;
  evidence?: string | null;
  contact_type: "decision_maker" | "business_contact";
};

type DiscoveryResult = {
  company_id: string;
  report_id: string | null;
  total: number;
  decision_makers: number;
  business_contacts: number;
  created: number;
  updated: number;
  skipped: number;
  pages_checked: string[];
  logs: string[];
  errors: string[];
  message: string;
};

const MAX_PAGE_TEXT = 18000;

const PRIORITY_ROLES = [
  "Founder",
  "Co-Founder",
  "CEO",
  "CTO",
  "CIO",
  "VP Engineering",
  "Engineering Manager",
  "Head of Product",
  "Product Manager",
  "Marketing Director",
  "Head of Marketing",
  "Sales Director",
  "VP Sales",
  "Business Development",
  "HR Manager",
  "Talent Acquisition",
  "Operations Manager",
];

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function clampScore(value: unknown, fallback: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function containsText(haystack: string, needle: string | null | undefined) {
  const n = needle?.trim();
  if (!n) return false;
  return haystack.toLowerCase().includes(n.toLowerCase());
}

function extractEmails(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return unique(matches.map((m) => m.toLowerCase()).filter((m) => !m.endsWith(".png") && !m.endsWith(".jpg")));
}

function extractPhones(text: string) {
  const matches = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? [];
  return unique(
    matches
      .map((m) => m.replace(/\s+/g, " ").trim())
      .filter((m) => m.replace(/\D/g, "").length >= 8 && m.replace(/\D/g, "").length <= 15),
  ).slice(0, 8);
}

function extractLinkedInUrls(text: string) {
  const matches = text.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s)"'<>]+/gi) ?? [];
  return unique(matches.map((m) => m.replace(/[.,;]+$/, ""))).slice(0, 20);
}

function extractImageUrls(html: string, baseUrl: string) {
  const urls = new Set<string>();
  const imgs = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi));
  for (const m of imgs) {
    const raw = m[1];
    try {
      urls.add(new URL(raw, baseUrl).toString());
    } catch { /* ignore */ }
  }
  return Array.from(urls);
}

function extractUrls(text: string, baseUrl: string) {
  const found = new Set<string>();
  const absolute = text.match(/https?:\/\/[^\s)"'<>]+/gi) ?? [];
  for (const raw of absolute) found.add(raw.replace(/[.,;]+$/, ""));
  const markdownLinks = Array.from(text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g));
  for (const match of markdownLinks) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      found.add(new URL(raw, baseUrl).toString());
    } catch { /* ignore */ }
  }
  const hrefs = Array.from(text.matchAll(/href=["']([^"']+)["']/gi));
  for (const match of hrefs) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      found.add(new URL(raw, baseUrl).toString());
    } catch { /* ignore */ }
  }
  return Array.from(found);
}

function pageLabel(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes("contact")) return "Website Contact Page";
    if (path.includes("team") || path.includes("people") || path.includes("leadership")) return "Website Team Page";
    if (path.includes("about")) return "Website About Page";
    return path === "/" || path === "" ? "Website Footer" : "Website Page";
  } catch {
    return "Website Page";
  }
}

function labelToSourceType(label: string | null | undefined): DataSourceType {
  const l = (label ?? "").toLowerCase();
  if (l.includes("linkedin") || l.includes("professional")) return "Professional Network";
  if (l.includes("directory")) return "Public Business Directory";
  if (l.includes("structured")) return "Structured Data";
  if (l.includes("team")) return "Website Team Page";
  if (l.includes("contact")) return "Website Contact Page";
  if (l.includes("about")) return "Website About Page";
  if (l.includes("footer")) return "Website Footer";
  return "Verified Company Contact";
}

function isRelevantContactUrl(url: string, home: URL) {
  try {
    const u = new URL(url);
    const hostMatches = u.hostname.replace(/^www\./, "") === home.hostname.replace(/^www\./, "");
    if (!hostMatches) return false;
    const path = `${u.pathname} ${u.hash}`.toLowerCase();
    return /contact|about|team|people|leadership|management|founder|company|connect|support/.test(path);
  } catch {
    return false;
  }
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 SalesOS Lead Discovery",
      },
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 120000);
  } catch {
    return "";
  }
}

function htmlToText(html: string) {
  const jsonLd = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((m) => m[1])
    .join("\n");
  const footer = Array.from(html.matchAll(/<footer[\s\S]*?<\/footer>/gi)).join("\n");
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return [jsonLd, footer.replace(/<[^>]+>/g, " "), stripped].filter(Boolean).join("\n").slice(0, MAX_PAGE_TEXT);
}

function extractJsonLdContacts(html: string, sourceUrl: string): DiscoveredContact[] {
  const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const contacts: DiscoveredContact[] = [];

  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const obj = node as Record<string, unknown>;
    const type = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
    const types = type.map((t) => String(t).toLowerCase());
    if (types.includes("person")) {
      const name = safeText(obj.name);
      if (name) {
        const sameAs = Array.isArray(obj.sameAs) ? obj.sameAs.map(safeText) : [safeText(obj.sameAs)];
        const linkedin = sameAs.find((s) => s.includes("linkedin.com")) ?? null;
        const image = safeText(obj.image) || null;
        contacts.push({
          full_name: name,
          title: safeText(obj.jobTitle) || null,
          department: null,
          email: safeText(obj.email) || null,
          phone: safeText(obj.telephone) || null,
          linkedin_url: linkedin,
          avatar_url: image,
          confidence: 90,
          source_url: sourceUrl,
          source_label: "Structured Data",
          data_source_type: "Structured Data",
          evidence: "Person structured data on company website",
          contact_type: "decision_maker",
        });
      }
    }
    for (const value of Object.values(obj)) visit(value);
  }

  for (const block of blocks) {
    try { visit(JSON.parse(block[1] ?? "{}")); } catch { /* ignore */ }
  }
  return contacts;
}

// -------- Department + quality inference --------

function inferDepartment(title: string | null | undefined): string | null {
  const t = (title ?? "").toLowerCase();
  if (!t) return null;
  if (/founder|owner|ceo|coo|president|chief executive|managing director/.test(t)) return "Executive";
  if (/cto|cio|engineer|developer|devops|architect|technical/.test(t)) return "Engineering";
  if (/product|pm\b|program manager/.test(t)) return "Product";
  if (/design|ux|ui/.test(t)) return "Design";
  if (/marketing|brand|content|seo|growth|demand/.test(t)) return "Marketing";
  if (/sales|revenue|account executive|ae\b|bdr|sdr|business development|partnerships/.test(t)) return "Sales";
  if (/customer success|support|onboarding/.test(t)) return "Customer Success";
  if (/finance|cfo|controller|accounting/.test(t)) return "Finance";
  if (/people|hr\b|human resources|talent|recruit/.test(t)) return "People";
  if (/operations|ops\b|coo/.test(t)) return "Operations";
  if (/legal|counsel|compliance/.test(t)) return "Legal";
  if (/data|analytics|research|scientist/.test(t)) return "Data";
  return null;
}

function isGenericEmail(email: string) {
  return /^(info|hello|contact|sales|support|admin|office|team|enquiries|inquiries|business|careers|press|hr|jobs)@/i.test(email);
}

function classifyEmail(email: string | null | undefined, verifiedInPage: boolean, companyDomain: string | null): EmailQuality {
  if (!email) return "unknown";
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1] ?? "";
  const matchesCompany = companyDomain ? domain.endsWith(companyDomain.toLowerCase()) : false;
  if (verifiedInPage && matchesCompany) return "verified";
  if (matchesCompany) return "likely_valid";
  if (verifiedInPage) return "likely_valid";
  return "unknown";
}

function classifyPhone(phone: string | null | undefined, verifiedInPage: boolean): PhoneQuality {
  if (!phone) return "unavailable";
  return verifiedInPage ? "verified" : "business_number";
}

function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function isDecisionMakerTitle(title: string | null | undefined) {
  return /founder|owner|chief|ceo|cto|cio|cfo|coo|cmo|cro|vp|vice president|director|head|principal|partner|manager|revenue|sales|marketing|growth|business development|talent|recruit|operations|engineering|product/i.test(title ?? "");
}

// -------- Evidence gathering --------

async function buildEvidencePages(company: CompanyRow, report?: ReportRow | null, addLog?: (message: string) => Promise<void>) {
  const website = normalizeOptionalUrl(company.website) ?? normalizeOptionalUrl(company.domain) ?? normalizeOptionalUrl(report?.url);
  if (!website) return [];
  const { url: normalizedUrl, domain } = normalizeCompanyUrl(website);
  const home = new URL(normalizedUrl);
  const candidates = new Set<string>([
    normalizedUrl,
    new URL("/contact", home).toString(),
    new URL("/contact-us", home).toString(),
    new URL("/about", home).toString(),
    new URL("/about-us", home).toString(),
    new URL("/team", home).toString(),
    new URL("/our-team", home).toString(),
    new URL("/leadership", home).toString(),
    new URL("/company", home).toString(),
    new URL("/people", home).toString(),
  ]);

  const homepage = await scrapeUrl(normalizedUrl);
  if (homepage?.markdown) {
    for (const url of extractUrls(homepage.markdown, normalizedUrl)) {
      if (isRelevantContactUrl(url, home)) candidates.add(url.split("#")[0]);
    }
  }

  const searchHits = await webSearch(`site:${domain} contact OR team OR about OR leadership`, 6);
  for (const hit of searchHits) {
    if (isRelevantContactUrl(hit.url, home)) candidates.add(hit.url.split("#")[0]);
  }

  const pages: EvidencePage[] = [];
  for (const url of Array.from(candidates).slice(0, 12)) {
    await addLog?.(`Checking ${pageLabel(url)}: ${url}`);
    const [scraped, html] = await Promise.all([scrapeUrl(url), fetchHtml(url)]);
    const text = [scraped?.markdown ?? "", htmlToText(html)].filter(Boolean).join("\n").slice(0, MAX_PAGE_TEXT);
    const emails = extractEmails(text);
    const phones = extractPhones(text);
    const linkedinUrls = extractLinkedInUrls(text);
    const avatarUrls = extractImageUrls(html, url);
    const structuredContacts = extractJsonLdContacts(html, url);
    if (text.length >= 40 || emails.length || phones.length || structuredContacts.length) {
      pages.push({ url, label: pageLabel(url), text, emails, phones, linkedinUrls, avatarUrls });
    }
    for (const contact of structuredContacts) {
      pages.push({
        url: `${url}#structured-${contact.full_name}`,
        label: "Structured Data",
        text: `${contact.full_name} ${contact.title ?? ""} ${contact.email ?? ""} ${contact.phone ?? ""} ${contact.linkedin_url ?? ""}`,
        emails: contact.email ? [contact.email] : [],
        phones: contact.phone ? [contact.phone] : [],
        linkedinUrls: contact.linkedin_url ? [contact.linkedin_url] : [],
        avatarUrls: contact.avatar_url ? [contact.avatar_url] : [],
      });
    }
  }
  return pages;
}

// -------- LinkedIn / professional network discovery --------

async function searchProfessionalNetwork(
  company: CompanyRow,
  addLog?: (message: string) => Promise<void>,
): Promise<{ contacts: DiscoveredContact[]; pages: EvidencePage[] }> {
  const contacts: DiscoveredContact[] = [];
  const pages: EvidencePage[] = [];
  const companyName = company.name?.trim();
  if (!companyName) return { contacts, pages };

  const seen = new Set<string>();
  // Query in small batches to avoid rate limiting; prioritize highest-signal roles first.
  const roleBatches = [
    ["Founder", "CEO", "CTO"],
    ["VP Engineering", "Head of Product", "Head of Marketing"],
    ["VP Sales", "Sales Director", "Business Development"],
    ["Operations Manager", "HR Manager", "Talent Acquisition"],
  ];

  for (const batch of roleBatches) {
    const query = `site:linkedin.com/in ${batch.map((r) => `"${r}"`).join(" OR ")} "${companyName}"`;
    await addLog?.(`Searching public professional network for ${batch.join(", ")}…`);
    const hits = await webSearch(query, 8).catch(() => []);
    for (const hit of hits) {
      if (!/linkedin\.com\/in\//i.test(hit.url)) continue;
      const url = hit.url.split("?")[0].replace(/\/$/, "");
      if (seen.has(url)) continue;
      seen.add(url);
      const snippet = `${hit.title ?? ""} ${hit.snippet ?? ""}`.trim();
      // Snippet MUST mention the company name to avoid mismatched profiles.
      if (!containsText(snippet, companyName)) continue;
      const parsed = parseLinkedInSnippet(hit.title ?? "", hit.snippet ?? "", batch);
      if (!parsed) continue;
      const evidencePage: EvidencePage = {
        url,
        label: "Professional Network",
        text: `${parsed.full_name} ${parsed.title ?? ""} ${companyName} ${snippet}`,
        emails: [],
        phones: [],
        linkedinUrls: [url],
      };
      pages.push(evidencePage);
      contacts.push({
        full_name: parsed.full_name,
        title: parsed.title ?? null,
        department: inferDepartment(parsed.title),
        linkedin_url: url,
        email: null,
        phone: null,
        location: parsed.location ?? null,
        confidence: 82,
        source_url: url,
        source_label: "Professional Network",
        data_source_type: "Professional Network",
        evidence: snippet.slice(0, 400),
        contact_type: "decision_maker",
      });
    }
  }
  return { contacts, pages };
}

function parseLinkedInSnippet(title: string, snippet: string, roles: string[]) {
  // LinkedIn title format: "Full Name - Job Title - Company | LinkedIn"
  const cleaned = title.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
  const parts = cleaned.split(/\s+[-–—·|]\s+/).map((s) => s.trim()).filter(Boolean);
  const full_name = parts[0];
  if (!full_name || full_name.length < 2 || full_name.split(/\s+/).length < 2) return null;
  // Reject obviously non-personal names (all-caps abbrev, contains digits, marketing phrases).
  if (/\d/.test(full_name) || /^[A-Z]{2,}$/.test(full_name.replace(/\s/g, ""))) return null;
  let jobTitle: string | null = parts[1] ?? null;
  if (!jobTitle) {
    const roleMatch = roles.find((r) => new RegExp(`\\b${r}\\b`, "i").test(snippet));
    jobTitle = roleMatch ?? null;
  }

  let location: string | null = null;
  const locMatch = snippet.match(/Location:\s*([A-Za-z ,]+)/);
  if (locMatch) location = locMatch[1].trim();
  return { full_name, title: jobTitle, location };
}

function fallbackBusinessContacts(pages: EvidencePage[]): DiscoveredContact[] {
  const contacts: DiscoveredContact[] = [];
  for (const page of pages) {
    const email = page.emails.find(isGenericEmail) ?? page.emails[0] ?? null;
    const phone = page.phones[0] ?? null;
    if (!email && !phone) continue;
    contacts.push({
      full_name: "Business Contact",
      title: "Website Business Contact",
      department: null,
      email,
      phone,
      linkedin_url: null,
      confidence: email && phone ? 85 : 70,
      source_url: page.url,
      source_label: page.label,
      data_source_type: "Business Contact",
      evidence: [email, phone].filter(Boolean).join(" · "),
      contact_type: "business_contact",
    });
    break;
  }
  return contacts;
}

async function extractContactsWithAI(company: CompanyRow, report: ReportRow | null | undefined, pages: EvidencePage[], limit: number) {
  const websitePages = pages.filter((p) => p.label !== "Professional Network");
  const evidence = websitePages
    .map((p, i) => `SOURCE ${i + 1}: ${p.label}\nURL: ${p.url}\nEmails: ${p.emails.join(", ") || "none"}\nPhones: ${p.phones.join(", ") || "none"}\nLinkedIn URLs: ${p.linkedinUrls.join(", ") || "none"}\nTEXT:\n${p.text.slice(0, 7000)}`)
    .join("\n\n---\n\n");
  if (!evidence.trim()) return { decision_makers: [], generic_business_contacts: [] };

  type Out = {
    decision_makers?: Omit<DiscoveredContact, "contact_type">[];
    generic_business_contacts?: Omit<DiscoveredContact, "contact_type">[];
  };

  const out = await aiJSON<Out>({
    system: [
      "You are a strict website contact extraction agent for a B2B sales CRM.",
      "Never fabricate people, titles, emails, phone numbers, LinkedIn URLs, or sources.",
      "Only extract contacts explicitly present in the supplied website evidence.",
      "Named people must have their full name visible in evidence. Generic business contacts must have a real website email and/or phone visible in evidence.",
      "Separate named decision makers from generic business contacts like info@, contact@, sales@, support@, or a company phone.",
      "Return strict JSON only.",
    ].join(" "),
    user: `Company: ${company.name ?? company.domain ?? "Unknown"}\nIndustry: ${company.industry ?? ""}\nResearch summary: ${report?.summary ?? ""}\n\nPrioritize these roles when present: ${PRIORITY_ROLES.join(", ")}.\nExtract up to ${limit} named decision makers and up to 3 generic business contacts from this evidence.\n\nRules:\n- full_name for generic contacts must be exactly "Business Contact".\n- source_url must be exactly one of the SOURCE URLs shown below.\n- source_label should be Contact page, Team page, About page, Footer, or Structured data.\n- confidence is 0-100 based on evidence strength.\n- Omit fields that are not explicitly visible.\n\nJSON shape:\n{ "decision_makers": [{ "full_name", "title", "department", "linkedin_url", "email", "phone", "confidence", "source_url", "source_label", "evidence" }], "generic_business_contacts": [{ "full_name", "title", "department", "email", "phone", "confidence", "source_url", "source_label", "evidence" }] }\n\nEVIDENCE:\n${evidence}`,
  });

  return {
    decision_makers: (out.decision_makers ?? []).map((c) => ({ ...c, contact_type: "decision_maker" as const })),
    generic_business_contacts: (out.generic_business_contacts ?? []).map((c) => ({ ...c, contact_type: "business_contact" as const, full_name: "Business Contact" })),
  };
}

function verifyContacts(raw: DiscoveredContact[], pages: EvidencePage[], limit: number) {
  const pageByUrl = new Map(pages.map((p) => [p.url, p]));
  const verified: DiscoveredContact[] = [];
  const seen = new Set<string>();

  for (const contact of raw) {
    const page = pageByUrl.get(contact.source_url);
    if (!page) continue;
    const text = page.text;
    const fullName = safeText(contact.full_name);
    const isBusiness = contact.contact_type === "business_contact" || fullName.toLowerCase() === "business contact";
    if (!isBusiness && (!fullName || !containsText(text, fullName))) continue;
    const email = safeText(contact.email).toLowerCase();
    const phone = safeText(contact.phone);
    const linkedin = safeText(contact.linkedin_url);
    const verifiedEmail = email && containsText(text, email) ? email : null;
    const verifiedPhone = phone && containsText(text, phone) ? phone : null;
    const verifiedLinkedin = linkedin && (containsText(text, linkedin) || linkedin === contact.source_url) ? linkedin : null;
    if (isBusiness && !verifiedEmail && !verifiedPhone) continue;
    const title = safeText(contact.title) || (isBusiness ? "Website Business Contact" : null);
    const type = isBusiness ? "business_contact" : isDecisionMakerTitle(title) ? "decision_maker" : "business_contact";
    const key = `${type}:${verifiedEmail || verifiedLinkedin || fullName.toLowerCase()}:${contact.source_url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = safeText(contact.source_label) || page.label;
    verified.push({
      full_name: isBusiness ? "Business Contact" : fullName,
      title,
      department: safeText(contact.department) || inferDepartment(title) || null,
      linkedin_url: verifiedLinkedin,
      email: verifiedEmail,
      phone: verifiedPhone,
      location: safeText(contact.location) || null,
      avatar_url: safeText(contact.avatar_url) || null,
      confidence: clampScore(contact.confidence, isBusiness ? 72 : 78),
      source_url: contact.source_url,
      source_label: label,
      data_source_type: contact.data_source_type ?? labelToSourceType(label),
      evidence: safeText(contact.evidence).slice(0, 500) || null,
      contact_type: type,
    });
  }

  // Merge duplicates across sources by (email OR linkedin OR name+company) — prefer highest confidence.
  const merged = new Map<string, DiscoveredContact>();
  for (const c of verified) {
    const key = (c.email || c.linkedin_url || `${c.full_name.toLowerCase()}`).toLowerCase();
    const existing = merged.get(key);
    if (!existing) { merged.set(key, c); continue; }
    // Enrich existing with any missing fields.
    merged.set(key, {
      ...existing,
      title: existing.title ?? c.title,
      department: existing.department ?? c.department,
      linkedin_url: existing.linkedin_url ?? c.linkedin_url,
      email: existing.email ?? c.email,
      phone: existing.phone ?? c.phone,
      avatar_url: existing.avatar_url ?? c.avatar_url,
      location: existing.location ?? c.location,
      confidence: Math.max(existing.confidence ?? 0, c.confidence ?? 0),
    });
  }

  const all = Array.from(merged.values());
  const decisionMakers = all.filter((c) => c.contact_type === "decision_maker").slice(0, limit);
  const generic = all.filter((c) => c.contact_type === "business_contact").slice(0, 3);
  return [...decisionMakers, ...generic];
}

async function logActivity(
  supabase: DiscoverySupabase,
  workspaceId: string,
  companyId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from("activity_logs").insert({
    workspace_id: workspaceId,
    entity_type: "companies",
    entity_id: companyId,
    action,
    metadata: metadata as never,
  });
}

async function findExistingContact(supabase: DiscoverySupabase, workspaceId: string, companyId: string, contact: DiscoveredContact) {
  if (contact.email) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .ilike("email", contact.email)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (contact.linkedin_url) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .ilike("linkedin_url", contact.linkedin_url)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("company_id", companyId)
    .ilike("full_name", contact.full_name)
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function persistDiscoveredContact(params: {
  supabase: DiscoverySupabase;
  workspaceId: string;
  companyId: string;
  companyDomain: string | null;
  userId: string;
  reportId: string | null;
  contact: DiscoveredContact;
}) {
  const { supabase, workspaceId, companyId, companyDomain, userId, reportId, contact } = params;
  const nowIso = new Date().toISOString();
  let contactId = await findExistingContact(supabase, workspaceId, companyId, contact);
  const contactPatch: Record<string, unknown> = {
    title: contact.title ?? null,
    owner_id: userId,
  };
  if (contact.email) contactPatch.email = contact.email;
  if (contact.phone) contactPatch.phone = contact.phone;
  if (contact.linkedin_url) contactPatch.linkedin_url = contact.linkedin_url;
  if (contact.avatar_url) contactPatch.avatar_url = contact.avatar_url;

  if (contactId) {
    const { error } = await supabase.from("contacts").update(contactPatch).eq("id", contactId);
    if (error) throw new Error(`update contact ${contact.full_name}: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        workspace_id: workspaceId,
        company_id: companyId,
        full_name: contact.full_name,
        title: contact.title ?? null,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        linkedin_url: contact.linkedin_url ?? null,
        avatar_url: contact.avatar_url ?? null,
        owner_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert contact ${contact.full_name}: ${error.message}`);
    contactId = data?.id ?? null;
  }

  if (!contactId) throw new Error(`contact id missing for ${contact.full_name}`);

  const source = contact.contact_type === "business_contact" ? "website_contact_page" : "ai_discovery";
  const confidence = clampScore(contact.confidence, contact.contact_type === "business_contact" ? 72 : 78);
  const emailQuality = classifyEmail(contact.email, !!contact.email, companyDomain);
  const phoneQuality = classifyPhone(contact.phone, !!contact.phone);
  const label = confidenceLabel(confidence);
  const insight = {
    source,
    source_label: contact.source_label,
    data_source_type: contact.data_source_type ?? labelToSourceType(contact.source_label),
    status: "verified",
    verified: true,
    contact_type: contact.contact_type,
    department: contact.department ?? inferDepartment(contact.title) ?? null,
    role: contact.title ?? null,
    location: contact.location ?? null,
    avatar_url: contact.avatar_url ?? null,
    email_quality: emailQuality,
    phone_quality: phoneQuality,
    linkedin_available: !!contact.linkedin_url,
    email_available: !!contact.email,
    phone_available: !!contact.phone,
    confidence_label: label,
    confidence_score: confidence,
    confidence,
    reason: contact.evidence ?? `Verified from ${contact.source_label ?? "company website"}`,
    research_report_id: reportId,
    sources: [contact.source_url],
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    linkedin_url: contact.linkedin_url ?? null,
    full_name: contact.full_name,
    title: contact.title ?? null,
    discovered_at: nowIso,
  };

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();

  const leadPatch = {
    company_id: companyId,
    contact_id: contactId,
    stage: "new",
    score: confidence,
    intent_score: contact.contact_type === "decision_maker" ? Math.max(35, confidence - 20) : Math.max(15, confidence - 35),
    buying_intent: contact.contact_type === "decision_maker" ? Math.max(30, confidence - 25) : Math.max(10, confidence - 45),
    win_probability: contact.contact_type === "decision_maker" ? Math.max(20, confidence - 35) : Math.max(8, confidence - 55),
    temperature: contact.contact_type === "decision_maker" ? "warm" : "cold",
    priority: contact.contact_type === "decision_maker" ? "medium" : "low",
    next_action: contact.contact_type === "decision_maker" ? "Generate personalized outreach from verified website context." : "Confirm the right buyer through enrichment before outreach.",
    source,
    owner_id: userId,
    ai_insight: insight as never,
    ai_scored_at: nowIso,
    last_activity_at: nowIso,
  };

  if (existingLead?.id) {
    const { error } = await supabase.from("leads").update(leadPatch).eq("id", existingLead.id);
    if (error) throw new Error(`update lead ${contact.full_name}: ${error.message}`);
    return "updated" as const;
  }

  const { error } = await supabase.from("leads").insert({
    workspace_id: workspaceId,
    ...leadPatch,
  });
  if (error) throw new Error(`insert lead ${contact.full_name}: ${error.message}`);
  return "created" as const;
}

export async function runLeadDiscoveryPipeline(params: {
  supabase: DiscoverySupabase;
  workspaceId: string;
  userId: string;
  company: CompanyRow;
  report?: ReportRow | null;
  limit?: number;
  tick?: Tick;
  progressStart?: number;
  progressEnd?: number;
}): Promise<DiscoveryResult> {
  const { supabase, workspaceId, userId, company, report } = params;
  const limit = params.limit ?? 8;
  const start = params.progressStart ?? 5;
  const end = params.progressEnd ?? 95;
  const span = Math.max(1, end - start);
  const logs: string[] = [];
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const companyDomain = (company.domain ?? (company.website ? normalizeCompanyUrl(company.website).domain : null))?.toLowerCase() ?? null;

  async function step(offset: number, message: string, metadata: Record<string, unknown> = {}) {
    logs.push(message);
    await params.tick?.(Math.min(99, Math.round(start + span * offset)), message);
    await logActivity(supabase, workspaceId, company.id, "lead_discovery.step", { message, ...metadata }).catch(() => undefined);
  }

  await step(0.02, "Searching public business sources…");
  const pages = await buildEvidencePages(company, report, async (message) => {
    logs.push(message);
    await logActivity(supabase, workspaceId, company.id, "lead_discovery.step", { message }).catch(() => undefined);
  });
  await step(0.25, `Checked ${pages.length} website source${pages.length === 1 ? "" : "s"}.`, { pages: pages.map((p) => p.url) });

  await step(0.35, "Finding decision makers…");
  let linkedinContacts: DiscoveredContact[] = [];
  let linkedinPages: EvidencePage[] = [];
  try {
    const network = await searchProfessionalNetwork(company, async (message) => {
      logs.push(message);
      await logActivity(supabase, workspaceId, company.id, "lead_discovery.step", { message }).catch(() => undefined);
    });
    linkedinContacts = network.contacts;
    linkedinPages = network.pages;
    await step(0.5, `Found ${linkedinContacts.length} decision maker candidate${linkedinContacts.length === 1 ? "" : "s"} on public professional network.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`professional network: ${message}`);
    await step(0.5, "Professional network search unavailable; continuing with website evidence.", { error: message });
  }

  let aiContacts: DiscoveredContact[] = [];
  try {
    await step(0.6, "Enriching contact data…");
    const extracted = await extractContactsWithAI(company, report, pages, limit);
    aiContacts = [...extracted.decision_makers, ...extracted.generic_business_contacts];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`ai extraction: ${message}`);
    await step(0.6, "AI extraction failed; using deterministic website extraction only.", { error: message });
  }

  const fallback = fallbackBusinessContacts(pages);
  const allPages = [...pages, ...linkedinPages];
  await step(0.72, "Verifying contact quality…");
  const verified = verifyContacts([...linkedinContacts, ...aiContacts, ...fallback], allPages, limit);

  await step(0.8, `Saving leads (${verified.length})…`, {
    decision_makers: verified.filter((c) => c.contact_type === "decision_maker").length,
    business_contacts: verified.filter((c) => c.contact_type === "business_contact").length,
  });

  for (let i = 0; i < verified.length; i++) {
    const contact = verified[i];
    try {
      const outcome = await persistDiscoveredContact({
        supabase, workspaceId, companyId: company.id, companyDomain,
        userId, reportId: report?.id ?? null, contact,
      });
      if (outcome === "created") created += 1;
      else updated += 1;
      await step(0.82 + ((i + 1) / Math.max(1, verified.length)) * 0.15, `${outcome === "created" ? "Created" : "Updated"} lead: ${contact.full_name}.`, {
        contact_type: contact.contact_type,
        source_url: contact.source_url,
      });
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      await step(0.82 + ((i + 1) / Math.max(1, verified.length)) * 0.15, `Failed to save ${contact.full_name}: ${message}`);
    }
  }

  if (verified.length > 0 && created + updated === 0) {
    throw new Error(`Lead discovery found contacts but could not save them: ${errors.join("; ")}`);
  }

  const decisionMakers = verified.filter((c) => c.contact_type === "decision_maker").length;
  const businessContacts = verified.filter((c) => c.contact_type === "business_contact").length;
  const message = verified.length
    ? `Completed. Saved ${verified.length} verified contact${verified.length === 1 ? "" : "s"} (${decisionMakers} decision maker${decisionMakers === 1 ? "" : "s"}, ${businessContacts} business contact${businessContacts === 1 ? "" : "s"}) to Leads.`
    : "Completed. No named people or generic business contact details were verified on the checked sources.";

  await step(0.99, message, { created, updated, skipped, errors: errors.slice(0, 10) });

  return {
    company_id: company.id,
    report_id: report?.id ?? null,
    total: verified.length,
    decision_makers: decisionMakers,
    business_contacts: businessContacts,
    created,
    updated,
    skipped,
    pages_checked: allPages.map((p) => p.url),
    logs: logs.slice(-30),
    errors: errors.slice(0, 10),
    message,
  };
}
