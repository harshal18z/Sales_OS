// AI Command Center: streaming server route.
// POST /api/ai/ask { workspaceId, question, threadId? }
// Streams SSE events: {type:"stage"|"token"|"citations"|"done"|"error", ...}
import { createFileRoute } from "@/lib/router-compat";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Citation = {
  id: string;
  kind: "lead" | "company" | "deal" | "email" | "meeting" | "research" | "campaign" | "revenue";
  label: string;
  href?: string;
  detail?: string;
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

function sha1(s: string) {
  // Non-crypto quick hash for cache key.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

function classify(q: string) {
  const s = q.toLowerCase();
  return {
    deals: /deal|risk|pipeline|close|forecast|revenue|won|lost|opportun/.test(s),
    leads: /lead|prospect|contact|hot|warm|cold|score|reach out|contact today|who should/.test(s),
    companies: /compan|acme|account|org|firm/.test(s),
    research: /summariz|research|about |profile|overview/.test(s),
    emails: /email|reply|replied|follow.?up|outreach|drafted|sent/.test(s),
    meetings: /meeting|call|demo|calendar|scheduled/.test(s),
    campaigns: /campaign|sequence|performed|best/.test(s),
    revenue: /revenue|forecast|month|quarter|arr|mrr|target/.test(s),
  };
}

async function gatherContext(
  supabase: ReturnType<typeof makeSupabase>,
  workspaceId: string,
  question: string,
) {
  const flags = classify(question);
  const wantAll = !Object.values(flags).some(Boolean);
  const citations: Citation[] = [];
  const ctx: Record<string, unknown> = {};

  const p: Promise<void>[] = [];

  if (wantAll || flags.deals || flags.revenue) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("crm_deals")
          .select("id,name,stage,value,probability,expected_close_date,updated_at,company_id,lead_id")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(40);
        const rows = data ?? [];
        ctx.deals = rows;
        for (const d of rows.slice(0, 15)) {
          citations.push({
            id: d.id,
            kind: "deal",
            label: `${d.name ?? "Deal"} · ${d.stage ?? ""}`.trim(),
            href: `/crm`,
            detail: `${d.value ? `$${Number(d.value).toLocaleString()}` : ""}${d.probability ? ` · ${d.probability}%` : ""}`,
          });
        }
      })(),
    );
  }

  if (wantAll || flags.leads) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("leads")
          .select("id,stage,score,intent_score,temperature,priority,buying_intent,win_probability,next_action,ai_insight,last_activity_at,company_id,contact_id,updated_at")
          .eq("workspace_id", workspaceId)
          .order("score", { ascending: false, nullsFirst: false })
          .limit(30);
        const rows = data ?? [];
        ctx.leads = rows;
        for (const l of rows.slice(0, 15)) {
          citations.push({
            id: l.id,
            kind: "lead",
            label: `Lead · ${l.stage ?? ""}`.trim(),
            href: `/lead/${l.id}`,
            detail: `${l.temperature ?? ""}${l.score != null ? ` · score ${l.score}` : ""}`,
          });
        }
      })(),
    );
  }

  if (wantAll || flags.companies || flags.research) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("companies")
          .select("id,name,domain,industry,size,revenue,tech_stack,updated_at")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(20);
        const rows = data ?? [];
        ctx.companies = rows;
        for (const c of rows.slice(0, 10)) {
          citations.push({
            id: c.id,
            kind: "company",
            label: c.name ?? c.domain ?? "Company",
            href: `/company/${c.id}`,
            detail: c.industry ?? undefined,
          });
        }
      })(),
    );
  }

  if (wantAll || flags.research || flags.companies) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("research_reports")
          .select("id,company_id,summary,confidence_score,opportunities,created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(10);
        const rows = data ?? [];
        ctx.research = rows;
        for (const r of rows.slice(0, 6)) {
          citations.push({
            id: r.id,
            kind: "research",
            label: `Research report`,
            href: r.company_id ? `/company/${r.company_id}` : `/research`,
            detail: r.confidence_score != null ? `confidence ${r.confidence_score}` : undefined,
          });
        }
      })(),
    );
  }

  if (wantAll || flags.emails) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("emails")
          .select("id,subject,status,sent_at,created_at,lead_id,campaign_id,personalization_score")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(40);
        const rows = data ?? [];
        ctx.emails = rows;
        for (const e of rows.slice(0, 10)) {
          citations.push({
            id: e.id,
            kind: "email",
            label: e.subject ?? "(no subject)",
            href: `/emails`,
            detail: e.status ?? undefined,
          });
        }
      })(),
    );
  }

  if (wantAll || flags.meetings) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("meetings")
          .select("id,title,starts_at,ends_at,status,lead_id,company_id")
          .eq("workspace_id", workspaceId)
          .order("starts_at", { ascending: false })
          .limit(20);
        const rows = data ?? [];
        ctx.meetings = rows;
        for (const m of rows.slice(0, 8)) {
          citations.push({
            id: m.id,
            kind: "meeting",
            label: m.title ?? "Meeting",
            href: `/meetings`,
            detail: m.starts_at ? new Date(m.starts_at).toLocaleString() : undefined,
          });
        }
      })(),
    );
  }

  if (wantAll || flags.campaigns) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("campaigns")
          .select("id,name,status,channel,stats,created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(15);
        const rows = data ?? [];
        ctx.campaigns = rows;
        for (const c of rows.slice(0, 8)) {
          citations.push({
            id: c.id,
            kind: "campaign",
            label: c.name ?? "Campaign",
            href: `/campaigns/${c.id}`,
            detail: c.status ?? undefined,
          });
        }
      })(),
    );
  }


  if (wantAll || flags.revenue || flags.deals) {
    p.push(
      (async () => {
        const { data } = await supabase
          .from("ai_jobs")
          .select("id,kind,output,completed_at")
          .eq("workspace_id", workspaceId)
          .eq("kind", "revenue_intelligence")
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1);
        const latest = data?.[0];
        if (latest) {
          ctx.revenue_intelligence = latest.output;
          citations.push({
            id: latest.id,
            kind: "revenue",
            label: "AI Revenue Intelligence",
            href: "/analytics",
            detail: latest.completed_at ? new Date(latest.completed_at).toLocaleString() : undefined,
          });
        }
      })(),
    );
  }

  await Promise.allSettled(p);
  return { ctx, citations };
}

