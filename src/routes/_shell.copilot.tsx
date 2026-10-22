import { createFileRoute, useNavigate } from "@/lib/router-compat";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Check, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  useAIResearch,
  useAIDiscoverDecisionMakers,
  useAIEmail,
  useAICampaignGenerator,
  useScheduleCampaign,
} from "@/hooks/use-ai";
import { useInsertRow } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/copilot")({
  head: () => ({
    meta: [
      { title: "AI Sales Copilot · SalesOS AI" },
      {
        name: "description",
        content:
          "Conversational AI Copilot that orchestrates research, lead discovery, email, and campaigns across SalesOS.",
      },
      { property: "og:title", content: "AI Sales Copilot · SalesOS AI" },
      {
        property: "og:description",
        content:
          "Ask in plain English. The Copilot chains SalesOS modules to research, discover, draft, and campaign.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CopilotPage,
});

type Tool =
  | "research"
  | "discover_leads"
  | "generate_email"
  | "create_campaign"
  | "schedule_campaign"
  | "navigate";

type StepPlan = { id: string; tool: Tool; label: string; args: Record<string, unknown> };
type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";
type StepRun = StepPlan & { status: StepStatus; error?: string; note?: string };

type Turn = {
  id: string;
  role: "user" | "copilot";
  text: string;
  steps?: StepRun[];
  error?: string;
};

type Catalog = {
  companies: {
    id: string;
    name: string | null;
    website: string | null;
    industry?: string | null;
  }[];
  leads: { id: string; company_id: string | null }[];
  campaigns: { id: string; name: string | null; status: string | null; channel: string | null }[];
};

const EXAMPLES = [
  "Research openai.com then find founders",
  "Find CTOs at Stripe",
  "Draft a cold email for our hottest lead",
  "Create a 5-day multi-channel campaign for AI startups",
];

function CopilotPage() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const research = useAIResearch();
  const discover = useAIDiscoverDecisionMakers();
  const email = useAIEmail();
  const campaignGen = useAICampaignGenerator();
  const schedule = useScheduleCampaign();
  const createCampaignRow = useInsertRow("campaigns", "campaigns");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (raw?: string) => {
    const message = (raw ?? input).trim();
    if (!message || busy || !workspaceId) return;
    setInput("");
    setBusy(true);

    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", text: message };
    const copilotId = crypto.randomUUID();
    setTurns((t) => [
      ...t,
      userTurn,
      { id: copilotId, role: "copilot", text: "Planning…", steps: [] },
    ]);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch("/api/ai/copilot-plan", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId, message }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `Planner ${res.status}`));
      const plan = (await res.json()) as {
        reply?: string;
        steps?: StepPlan[];
        catalog?: Catalog;
        error?: string;
      };

      if (plan.error) throw new Error(plan.error);

      const steps: StepRun[] = (plan.steps ?? []).map((s) => ({ ...s, status: "pending" }));
      setTurns((t) =>
        t.map((tt) =>
          tt.id === copilotId ? { ...tt, text: plan.reply || "Working on it.", steps } : tt,
        ),
      );

      if (steps.length === 0) {
        setBusy(false);
        return;
      }

      const catalog: Catalog = plan.catalog ?? { companies: [], leads: [], campaigns: [] };
      const patchStep = (id: string, patch: Partial<StepRun>) =>
        setTurns((t) =>
          t.map((tt) =>
            tt.id === copilotId && tt.steps
              ? { ...tt, steps: tt.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
              : tt,
          ),
        );

      const memory: {
        companyId?: string;
        leadId?: string;
        campaignId?: string;
      } = {};

      for (const step of steps) {
        patchStep(step.id, { status: "running" });
        try {
          await executeStep(step, {
            catalog,
            memory,
            navigate,
            research,
            discover,
            email,
            campaignGen,
            schedule,
            createCampaignRow,
          });
          patchStep(step.id, { status: "done" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          patchStep(step.id, { status: "failed", error: msg });
          toast.error(`${step.label}: ${msg}`);
          // Continue to next step per spec — never crash.
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTurns((t) => t.map((tt) => (tt.id === copilotId ? { ...tt, text: "", error: msg } : tt)));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded bg-foreground text-background grid place-items-center">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold">AI Sales Copilot</h1>
          <p className="text-[12px] text-foreground-muted">
            Orchestrates Research, Lead Discovery, Emails, and Campaigns.
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg border border-border bg-surface"
      >
        {turns.length === 0 ? (
          <div className="p-6">
            <div className="text-caption mb-2">Try asking</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => void send(ex)}
                  className="text-left text-[13px] px-3 py-2 rounded-md border border-border hover:bg-surface-muted transition"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {turns.map((t) => (
              <TurnView key={t.id} turn={t} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Ask the Copilot to research, discover, draft, or campaign…"
          className="flex-1 resize-none bg-transparent outline-none text-[14px] placeholder:text-foreground-muted min-h-[28px] max-h-40 py-1"
        />
        <button
          onClick={() => void send()}
          disabled={!input.trim() || busy}
          className="h-8 w-8 grid place-items-center rounded-md bg-foreground text-background disabled:opacity-40 hover:opacity-90 transition"
          aria-label="Send"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-foreground text-background px-3 py-2 text-[13.5px]">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className="max-w-[95%] w-full">
        {turn.error ? (
          <div className="text-[13px] text-destructive inline-flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> {turn.error}
          </div>
        ) : (
          <div className="text-[13.5px] text-foreground whitespace-pre-wrap">{turn.text}</div>
        )}
        {turn.steps && turn.steps.length > 0 && (
          <ul className="mt-2 space-y-1">
            {turn.steps.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 text-[12.5px] px-2 py-1.5 rounded-md border border-border bg-background"
              >
                <StatusIcon status={s.status} />
                <span
                  className={cn(
                    "flex-1",
                    s.status === "failed" && "text-destructive",
                    s.status === "done" && "text-foreground",
                    s.status === "pending" && "text-foreground-muted",
                  )}
                >
                  {s.label}
                </span>
                {s.error && (
                  <span className="text-[11.5px] text-destructive truncate max-w-[240px]">
                    {s.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />;
  if (status === "done") return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "failed") return <X className="h-3.5 w-3.5 text-destructive" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-foreground-muted/50 mx-1" />;
}

// ---------- Step execution ----------

type Ctx = {
  catalog: Catalog;
  memory: { companyId?: string; leadId?: string; campaignId?: string };
  navigate: ReturnType<typeof useNavigate>;
  research: ReturnType<typeof useAIResearch>;
  discover: ReturnType<typeof useAIDiscoverDecisionMakers>;
  email: ReturnType<typeof useAIEmail>;
  campaignGen: ReturnType<typeof useAICampaignGenerator>;
  schedule: ReturnType<typeof useScheduleCampaign>;
  createCampaignRow: ReturnType<typeof useInsertRow>;
};

function resolveCompanyId(ctx: Ctx, args: Record<string, unknown>): string | undefined {
  const raw = (args.companyId as string) || "";
  if (raw && raw !== "__previous__") return raw;
  if (raw === "__previous__" && ctx.memory.companyId) return ctx.memory.companyId;
  const q = ((args.companyQuery as string) || "").toLowerCase().trim();
  if (q) {
    const hit = ctx.catalog.companies.find(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.website && c.website.toLowerCase().includes(q)),
    );
    if (hit) return hit.id;
  }
  return ctx.memory.companyId;
}

async function executeStep(step: StepPlan, ctx: Ctx) {
  switch (step.tool) {
    case "research": {
      const url =
        (step.args.url as string) ||
        (step.args.query as string) ||
        (step.args.companyQuery as string) ||
        "";
      if (!url) throw new Error("No company URL or name provided");
      const out = (await ctx.research.mutateAsync({
        url,
        companyId: resolveCompanyId(ctx, step.args),
        query: (step.args.query as string) || undefined,
      })) as { output?: { company?: { id?: string }; company_id?: string } } | undefined;
      const cid = out?.output?.company?.id ?? out?.output?.company_id ?? undefined;
      if (cid) ctx.memory.companyId = cid;
      return;
    }
    case "discover_leads": {
      const companyId = resolveCompanyId(ctx, step.args);
      if (!companyId) throw new Error("No target company (research first or name a company)");
      const out = (await ctx.discover.mutateAsync({
        companyId,
        count: (step.args.count as number) || undefined,
      })) as { output?: { leads?: { id?: string }[] } } | undefined;
      const firstLead = out?.output?.leads?.[0]?.id;
      if (firstLead) ctx.memory.leadId = firstLead;
      ctx.memory.companyId = companyId;
      return;
    }
    case "generate_email": {
      const emailType = ((step.args.emailType as string) || "cold") as
        | "cold"
        | "follow_up"
        | "pricing"
        | "proposal"
        | "meeting_recap"
        | "re_engagement"
        | "meeting_reminder"
        | "pricing_follow_up";
      const rawLead = (step.args.leadId as string) || "";
      const leadId =
        rawLead && rawLead !== "__previous__"
          ? rawLead
          : rawLead === "__previous__"
            ? ctx.memory.leadId
            : undefined;
      await ctx.email.mutateAsync({
        emailType,
        leadId,
        companyId: resolveCompanyId(ctx, step.args),
        context: (step.args.context as string) || undefined,
        tone: (step.args.tone as string) || undefined,
        length: (step.args.length as "short" | "medium" | "long") || undefined,
        save: true,
      });
      return;
    }
    case "create_campaign": {
      const name = ((step.args.name as string) || "New Campaign").trim();
      const created = (await ctx.createCampaignRow.mutateAsync({
        name,
        status: "draft",
        channel: (step.args.channel as string) || "email",
      })) as { id?: string } | null;
      if (!created?.id) throw new Error("Campaign row failed");
      ctx.memory.campaignId = created.id;
      await ctx.campaignGen.mutateAsync({
        campaignId: created.id,
        channel: (step.args.channel as "email" | "linkedin" | "multi") || "email",
        touches: (step.args.touches as number) || undefined,
        tone: (step.args.tone as string) || undefined,
        goal: (step.args.goal as string) || undefined,
        context: (step.args.context as string) || undefined,
        companyId: resolveCompanyId(ctx, step.args),
        leadId:
          (step.args.leadId as string) === "__previous__"
            ? ctx.memory.leadId
            : (step.args.leadId as string) || undefined,
      });
      return;
    }
    case "schedule_campaign": {
      const raw = (step.args.campaignId as string) || "";
      let campaignId =
        raw && raw !== "__previous__"
          ? raw
          : raw === "__previous__"
            ? ctx.memory.campaignId
            : undefined;
      if (!campaignId) {
        const q = ((step.args.campaignQuery as string) || "").toLowerCase().trim();
        if (q) {
          const hit = ctx.catalog.campaigns.find((c) => c.name && c.name.toLowerCase().includes(q));
          if (hit) campaignId = hit.id;
        }
      }
      if (!campaignId) throw new Error("No campaign to schedule");
      await ctx.schedule.mutateAsync({
        campaignId,
        scheduledAt: (step.args.scheduledAt as string) || null,
        status: (step.args.status as "draft" | "scheduled" | "active" | "paused") || "scheduled",
      });
      return;
    }
    case "navigate": {
      const to = ((step.args.to as string) || "/dashboard") as
        | "/dashboard"
        | "/companies"
        | "/leads"
        | "/emails"
        | "/campaigns"
        | "/research"
        | "/meetings"
        | "/crm"
        | "/analytics";
      await ctx.navigate({ to });
      return;
    }
    default:
      throw new Error(`Unknown tool: ${(step as StepPlan).tool}`);
  }
}
