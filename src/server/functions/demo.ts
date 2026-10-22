// Demo Workspace Generator — server functions
// Populates a workspace with realistic sample data across all core tables.
// Marks rows so `resetDemo` can safely remove only demo data.

import { createServerFn } from "@/server/server-fn.runtime";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEMO_TAG = "demo";
const DEMO_MARKER = "[DEMO]";

// ---------- Deterministic RNG ----------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- Corpus ----------
const INDUSTRIES = [
  "SaaS",
  "Fintech",
  "Healthtech",
  "E-commerce",
  "Cybersecurity",
  "AI Infrastructure",
  "DevTools",
  "Logistics",
  "Retail",
  "Manufacturing",
  "EdTech",
  "Media",
  "Real Estate",
  "Legal Tech",
  "HR Tech",
];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const REVENUES = ["<$1M", "$1-5M", "$5-25M", "$25-100M", "$100-500M", "$500M-1B", ">$1B"];
const LOCATIONS = [
  "San Francisco, CA",
  "New York, NY",
  "Austin, TX",
  "Boston, MA",
  "Seattle, WA",
  "Denver, CO",
  "Chicago, IL",
  "London, UK",
  "Berlin, DE",
  "Bengaluru, IN",
  "Toronto, CA",
  "Singapore",
  "Sydney, AU",
  "Amsterdam, NL",
  "Paris, FR",
];
const TECHS = [
  "AWS",
  "Snowflake",
  "Salesforce",
  "HubSpot",
  "Segment",
  "Datadog",
  "Okta",
  "Postgres",
  "React",
  "Kubernetes",
  "Kafka",
  "Stripe",
  "Twilio",
  "Zendesk",
  "Slack",
  "Notion",
  "Figma",
  "Linear",
  "GitHub",
  "Cloudflare",
];
const COMPANY_PREFIX = [
  "Nova",
  "Helix",
  "Vertex",
  "Quanta",
  "Arc",
  "Lumen",
  "Nimbus",
  "Orbit",
  "Pulse",
  "Hyper",
  "Zenith",
  "Fable",
  "Kinetic",
  "Prism",
  "Beacon",
  "Cobalt",
  "Ember",
  "Forge",
  "Glide",
  "Halo",
  "Iris",
  "Junction",
  "Loom",
  "Meridian",
  "Nectar",
  "Onyx",
  "Palette",
  "Quill",
  "Ridge",
  "Sable",
];
const COMPANY_SUFFIX = [
  "Labs",
  "AI",
  "Systems",
  "Works",
  "Cloud",
  "Data",
  "Networks",
  "Health",
  "Pay",
  "Logic",
  "Stack",
  "Metrics",
  "Analytics",
  "IO",
  "Fi",
  "Bio",
  "Robotics",
  "Dynamics",
  "Studio",
  "Group",
];
const FIRST_NAMES = [
  "Aarav",
  "Priya",
  "Emma",
  "Liam",
  "Sofia",
  "Noah",
  "Ava",
  "Ethan",
  "Isabella",
  "Mia",
  "Lucas",
  "Amelia",
  "Rahul",
  "Ananya",
  "Kai",
  "Zoe",
  "Marcus",
  "Elena",
  "Diego",
  "Yuki",
  "Chen",
  "Fatima",
  "Omar",
  "Nadia",
  "Grace",
  "Henry",
  "Ivy",
  "Julian",
  "Katie",
  "Leo",
];
const LAST_NAMES = [
  "Sharma",
  "Patel",
  "Chen",
  "Wang",
  "Smith",
  "Johnson",
  "Garcia",
  "Kim",
  "Nguyen",
  "Kumar",
  "Ross",
  "Silva",
  "Brown",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Martin",
  "Thompson",
  "Lopez",
  "Lee",
  "Walker",
];
const TITLES = [
  "VP Sales",
  "Director of Marketing",
  "Chief Revenue Officer",
  "Head of Growth",
  "CTO",
  "CFO",
  "VP Engineering",
  "Head of Operations",
  "Director of Product",
  "Chief of Staff",
  "VP Customer Success",
  "Head of Partnerships",
];
const STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const DEAL_STAGES = [
  "discovery",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];