async function streamAIResponse(
  question: string,
  ctx: Record<string, unknown>,
  onToken: (t: string) => void,
): Promise<string> {
  const { streamAI } = await import("@/lib/ai/provider.server");
  const system = `You are the SalesOS AI Command Center. Answer questions about the user's CRM using ONLY the supplied JSON context. Be concise, specific, and actionable. Use short paragraphs, bullet lists, and bold for names. When you reference a record, cite it inline like [lead:<id>], [deal:<id>], [company:<id>], [email:<id>], [meeting:<id>], [research:<id>], [campaign:<id>]. If information is not present in the context, say so briefly. Never invent IDs or values.`;
  const user = `QUESTION: ${question}\n\nCRM CONTEXT (JSON):\n${JSON.stringify(ctx).slice(0, 60000)}`;

  return streamAI({ system, user, onToken });
}

export const Route = createFileRoute("/api/ai/ask")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);
        if (token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { workspaceId?: string; question?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const workspaceId = body.workspaceId?.trim();
        const question = body.question?.trim();
        if (!workspaceId || !question) {
          return new Response("workspaceId and question are required", { status: 400 });
        }

        const supabase = makeSupabase(token);
        const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
        if (authErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub;

        // Workspace membership check.
        const { data: member } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!member) {
          return new Response("Forbidden", { status: 403 });
        }

        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            const send = (obj: unknown) => {
              controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
            };
            const cacheKey = sha1(`${workspaceId}::${question.toLowerCase()}`);
            const cacheFreshMin = 15;

            try {
              // Cache lookup.
              const since = new Date(Date.now() - cacheFreshMin * 60_000).toISOString();
              const { data: cached } = await supabase
                .from("ai_jobs")
                .select("id,output,completed_at")
                .eq("workspace_id", workspaceId)
                .eq("kind", "command_center")
                .eq("status", "completed")
                .gte("completed_at", since)
                .contains("input", { key: cacheKey })
                .order("completed_at", { ascending: false })
                .limit(1);
              const hit = cached?.[0];
              if (hit && hit.output && typeof hit.output === "object") {
                const out = hit.output as {
                  answer?: string;
                  citations?: Citation[];
                };
                send({ type: "stage", text: "Cached answer" });
                if (out.answer) {
                  // Stream cached answer in small chunks for continuity.
                  const chunks = out.answer.match(/.{1,40}/gs) ?? [out.answer];
                  for (const c of chunks) {
                    send({ type: "token", text: c });
                  }
                }
                if (out.citations) send({ type: "citations", items: out.citations });
                send({ type: "done", cached: true, jobId: hit.id });
                controller.close();
                return;
              }

              // Create ai_job.
              const { data: job } = await supabase
                .from("ai_jobs")
                .insert({
                  workspace_id: workspaceId,
                  kind: "command_center",
                  status: "running",
                  input: { question, key: cacheKey },
                  progress: 5,
                  output: { stage: "Reading your CRM…" },
                  created_by: userId,
                  started_at: new Date().toISOString(),
                })
                .select()
                .single();

              send({ type: "stage", text: "Reading your CRM…" });
              const { ctx, citations } = await gatherContext(supabase, workspaceId, question);

              send({ type: "stage", text: "Thinking…" });
              send({ type: "citations", items: citations });

              let full = "";
              await streamAIResponse(question, ctx, (t) => {
                full += t;
                send({ type: "token", text: t });
              });

              if (job) {
                await supabase
                  .from("ai_jobs")
                  .update({
                    status: "completed",
                    progress: 100,
                    completed_at: new Date().toISOString(),
                    output: { answer: full, citations, stage: "Complete" },
                  })
                  .eq("id", job.id);
                await supabase.from("activity_logs").insert({
                  workspace_id: workspaceId,
                  entity_type: "ai_job",
                  entity_id: job.id,
                  action: "ai.command_center",
                  metadata: { question },
                });
              }

              send({ type: "done", jobId: job?.id ?? null });
              controller.close();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              send({ type: "error", message: msg });
              controller.close();
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});
