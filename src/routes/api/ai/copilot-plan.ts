// AI Sales Copilot: intent parser.
// POST /api/ai/copilot-plan { workspaceId, message, recent? }
// Returns JSON: { reply, steps: [{ id, tool, label, args }] }
import { createFileRoute } from "@/lib/router-compat";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Step = {
  id: string;
  tool:
    | "research"
    | "discover_leads"
    | "generate_email"
    | "create_campaign"
    | "schedule_campaign"
    | "navigate";
  label: string;
  args: Record<string, unknown>;
};

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

function makeSupabase(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (isNewKey(key) && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function callLLM(message: string, catalog: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const model = process.env.AI_MODEL || "google/gemini-2.5-flash";

  const system = `You are the SalesOS AI Sales Copilot planner. Turn the user's natural-language request into a short JSON plan that orchestrates existing SalesOS modules. NEVER invent business logic — only pick from the allowed tools.

Allowed tools:
- research: run Company Intelligence. args: { url?: string, query?: string, companyId?: string }
- discover_leads: find decision makers for a company. args: { companyId?: string, companyQuery?: string, count?: number, roles?: string[] }
- generate_email: draft an outreach/follow-up email. args: { emailType: "cold"|"follow_up"|"pricing"|"proposal"|"meeting_recap"|"re_engagement"|"meeting_reminder"|"pricing_follow_up", leadId?: string, companyId?: string, companyQuery?: string, context?: string, tone?: string, length?: "short"|"medium"|"long" }
- create_campaign: create a new campaign and generate its sequence. args: { name: string, channel?: "email"|"linkedin"|"multi", touches?: number, tone?: string, goal?: string, context?: string, companyId?: string, companyQuery?: string, leadId?: string }
- schedule_campaign: schedule/activate an existing campaign. args: { campaignId?: string, campaignQuery?: string, scheduledAt?: string, status?: "draft"|"scheduled"|"active"|"paused" }
- navigate: open a page. args: { to: "/dashboard"|"/companies"|"/leads"|"/emails"|"/campaigns"|"/research"|"/meetings"|"/crm"|"/analytics", entityId?: string }

Rules:
- Prefer IDs from the CATALOG when the user names an entity; otherwise pass companyQuery/leadId/campaignQuery so the client can resolve.
- If the user says "find AI startups in Pune" → single research step with query="AI startups in Pune".
- Multi-step chains are encouraged: e.g., "research Acme then find founders and draft a cold email" → 3 steps.
- If a step needs a company that will be created by an earlier research step, omit companyId and set companyQuery: "__previous__".
- Same convention for leadId: "__previous__" refers to the first lead created by the immediately preceding discover_leads step.
- Same for campaignId: "__previous__" for a campaign just created.
- Never emit tools not in the list. Never emit more than 6 steps.
- Reply with STRICT JSON only: {"reply": string, "steps": [...]}. Steps must be an array (empty if the request is a question with no action).`;

  const user = `USER REQUEST: ${message}\n\nCATALOG (recent workspace entities):\n${JSON.stringify(catalog).slice(0, 20000)}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as { reply?: string; steps?: Step[] };
  } catch {
    return { reply: raw, steps: [] };
  }
}

export const Route = createFileRoute("/api/ai/copilot-plan")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);
        if (token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });

        let body: { workspaceId?: string; message?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const workspaceId = body.workspaceId?.trim();
        const message = body.message?.trim();
        if (!workspaceId || !message) {
          return new Response("workspaceId and message required", { status: 400 });
        }

        const supabase = makeSupabase(token);
        const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
        if (authErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claims.claims.sub;

        const { data: member } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!member) return new Response("Forbidden", { status: 403 });

        // Small catalog for entity resolution.
        const [companies, leads, campaigns] = await Promise.all([
          supabase
            .from("companies")
            .select("id,name,website,industry")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(40),
          supabase
            .from("leads")
            .select("id,stage,company_id,contact_id")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(30),
          supabase
            .from("campaigns")
            .select("id,name,status,channel")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(20),
        ]);

        const catalog = {
          companies: companies.data ?? [],
          leads: leads.data ?? [],
          campaigns: campaigns.data ?? [],
        };

        try {
          const plan = await callLLM(message, catalog);
          const steps = Array.isArray(plan.steps) ? plan.steps.slice(0, 6) : [];
          // Assign stable ids + labels.
          const normalized: Step[] = steps.map((s, i) => ({
            id: `s${i + 1}`,
            tool: s.tool,
            label: s.label || defaultLabel(s),
            args: s.args ?? {},
          }));
          return Response.json({
            reply: plan.reply ?? "",
            steps: normalized,
            catalog,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ reply: "", steps: [], error: msg }, { status: 200 });
        }
      },
    },
  },
});

function defaultLabel(s: Step): string {
  switch (s.tool) {
    case "research":
      return `Research ${(s.args?.url as string) || (s.args?.query as string) || "company"}`;
    case "discover_leads":
      return "Discover decision makers";
    case "generate_email":
      return `Draft ${(s.args?.emailType as string) || "outreach"} email`;
    case "create_campaign":
      return `Create campaign ${(s.args?.name as string) || ""}`.trim();
    case "schedule_campaign":
      return "Schedule campaign";
    case "navigate":
      return `Open ${(s.args?.to as string) || "page"}`;
    default:
      return s.tool;
  }
}