const TEMPS = ["cold", "warm", "hot", "on-fire"];
const CAMPAIGN_TEMPLATES = [
  { name: "Q4 Enterprise SaaS Outbound", channel: "email", goal: "meetings" },
  { name: "Series B Fintech ABM", channel: "multichannel", goal: "pipeline" },
  { name: "Product-Led Growth Nurture", channel: "email", goal: "activation" },
  { name: "Healthtech Executive Roundtable", channel: "email", goal: "meetings" },
  { name: "Re-engagement — Dormant Trials", channel: "email", goal: "revive" },
  { name: "Cybersecurity CISO Outreach", channel: "linkedin", goal: "meetings" },
  { name: "DevTools Community Drip", channel: "email", goal: "signups" },
  { name: "Retail Holiday Warm-up", channel: "email", goal: "renewals" },
];
const SUBJECTS = [
  "Quick idea for {company}",
  "Cutting {company}'s cycle by 30%",
  "{first_name}, worth a 15-min chat?",
  "How {peer} solved this at {company}",
  "Following up on {topic}",
  "One question about {company}'s Q4 plan",
  "Small win we saw at {peer}",
  "Ideas for {company}'s pipeline",
];
const PAIN_POINTS_BY_INDUSTRY: Record<string, string[]> = {
  SaaS: ["High CAC", "Long sales cycles", "Low activation rate"],
  Fintech: ["Compliance overhead", "Fraud detection cost", "Onboarding friction"],
  Healthtech: ["HIPAA workflows", "Physician adoption", "Payer reimbursement"],
  "E-commerce": ["Cart abandonment", "Fulfillment cost", "Ad ROAS decline"],
  Cybersecurity: ["Alert fatigue", "Shadow IT", "Compliance mapping"],
  "AI Infrastructure": ["GPU cost", "Latency at scale", "Model observability"],
  DevTools: ["Adoption inside orgs", "Pricing to enterprise", "Time-to-value"],
  Logistics: ["Last-mile cost", "Driver retention", "Route optimization"],
  Retail: ["Inventory turnover", "Margin pressure", "Omni-channel data"],
  Manufacturing: ["Supply chain risk", "OEE", "Digital transformation"],
  EdTech: ["Teacher adoption", "District procurement", "Retention"],
  Media: ["CPM decline", "Content velocity", "Attribution"],
  "Real Estate": ["Interest rate exposure", "Lead quality", "Deal velocity"],
  "Legal Tech": ["Firm change management", "Data privacy", "Billing complexity"],
  "HR Tech": ["Onboarding drop-off", "Compliance updates", "ATS integration"],
};

// ---------- Helpers ----------
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
function slugDomain(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20) + ".com"
  );
}

