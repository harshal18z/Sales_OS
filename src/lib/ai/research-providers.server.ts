// Web research provider adapters. Server-only.
// Providers are optional; the pipeline falls back gracefully when a key is missing.
//
// Env:
//   FIRECRAWL_API_KEY   (scrape)
//   TAVILY_API_KEY      (search)
//   EXA_API_KEY         (search)
//   JINA_API_KEY        (reader / search, optional — Jina Reader works without a key too)

export type SearchHit = {
  title: string;
  url: string;
  snippet?: string;
  published_date?: string | null;
  provider: string;
};

export type ScrapeResult = {
  url: string;
  title?: string;
  markdown: string;
  provider: string;
};

// ---------------- SCRAPE ----------------

async function firecrawlScrape(url: string): Promise<ScrapeResult | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      markdown?: string;
      data?: { markdown?: string; metadata?: { title?: string } };
      metadata?: { title?: string };
    };
    const md = d.markdown ?? d.data?.markdown ?? "";
    if (!md) return null;
    return {
      url,
      title: d.metadata?.title ?? d.data?.metadata?.title,
      markdown: md.slice(0, 20000),
      provider: "firecrawl",
    };
  } catch {
    return null;
  }
}

async function jinaReader(url: string): Promise<ScrapeResult | null> {
  try {
    // Jina Reader works with or without API key; key raises rate limits.
    const key = process.env.JINA_API_KEY;
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        accept: "text/plain",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.length < 50) return null;
    return {
      url,
      markdown: text.slice(0, 20000),
      provider: "jina",
    };
  } catch {
    return null;
  }
}

export async function scrapeUrl(url: string): Promise<ScrapeResult | null> {
  return (await firecrawlScrape(url)) ?? (await jinaReader(url));
}

// ---------------- SEARCH ----------------

async function tavilySearch(query: string, limit = 5): Promise<SearchHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: limit,
        search_depth: "basic",
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const d = (await res.json()) as {
      results?: { title: string; url: string; content?: string; published_date?: string }[];
    };
    return (d.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      published_date: r.published_date ?? null,
      provider: "tavily",
    }));
  } catch {
    return [];
  }
}

async function exaSearch(query: string, limit = 5): Promise<SearchHit[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({ query, numResults: limit, contents: { text: true } }),
    });
    if (!res.ok) return [];
    const d = (await res.json()) as {
      results?: { title?: string; url: string; text?: string; publishedDate?: string }[];
    };
    return (d.results ?? []).map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      snippet: r.text?.slice(0, 400),
      published_date: r.publishedDate ?? null,
      provider: "exa",
    }));
  } catch {
    return [];
  }
}

async function jinaSearch(query: string, limit = 5): Promise<SearchHit[]> {
  try {
    const key = process.env.JINA_API_KEY;
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: {
        accept: "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as {
      data?: { title: string; url: string; description?: string; date?: string }[];
    };
    return (d.data ?? []).slice(0, limit).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      published_date: r.date ?? null,
      provider: "jina",
    }));
  } catch {
    return [];
  }
}

export async function webSearch(query: string, limit = 5): Promise<SearchHit[]> {
  // Try providers in order; return first non-empty result set.
  const attempts: Array<() => Promise<SearchHit[]>> = [
    () => tavilySearch(query, limit),
    () => exaSearch(query, limit),
    () => jinaSearch(query, limit),
  ];
  for (const attempt of attempts) {
    const hits = await attempt();
    if (hits.length) return hits;
  }
  return [];
}

// ---------------- HELPERS ----------------

export function normalizeCompanyUrl(input: string): { url: string; domain: string } {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    return { url: u.toString().replace(/\/$/, ""), domain: u.hostname.replace(/^www\./, "") };
  } catch {
    return { url: raw, domain: raw };
  }
}

// Very lightweight tech-stack heuristic from raw HTML/markdown.
const TECH_SIGNALS: { name: string; re: RegExp }[] = [
  { name: "Next.js", re: /_next\/|nextjs/i },
  { name: "React", re: /react(-dom)?/i },
  { name: "Vue", re: /vue(\.js|-router)/i },
  { name: "Svelte", re: /svelte/i },
  { name: "Angular", re: /ng-version|@angular/i },
  { name: "Segment", re: /cdn\.segment\.com|analytics\.js/i },
  { name: "Google Analytics", re: /gtag\(|google-analytics|googletagmanager/i },
  { name: "HubSpot", re: /hs-scripts|hubspot/i },
  { name: "Salesforce", re: /salesforce|force\.com/i },
  { name: "Intercom", re: /widget\.intercom\.io|intercomcdn/i },
  { name: "Stripe", re: /js\.stripe\.com|stripe\.com/i },
  { name: "Shopify", re: /cdn\.shopify\.com|shopify/i },
  { name: "Cloudflare", re: /cloudflare/i },
  { name: "Vercel", re: /vercel-|vercel\.app/i },
  { name: "Webflow", re: /webflow/i },
  { name: "AWS", re: /amazonaws\.com/i },
  { name: "Mixpanel", re: /mixpanel/i },
  { name: "Amplitude", re: /amplitude/i },
];

export function detectTechStack(text: string): string[] {
  const found = new Set<string>();
  for (const t of TECH_SIGNALS) if (t.re.test(text)) found.add(t.name);
  return [...found];
}
