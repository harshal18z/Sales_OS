import { createFileRoute, Link, useNavigate } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { ArrowRight, Building2, Check, Globe, Lock, Sparkles, Users } from "lucide-react";
import { AuthShell, Button, Field } from "@/components/auth/shell";

export const Route = createFileRoute("/workspace-new")({
  head: () => ({
    meta: [
      { title: "Create a workspace — SalesOS AI" },
      { name: "description", content: "Spin up a new SalesOS AI workspace for your team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspaceNewPage,
});

type Plan = {
  id: "team" | "scale";
  name: string;
  price: string;
  desc: string;
  features: string[];
  recommended?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "team",
    name: "Team",
    price: "Free · 14-day trial",
    desc: "For small teams getting started with AI selling.",
    features: ["Up to 5 seats", "AI research agents", "Unified inbox", "Basic pipeline"],
  },
  {
    id: "scale",
    name: "Scale",
    price: "$49 / seat / mo",
    desc: "For sales orgs running a repeatable motion.",
    features: ["Unlimited seats", "Custom agents", "CRM sync", "Advanced analytics"],
    recommended: true,
  },
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

function WorkspaceNewPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "domain">("private");
  const [plan, setPlan] = useState<Plan["id"]>("scale");
  const [submitting, setSubmitting] = useState(false);

  const effectiveSlug = useMemo(
    () => (slugTouched ? slug : slugify(name)),
    [name, slug, slugTouched],
  );
  const canSubmit = name.trim().length >= 2 && effectiveSlug.length >= 2;

  const handleCreate = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => navigate({ to: "/onboarding" }), 700);
  };

  return (
    <AuthShell showBack={{ to: "/workspace", label: "Workspaces" }}>
      <div>
        <div className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border border-border bg-surface">
          <Sparkles className="h-3 w-3 text-[color:var(--ai)]" />
          <span className="text-[11.5px] font-medium text-[color:var(--ai)]">
            New workspace
          </span>
        </div>
        <h1 className="text-heading mt-4">Create your workspace</h1>
        <p className="text-body text-foreground-muted mt-2">
          A dedicated space for your team's pipelines, agents, and inboxes.
        </p>

        <div className="mt-8 space-y-5">
          <Field label="Workspace name">
            <div className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/5 transition-all">
              <Building2 className="h-4 w-4 text-foreground-subtle" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="Acme Corp"
                className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-foreground-subtle"
              />
            </div>
          </Field>

          <Field label="Workspace URL" hint="Lowercase letters, numbers and dashes.">
            <div className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/5 transition-all">
              <span className="text-[13px] text-foreground-subtle font-mono">
                salesos.ai/
              </span>
              <input
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="acme"
                className="flex-1 bg-transparent outline-none text-[14px] font-mono placeholder:text-foreground-subtle"
              />
              {effectiveSlug.length >= 2 && (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-mono uppercase tracking-[0.12em] text-[color:var(--success)]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  Available
                </span>
              )}
            </div>
          </Field>

          <Field label="Visibility">
            <div className="grid grid-cols-2 gap-2">
              <VisibilityTile
                active={visibility === "private"}
                onClick={() => setVisibility("private")}
                icon={<Lock className="h-3.5 w-3.5" />}
                title="Private"
                desc="Invite only"
              />
              <VisibilityTile
                active={visibility === "domain"}
                onClick={() => setVisibility("domain")}
                icon={<Globe className="h-3.5 w-3.5" />}
                title="Company domain"
                desc="Anyone at your domain"
              />
            </div>
          </Field>

          <Field label="Plan">
            <div className="space-y-2.5">
              {PLANS.map((p) => {
                const active = plan === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPlan(p.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      active
                        ? "border-foreground bg-surface shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_5%,transparent)]"
                        : "border-border bg-surface hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium">{p.name}</span>
                          {p.recommended && (
                            <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[color:var(--ai)]">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-caption mt-0.5">{p.desc}</div>
                      </div>
                      <div className="text-[13px] font-medium text-foreground-muted whitespace-nowrap">
                        {p.price}
                      </div>
                    </div>
                    <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {p.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-1.5 text-[12.5px] text-foreground-muted"
                        >
                          <Check className="h-3 w-3 text-[color:var(--success)]" strokeWidth={3} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="mt-8 flex gap-3">
          <Link to="/workspace">
            <Button variant="secondary" size="lg">
              Cancel
            </Button>
          </Link>
          <Button
            size="lg"
            full
            disabled={!canSubmit}
            loading={submitting}
            onClick={handleCreate}
            iconRight={!submitting ? <ArrowRight className="h-3.5 w-3.5" /> : undefined}
          >
            Create workspace
          </Button>
        </div>

        <p className="text-caption text-center mt-6 flex items-center justify-center gap-1.5">
          <Users className="h-3 w-3" />
          You can invite your team right after setup.
        </p>
      </div>
    </AuthShell>
  );
}

function VisibilityTile({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-left rounded-[10px] border p-3 transition-all ${
        active
          ? "border-foreground bg-surface shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_5%,transparent)]"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`h-6 w-6 rounded-md border grid place-items-center ${
            active
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-foreground-muted"
          }`}
        >
          {icon}
        </div>
        <span className="text-[14px] font-medium">{title}</span>
      </div>
      <div className="text-caption mt-1">{desc}</div>
    </button>
  );
}