// ---------- Reset ----------
export const resetDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const ws = data.workspaceId;

    // Find demo companies
    const { data: demoCompanies } = await sb
      .from("companies")
      .select("id")
      .eq("workspace_id", ws)
      .contains("tags", [DEMO_TAG]);
    const companyIds: string[] = (demoCompanies ?? []).map((c: any) => c.id);

    // Find demo campaigns
    const { data: demoCampaigns } = await sb
      .from("campaigns")
      .select("id")
      .eq("workspace_id", ws)
      .like("name", `${DEMO_MARKER}%`);
    const campaignIds: string[] = (demoCampaigns ?? []).map((c: any) => c.id);

    // Find demo leads (by company_id in demo set)
    let leadIds: string[] = [];
    if (companyIds.length) {
      const { data: dl } = await sb
        .from("leads")
        .select("id")
        .eq("workspace_id", ws)
        .in("company_id", companyIds);
      leadIds = (dl ?? []).map((l: any) => l.id);
    }

    const del = async (table: string, filter: (q: any) => any) => {
      await filter(sb.from(table).delete().eq("workspace_id", ws));
    };

    // Delete in dependency order (children first for tables that CASCADE from companies would break)
    if (leadIds.length) {
      await del("tasks", (q) => q.in("lead_id", leadIds));
      await del("emails", (q) => q.in("lead_id", leadIds));
      await del("meetings", (q) => q.in("lead_id", leadIds));
      await del("research_reports", (q) => q.in("lead_id", leadIds));
    }
    if (campaignIds.length) {
      await del("emails", (q) => q.in("campaign_id", campaignIds));
      await del("leads", (q) => q.in("campaign_id", campaignIds));
      await del("campaigns", (q) => q.in("id", campaignIds));
    }
    if (companyIds.length) {
      await del("research_reports", (q) => q.in("company_id", companyIds));
      await del("meetings", (q) => q.in("company_id", companyIds));
      await del("crm_deals", (q) => q.in("company_id", companyIds));
      await del("leads", (q) => q.in("company_id", companyIds));
      await del("contacts", (q) => q.in("company_id", companyIds));
      await del("companies", (q) => q.in("id", companyIds));
    }
    // Demo activity_logs and ai_jobs (marked via metadata/input.demo=true)
    await sb
      .from("activity_logs")
      .delete()
      .eq("workspace_id", ws)
      .contains("metadata", { demo: true });
    await sb.from("ai_jobs").delete().eq("workspace_id", ws).contains("input", { demo: true });

    return { ok: true };
  });

