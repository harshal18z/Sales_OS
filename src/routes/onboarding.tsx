import { createFileRoute, redirect, useNavigate } from "@/lib/router-compat";
import { useState } from "react";
import { ArrowRight, Building2, Check, DollarSign, Target, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AuthShell, Button, Field } from "@/components/auth/shell";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Set up your workspace — SalesOS AI" },
      { name: "description", content: "Configure SalesOS AI for your team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const INDUSTRIES = [
  "SaaS / Software",
  "Fintech",
  "E-commerce",
  "Healthcare",
  "Professional Services",
  "Media & Entertainment",
  "Manufacturing",
  "Education",
  "Real Estate",
  "Other",
];

const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

const REVENUES = [
  { id: "<100k", label: "Under $100K" },
  { id: "100k-500k", label: "$100K – $500K" },
  { id: "500k-1m", label: "$500K – $1M" },
  { id: "1m-5m", label: "$1M – $5M" },
  { id: "5m+", label: "$5M+" },
] as const;

const GOALS = [
  { id: "outbound", title: "Scale outbound", desc: "Run high-volume AI-powered prospecting." },
  { id: "pipeline", title: "Grow pipeline", desc: "Increase qualified opportunities." },
  { id: "close", title: "Close more deals", desc: "Improve win rate on existing pipeline." },
  { id: "retention", title: "Expand & retain", desc: "Grow revenue in existing accounts." },
  { id: "research", title: "Research & intel", desc: "Deep company & contact intelligence." },
];

const STEPS = ["Company", "Revenue", "Goals"] as const;

type Answers = {
  company: string;
  industry: string;
  size: (typeof SIZES)[number];
  revenue: string;
  goal: string;
};

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [a, setA] = useState<Answers>({
    company: "",
    industry: "SaaS / Software",
    size: "11-50",
    revenue: "1m-5m",
    goal: "pipeline",
  });
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((p) => ({ ...p, [k]: v }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const canContinueStep1 = a.company.trim().length > 0 && a.industry && a.size;

  const complete = async () => {
    setSaving(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setSaving(false);
      navigate({ to: "/login" });
      return;
    }
    const userId = userData.user.id;

    const updates = {
      name: a.company.trim(),
      industry: a.industry,
      team_size: a.size,
      revenue: a.revenue,
      goal: a.goal,
    };

    // Also persist to profile for quick access
    await supabase
      .from("profiles")
      .update({ full_name: userData.user.user_metadata?.full_name ?? null })
      .eq("id", userId);

    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("workspaces").update(updates).eq("id", existing.id);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
    } else {
      const slugBase =
        a.company
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "workspace";
      const { data: ws, error } = await supabase
        .from("workspaces")
        .insert({
          owner_id: userId,
          slug: `${slugBase}-${Math.random().toString(36).slice(2, 6)}`,
          ...updates,
        })
        .select("id")
        .single();
      if (error || !ws) {
        setSaving(false);
        toast.error(error?.message ?? "Could not create workspace");
        return;
      }
      await supabase.from("workspace_members").insert({
        workspace_id: ws.id,
        user_id: userId,
        role: "owner",
      });
    }

    toast.success("Workspace ready");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell
      step={{ current: step, total: STEPS.length, label: STEPS[step - 1] }}
      showBack={step > 1 ? { to: "#", label: "Back" } : undefined}
    >
      <div key={step} className="animate-[slide-up_260ms_cubic-bezier(0.16,1,0.3,1)_both]">
        {step === 1 && (
          <div>
            <h1 className="text-heading">Tell us about your company</h1>
            <p className="text-body text-foreground-muted mt-2">
              We'll tailor SalesOS to your business.
            </p>
            <div className="mt-8 space-y-5">
              <Field label="Company name">
                <div className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/5 transition-all">
                  <Building2 className="h-4 w-4 text-foreground-subtle" />
                  <input
                    value={a.company}
                    onChange={(e) => set("company", e.target.value)}
                    placeholder="Acme Corp"
                    autoFocus
                    className="flex-1 bg-transparent outline-none text-[14px]"
                  />
                </div>
              </Field>

              <Field label="Industry">
                <Select
                  value={a.industry}
                  onChange={(v) => set("industry", v)}
                  options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
                />
              </Field>

              <Field label="Company size">
                <Select
                  value={a.size}
                  onChange={(v) => set("size", v as Answers["size"])}
                  options={SIZES.map((s) => ({
                    value: s,
                    label: `${s} employees`,
                  }))}
                />
              </Field>
            </div>
            <Actions onNext={next} nextDisabled={!canContinueStep1} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-heading">What's your annual revenue?</h1>
            <p className="text-body text-foreground-muted mt-2">
              This helps calibrate AI recommendations to your stage.
            </p>
            <div className="mt-8 space-y-2.5">
              {REVENUES.map((r) => (
                <Tile
                  key={r.id}
                  active={a.revenue === r.id}
                  onClick={() => set("revenue", r.id)}
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  title={r.label}
                />
              ))}
            </div>
            <Actions onBack={back} onNext={next} />
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-heading">What's your primary goal?</h1>
            <p className="text-body text-foreground-muted mt-2">
              We'll prioritize the workflows that move it forward.
            </p>
            <div className="mt-8 space-y-2.5">
              {GOALS.map((g) => (
                <Tile
                  key={g.id}
                  active={a.goal === g.id}
                  onClick={() => set("goal", g.id)}
                  icon={<Target className="h-3.5 w-3.5" />}
                  title={g.title}
                  desc={g.desc}
                />
              ))}
            </div>
            <Actions onBack={back} onNext={complete} nextLabel="Complete Setup" loading={saving} />
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function Actions({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  loading,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="mt-8 flex gap-3">
      {onBack && (
        <Button variant="secondary" size="lg" onClick={onBack}>
          Back
        </Button>
      )}
      <Button
        size="lg"
        full
        onClick={onNext}
        disabled={nextDisabled}
        loading={loading}
        iconRight={!loading ? <ArrowRight className="h-3.5 w-3.5" /> : undefined}
      >
        {nextLabel}
      </Button>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/5 transition-all">
      <Users className="h-4 w-4 text-foreground-subtle" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none text-[14px] appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Tile({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        active
          ? "border-foreground bg-surface shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_5%,transparent)]"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-8 w-8 rounded-lg border grid place-items-center shrink-0 ${
            active
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-foreground-muted"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium">{title}</div>
          {desc && <div className="text-caption mt-0.5">{desc}</div>}
        </div>
        <div
          className={`h-4 w-4 rounded-full grid place-items-center shrink-0 mt-0.5 ${
            active ? "bg-foreground text-background" : "border border-border"
          }`}
        >
          {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </div>
      </div>
    </button>
  );
}