// ---------- Generate ----------
export const generateDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        reset: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const ws = data.workspaceId;
    const userId = context.userId;
    const rng = mulberry32(hashStr(ws));

    // Optional reset first (inline — cannot call another server fn from a handler)
    if (data.reset) {
      const { data: dc } = await sb
        .from("companies")
        .select("id")
        .eq("workspace_id", ws)
        .contains("tags", [DEMO_TAG]);
      const cids: string[] = (dc ?? []).map((c: any) => c.id);
      const { data: dcp } = await sb
        .from("campaigns")
        .select("id")
        .eq("workspace_id", ws)
        .like("name", `${DEMO_MARKER}%`);
      const cpids: string[] = (dcp ?? []).map((c: any) => c.id);
      let lids: string[] = [];
      if (cids.length) {
        const { data: dl } = await sb
          .from("leads")
          .select("id")
          .eq("workspace_id", ws)
          .in("company_id", cids);
        lids = (dl ?? []).map((l: any) => l.id);
      }
      if (lids.length) {
        await sb.from("tasks").delete().eq("workspace_id", ws).in("lead_id", lids);
        await sb.from("emails").delete().eq("workspace_id", ws).in("lead_id", lids);
        await sb.from("meetings").delete().eq("workspace_id", ws).in("lead_id", lids);
        await sb.from("research_reports").delete().eq("workspace_id", ws).in("lead_id", lids);
      }
      if (cpids.length) {
        await sb.from("emails").delete().eq("workspace_id", ws).in("campaign_id", cpids);
        await sb.from("leads").delete().eq("workspace_id", ws).in("campaign_id", cpids);
        await sb.from("campaigns").delete().eq("workspace_id", ws).in("id", cpids);
      }
      if (cids.length) {
        await sb.from("research_reports").delete().eq("workspace_id", ws).in("company_id", cids);
        await sb.from("meetings").delete().eq("workspace_id", ws).in("company_id", cids);
        await sb.from("crm_deals").delete().eq("workspace_id", ws).in("company_id", cids);
        await sb.from("leads").delete().eq("workspace_id", ws).in("company_id", cids);
        await sb.from("contacts").delete().eq("workspace_id", ws).in("company_id", cids);
        await sb.from("companies").delete().eq("workspace_id", ws).in("id", cids);
      }
      await sb
        .from("activity_logs")
        .delete()
        .eq("workspace_id", ws)
        .contains("metadata", { demo: true });
      await sb.from("ai_jobs").delete().eq("workspace_id", ws).contains("input", { demo: true });
    }

    // ---- Companies (100) ----
    const companies = Array.from({ length: 100 }, (_, i) => {
      const name =
        pick(rng, COMPANY_PREFIX) +
        " " +
        pick(rng, COMPANY_SUFFIX) +
        (rng() < 0.15 ? " " + randInt(rng, 2, 99) : "");
      const industry = pick(rng, INDUSTRIES);
      return {
        workspace_id: ws,
        name,
        domain: slugDomain(name + i),
        industry,
        size: pick(rng, SIZES),
        revenue: pick(rng, REVENUES),
        location: pick(rng, LOCATIONS),
        description: `${name} is a leading ${industry.toLowerCase()} company operating across ${pick(rng, ["North America", "EMEA", "APAC", "global markets"])}.`,
        tech_stack: Array.from({ length: randInt(rng, 3, 7) }, () => pick(rng, TECHS)),
        tags: [DEMO_TAG, industry.toLowerCase()],
      };
    });
    const { data: companiesRes, error: cErr } = await sb
      .from("companies")
      .insert(companies)
      .select("id, name, industry, domain");
    if (cErr) throw new Error(`companies: ${cErr.message}`);
    const companyRows = companiesRes as {
      id: string;
      name: string;
      industry: string;
      domain: string;
    }[];

    // ---- Campaigns ----
    const campaigns = CAMPAIGN_TEMPLATES.map((t) => {
      const sent = randInt(rng, 200, 3200);
      const opens = Math.round(sent * (0.28 + rng() * 0.22));
      const replies = Math.round(sent * (0.03 + rng() * 0.06));
      const meetings = Math.round(replies * (0.15 + rng() * 0.35));
      return {
        workspace_id: ws,
        name: `${DEMO_MARKER} ${t.name}`,
        description: `AI-generated multi-touch sequence targeting ${t.goal}.`,
        status: pick(rng, ["active", "active", "active", "paused", "draft"]),
        channel: t.channel,
        goal: t.goal,
        stats: {
          sent,
          opens,
          replies,
          meetings,
          open_rate: opens / sent,
          reply_rate: replies / sent,
        },
        created_by: userId,
      };
    });
    const { data: campaignsRes, error: cpErr } = await sb
      .from("campaigns")
      .insert(campaigns)
      .select("id, name");
    if (cpErr) throw new Error(`campaigns: ${cpErr.message}`);
    const campaignRows = campaignsRes as { id: string; name: string }[];

    // ---- Contacts (1 per lead, 500) + Leads ----
    const contactsPayload: any[] = [];
    for (let i = 0; i < 500; i++) {
      const co = companyRows[i % companyRows.length];
      const first = pick(rng, FIRST_NAMES);
      const last = pick(rng, LAST_NAMES);
      contactsPayload.push({
        workspace_id: ws,
        company_id: co.id,
        full_name: `${first} ${last}`,
        title: pick(rng, TITLES),
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${co.domain}`,
        phone: `+1-${randInt(rng, 200, 999)}-${randInt(rng, 100, 999)}-${randInt(rng, 1000, 9999)}`,
      });
    }
    // Insert contacts in chunks
    const contactRows: { id: string; company_id: string; full_name: string; email: string }[] = [];
    for (let i = 0; i < contactsPayload.length; i += 250) {
      const { data: cr, error } = await sb
        .from("contacts")
        .insert(contactsPayload.slice(i, i + 250))
        .select("id, company_id, full_name, email");
      if (error) throw new Error(`contacts: ${error.message}`);
      contactRows.push(...(cr as any[]));
    }

    // Leads
    const leadsPayload = contactRows.map((c) => {
      const score = randInt(rng, 20, 99);
      const buying = randInt(rng, 10, 95);
      const win = Math.max(5, Math.min(95, Math.round(score * 0.8 + rng() * 15)));
      const temperature =
        score > 85 ? "on-fire" : score > 70 ? "hot" : score > 50 ? "warm" : "cold";
      const priority = score > 80 ? "high" : score > 55 ? "medium" : "low";
      const stage = pick(rng, STAGES);
      return {
        workspace_id: ws,
        contact_id: c.id,
        company_id: c.company_id,
        campaign_id: pick(rng, campaignRows).id,
        stage,
        score,
        intent_score: buying,
        source: pick(rng, ["outbound", "inbound", "referral", "event", "content", "ads"]),
        temperature,
        priority,
        buying_intent: buying,
        win_probability: win,
        next_action: pick(rng, [
          "Send pricing follow-up",
          "Book discovery call",
          "Share case study",
          "Introduce to CS",
          "Escalate to AE",
          "Nurture — quarterly check-in",
        ]),
        ai_insight: {
          summary: `Score ${score}: ${temperature} lead based on engagement and intent signals.`,
          signals: [
            `Visited pricing page ${randInt(rng, 1, 8)}x`,
            `Opened last ${randInt(rng, 1, 5)} emails`,
            `Company hiring in ${pick(rng, ["Sales", "RevOps", "Engineering"])}`,
          ],
        },
        ai_scored_at: daysAgo(randInt(rng, 0, 14)),
        last_activity_at: daysAgo(randInt(rng, 0, 60)),
        owner_id: userId,
        notes: `${DEMO_MARKER} demo lead`,
      };
    });
    const leadRows: { id: string; company_id: string; score: number; stage: string }[] = [];
    for (let i = 0; i < leadsPayload.length; i += 250) {
      const { data: lr, error } = await sb
        .from("leads")
        .insert(leadsPayload.slice(i, i + 250))
        .select("id, company_id, score, stage");
      if (error) throw new Error(`leads: ${error.message}`);
      leadRows.push(...(lr as any[]));
    }

    // ---- Deals (80) — pick top-scored leads ----
    const topLeads = [...leadRows].sort((a, b) => b.score - a.score).slice(0, 80);
    const dealsPayload = topLeads.map((l, i) => {
      const stage = pick(rng, DEAL_STAGES);
      const value = randInt(rng, 8, 250) * 1000;
      const probability =
        stage === "closed_won"
          ? 100
          : stage === "closed_lost"
            ? 0
            : stage === "negotiation"
              ? randInt(rng, 60, 85)
              : stage === "proposal"
                ? randInt(rng, 40, 65)
                : stage === "qualified"
                  ? randInt(rng, 20, 45)
                  : randInt(rng, 5, 25);
      const closeOffset = randInt(rng, -20, 90);
      return {
        workspace_id: ws,
        lead_id: l.id,
        company_id: l.company_id,
        name: `${companyRows.find((c) => c.id === l.company_id)?.name ?? "Deal"} — Q${randInt(rng, 1, 4)} Expansion`,
        stage,
        value,
        currency: "USD",
        probability,
        expected_close_date: new Date(Date.now() + closeOffset * 86400000)
          .toISOString()
          .slice(0, 10),
        owner_id: userId,
        notes: `${DEMO_MARKER} ${pick(rng, ["Champion identified", "Legal review pending", "Waiting on procurement", "Multi-threaded", "Executive sponsor engaged"])}`,
      };
    });
    const { error: dErr } = await sb.from("crm_deals").insert(dealsPayload);
    if (dErr) throw new Error(`deals: ${dErr.message}`);

    // ---- Research reports (60) for top companies ----
    const topCompanies = companyRows.slice(0, 60);
    const reportsPayload = topCompanies.map((co) => {
      const pains = PAIN_POINTS_BY_INDUSTRY[co.industry] ?? [
        "Growth plateau",
        "Cost of acquisition",
      ];
      return {
        workspace_id: ws,
        company_id: co.id,
        query: `Company research: ${co.name}`,
        summary: `${co.name} is expanding in ${co.industry}. Recent signals include hiring, product launches, and funding activity. Strong ICP fit for outbound.`,
        pain_points: pains.map((p) => ({
          point: p,
          severity: pick(rng, ["high", "medium", "low"]),
        })),
        opportunities: [
          { title: "Reduce onboarding time", impact: "high" },
          { title: "Expand into EMEA", impact: "medium" },
          { title: "Improve ROI reporting", impact: "high" },
        ],
        sources: [
          { title: `${co.name} — Homepage`, url: `https://${co.domain}` },
          { title: "TechCrunch coverage", url: "https://techcrunch.com" },
          { title: "LinkedIn — Hiring", url: "https://linkedin.com" },
        ],
        confidence_score: randInt(rng, 65, 96),
        industry: co.industry,
        status: "complete",
        created_by: userId,
        report: {
          icp_fit_score: randInt(rng, 60, 98),
          outreach_opportunities: [
            "Position around cycle-time reduction",
            "Reference peer wins in same industry",
          ],
          demo: true,
        },
      };
    });
    const { error: rrErr } = await sb.from("research_reports").insert(reportsPayload);
    if (rrErr) throw new Error(`research: ${rrErr.message}`);

    // ---- Meetings (40) ----
    const meetingLeads = [...leadRows].sort(() => rng() - 0.5).slice(0, 40);
    const meetingsPayload = meetingLeads.map((l, i) => {
      const offset = randInt(rng, -20, 25);
      const co = companyRows.find((c) => c.id === l.company_id);
      const start = new Date(Date.now() + offset * 86400000);
      const end = new Date(start.getTime() + 30 * 60000);
      return {
        workspace_id: ws,
        lead_id: l.id,
        company_id: l.company_id,
        title: `${co?.name ?? "Prospect"} — ${pick(rng, ["Discovery", "Demo", "Technical Deep-Dive", "Pricing Review", "Executive Sync"])}`,
        description: `${DEMO_MARKER} 30-minute meeting`,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location: "Google Meet",
        meeting_url: "https://meet.google.com/demo-" + randInt(rng, 1000, 9999),
        status: offset < 0 ? "completed" : "scheduled",
        agenda: [
          { title: "Introductions", minutes: 5 },
          { title: "Discovery questions", minutes: 15 },
          { title: "Next steps", minutes: 10 },
        ],
        attendees: [{ name: "You", email: "me@salesos.ai" }],
        action_items: [],
        created_by: userId,
      };
    });
    const { error: mErr } = await sb.from("meetings").insert(meetingsPayload);
    if (mErr) throw new Error(`meetings: ${mErr.message}`);

    // ---- Emails (300) ----
    const emailLeads = [...leadRows].sort(() => rng() - 0.5).slice(0, 300);
    const emailsPayload = emailLeads.map((l) => {
      const co = companyRows.find((c) => c.id === l.company_id);
      const status = pick(rng, ["sent", "sent", "sent", "sent", "draft", "scheduled"]);
      const subj = pick(rng, SUBJECTS)
        .replace("{company}", co?.name ?? "your team")
        .replace("{first_name}", pick(rng, FIRST_NAMES))
        .replace("{peer}", pick(rng, COMPANY_PREFIX) + " " + pick(rng, COMPANY_SUFFIX))
        .replace("{topic}", pick(rng, ["pipeline", "Q4 goals", "expansion", "ROI"]));
      return {
        workspace_id: ws,
        lead_id: l.id,
        campaign_id: pick(rng, campaignRows).id,
        subject: subj,
        body: `Hi there,\n\nSaw ${co?.name ?? "your team"} is growing in ${co?.industry ?? "the space"}. We've helped similar teams cut sales cycles by 20-30%. Worth a quick chat?\n\nBest,\nAlex`,
        tone: pick(rng, ["direct", "friendly", "consultative", "urgent"]),
        status,
        personalization_score: randInt(rng, 55, 95),
        spam_risk: randInt(rng, 2, 22),
        scheduled_at: status === "scheduled" ? daysFromNow(randInt(rng, 1, 7)) : null,
        sent_at: status === "sent" ? daysAgo(randInt(rng, 0, 45)) : null,
        created_by: userId,
      };
    });
    for (let i = 0; i < emailsPayload.length; i += 250) {
      const { error } = await sb.from("emails").insert(emailsPayload.slice(i, i + 250));
      if (error) throw new Error(`emails: ${error.message}`);
    }

    // ---- Activity logs (200) ----
    const activityLeads = [...leadRows].sort(() => rng() - 0.5).slice(0, 200);
    const activitiesPayload = activityLeads.map((l) => {
      const action = pick(rng, [
        "email.opened",
        "email.replied",
        "email.sent",
        "lead.scored",
        "meeting.booked",
        "deal.stage_changed",
        "research.generated",
        "campaign.enrolled",
      ]);
      return {
        workspace_id: ws,
        actor_id: userId,
        entity_type: "lead",
        entity_id: l.id,
        action,
        metadata: { demo: true, note: `${action} for demo lead` },
        created_at: daysAgo(randInt(rng, 0, 60)),
      };
    });
    for (let i = 0; i < activitiesPayload.length; i += 250) {
      const { error } = await sb.from("activity_logs").insert(activitiesPayload.slice(i, i + 250));
      if (error) throw new Error(`activity: ${error.message}`);
    }

    // ---- Revenue intelligence AI job (cached forecast) ----
    const monthsBack = 6;
    const trend = Array.from({ length: monthsBack }, (_, i) => {
      const base = 180000 + i * 22000;
      return {
        month: new Date(Date.now() - (monthsBack - 1 - i) * 30 * 86400000)
          .toISOString()
          .slice(0, 7),
        revenue: base + randInt(rng, -15000, 25000),
      };
    });
    const pipelineHealth = randInt(rng, 62, 88);
    const winRate = randInt(rng, 24, 38);
    const salesVelocity = randInt(rng, 45, 120);
    const forecastNext = Math.round(trend[trend.length - 1].revenue * (1 + (winRate - 25) / 100));

    await sb.from("ai_jobs").insert({
      workspace_id: ws,
      kind: "revenue_intelligence",
      status: "completed",
      progress: 100,
      input: { demo: true },
      output: {
        pipeline_health: pipelineHealth,
        win_rate_prediction: winRate,
        sales_velocity_days: salesVelocity,
        revenue_trend: trend,
        forecast_next_month: forecastNext,
        executive_summary: `Pipeline health is ${pipelineHealth}/100 with ${winRate}% predicted win rate. Sales velocity ${salesVelocity} days. Forecast: $${(forecastNext / 1000).toFixed(0)}k next month, up ~${randInt(rng, 8, 22)}% MoM.`,
        insights: [
          {
            title: "Enterprise segment outperforming",
            sentiment: "positive",
            detail: "Deal size up 18% MoM.",
          },
          {
            title: "Mid-market stalling in proposal",
            sentiment: "negative",
            detail: "Cycle time +12 days.",
          },
          { title: "Inbound quality improving", sentiment: "positive", detail: "Reply rate 8.4%." },
        ],
        recommendations: [
          { title: "Accelerate 6 late-stage deals with executive outreach", priority: "high" },
          { title: "Rework mid-market proposal template", priority: "medium" },
          { title: "Double down on top-2 campaigns", priority: "medium" },
        ],
        deals_at_risk: dealsPayload
          .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
          .slice(0, 6)
          .map((d) => ({ name: d.name, value: d.value, reason: "No activity in 14+ days" })),
        funnel: [
          { stage: "Leads", count: 500 },
          { stage: "Qualified", count: 220 },
          { stage: "Proposal", count: 80 },
          { stage: "Won", count: Math.round(80 * (winRate / 100)) },
        ],
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_by: userId,
    });

    return {
      ok: true,
      counts: {
        companies: companyRows.length,
        contacts: contactRows.length,
        leads: leadRows.length,
        deals: dealsPayload.length,
        campaigns: campaignRows.length,
        meetings: meetingsPayload.length,
        emails: emailsPayload.length,
        activities: activitiesPayload.length,
        research_reports: reportsPayload.length,
      },
    };
  });
