import { Link, useRouterState } from "@/lib/router-compat";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { getPrimaryTestimonial } from "@/config/testimonials";


/* ---------- Shared UI primitives (same tokens as the design system) ---------- */

export function Button({
  variant = "primary",
  size = "md",
  children,
  loading,
  icon,
  iconRight,
  type = "button",
  className = "",
  onClick,
  disabled,
  full,
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  type?: "button" | "submit";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] whitespace-nowrap";
  const sizes = {
    sm: "h-8 px-3 text-[13px]",
    md: "h-9 px-3.5 text-[14px]",
    lg: "h-11 px-4 text-[14.5px]",
  };
  const variants = {
    primary:
      "bg-foreground text-background hover:bg-foreground/90 shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_1px_2px_0_rgba(17,17,17,0.16)]",
    secondary:
      "bg-surface text-foreground border border-border hover:bg-surface-muted hover:border-border-strong",
    ghost: "text-foreground hover:bg-surface-muted",
    danger: "bg-danger text-danger-foreground hover:opacity-90",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-current border-r-transparent animate-spin" />
      ) : (
        icon
      )}
      {children}
      {iconRight}
    </button>
  );
}

export function Field({
  label,
  hint,
  action,
  children,
  error,
}: {
  label: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12.5px] font-medium text-foreground-muted">{label}</label>
        {action}
      </div>
      {children}
      {(error || hint) && (
        <p
          className={`mt-1.5 text-[12px] ${
            error ? "text-[color:var(--danger)]" : "text-foreground-subtle"
          }`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function Input({
  icon,
  suffix,
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  suffix?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/5 transition-all">
      {icon && <span className="text-foreground-subtle">{icon}</span>}
      <input
        {...rest}
        className={`flex-1 bg-transparent outline-none text-[14px] placeholder:text-foreground-subtle ${className}`}
      />
      {suffix}
    </div>
  );
}


export function Divider({ children }: { children?: ReactNode }) {
  if (!children) return <div className="hairline my-6" />;
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="hairline flex-1" />
      <span className="text-[11.5px] font-mono uppercase tracking-[0.14em] text-foreground-subtle">
        {children}
      </span>
      <div className="hairline flex-1" />
    </div>
  );
}

/* ---------- Auth Shell (split screen, calm right rail) ---------- */

export function AuthShell({
  children,
  step,
  showBack,
}: {
  children: ReactNode;
  step?: { current: number; total: number; label?: string };
  showBack?: { to: string; label?: string };
}) {
  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-[1fr_540px]">
      {/* Left — brand rail (hidden on mobile) */}
      <aside className="hidden lg:flex flex-col justify-between p-10 border-r border-border bg-background relative overflow-hidden">
        <BrandMark />

        <QuietRail />

        <footer className="text-caption flex items-center justify-between relative z-10">
          <span>© 2026 SalesOS AI</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link to="/security" className="hover:text-foreground transition-colors">
              Security
            </Link>
          </div>
        </footer>

      </aside>

      {/* Right — form panel */}
      <main className="flex flex-col min-h-screen bg-surface lg:border-l lg:border-border">
        <header className="h-16 px-6 flex items-center justify-between border-b border-border">
          <div className="lg:hidden">
            <BrandMark small />
          </div>
          {showBack ? (
            <Link
              to={showBack.to}
              className="inline-flex items-center gap-1.5 h-8 px-2 -ml-2 rounded-md text-[13px] text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {showBack.label ?? "Back"}
            </Link>
          ) : (
            <span />
          )}
          {step ? <StepDots current={step.current} total={step.total} label={step.label} /> : null}
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:py-16">
          <div className="w-full max-w-[400px] animate-[slide-up_260ms_cubic-bezier(0.16,1,0.3,1)_both]">
            {children}
          </div>
        </div>

        <footer className="lg:hidden px-6 py-6 border-t border-border text-caption flex items-center justify-between">
          <span>© 2026 SalesOS AI</span>
          <a href="#" className="hover:text-foreground transition-colors">
            Help
          </a>
        </footer>
      </main>
    </div>
  );
}

function BrandMark({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 relative z-10 group">
      <div
        className={`${small ? "h-6 w-6" : "h-7 w-7"} rounded-md bg-foreground grid place-items-center transition-transform group-hover:scale-105`}
      >
        <span className="text-background text-[11px] font-bold tracking-tight">S</span>
      </div>
      <span className={`${small ? "text-[13.5px]" : "text-[15px]"} font-semibold tracking-tight`}>
        SalesOS
      </span>
    </Link>
  );
}

function StepDots({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="text-[12px] font-mono uppercase tracking-[0.12em] text-foreground-subtle">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < current - 1;
          const active = i === current - 1;
          return (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                active
                  ? "w-6 bg-foreground"
                  : done
                    ? "w-1.5 bg-foreground/60"
                    : "w-1.5 bg-border"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* Quiet product-flavored rail — no glass, no gradients, only tokens */
function QuietRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const copy = railCopy(pathname);
  const testimonial = getPrimaryTestimonial();

  return (
    <div className="relative z-10 max-w-[440px]">
      <div className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border border-border bg-surface">
        <Sparkles className="h-3 w-3 text-[color:var(--ai)]" />
        <span className="text-[11.5px] font-medium text-[color:var(--ai)]">{copy.tag}</span>
      </div>
      <h2 className="text-heading mt-5">{copy.title}</h2>
      <p className="text-body text-foreground-muted mt-3 max-w-[380px]">{copy.body}</p>

      <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-caption">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ai)] animate-[ai-pulse_1.6s_infinite]" />
          <span className="font-mono uppercase tracking-[0.12em] text-[color:var(--ai)]">
            Live · SalesOS
          </span>
        </div>
        <div className="mt-4 space-y-2.5">
          {copy.stream.map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-2.5 text-[13.5px]"
              style={{ animation: `fade-in 400ms ease-out ${i * 120}ms both` }}
            >
              <div
                className={`h-4 w-4 rounded-full grid place-items-center ${
                  i < copy.stream.length - 1
                    ? "bg-[color-mix(in_oklab,var(--success)_16%,transparent)] text-[color:var(--success)]"
                    : "border border-border"
                }`}
              >
                {i < copy.stream.length - 1 ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-foreground-subtle animate-[ai-pulse_1.6s_infinite]" />
                )}
              </div>
              <span
                className={
                  i === copy.stream.length - 1 ? "ai-shimmer" : "text-foreground-muted"
                }
              >
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      <blockquote className="mt-10 text-[14.5px] leading-[1.6] text-foreground max-w-[420px]">
        “{testimonial.quote}”
      </blockquote>
      <div className="mt-3 flex items-center gap-2.5">
        <div className="h-6 w-6 rounded-full bg-foreground/90 grid place-items-center text-background text-[10px] font-semibold">
          {testimonial.initials}
        </div>
        <span className="text-caption">
          {testimonial.name} · {testimonial.role}
        </span>
      </div>

    </div>
  );
}

function railCopy(pathname: string) {
  if (pathname.startsWith("/signup"))
    return {
      tag: "Getting started",
      title: "Sales, quietly automated.",
      body: "Two minutes to your workspace. SalesOS handles research, outreach, and follow-ups so your team stays on the conversations that close.",
      stream: [
        "Provisioning your workspace",
        "Preparing AI research agents",
        "Personalizing your inbox",
      ],
    };
  if (pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password"))
    return {
      tag: "Account recovery",
      title: "Back in, in a few clicks.",
      body: "We keep your workspace safe with encrypted sessions, device history, and passwordless recovery.",
      stream: ["Verifying identity", "Preparing reset link", "Waiting for your click"],
    };
  if (pathname.startsWith("/magic-link"))
    return {
      tag: "Magic link",
      title: "No passwords. Just sign in.",
      body: "One tap from your inbox and you're back in your workspace. Nothing to remember.",
      stream: ["Signing request", "Delivering to inbox", "Awaiting confirmation"],
    };
  if (pathname.startsWith("/workspace"))
    return {
      tag: "Workspaces",
      title: "Everything in its place.",
      body: "Switch between teams and territories without losing context. Your pipelines, inboxes, and agents follow you.",
      stream: ["Loading workspaces", "Restoring recent context", "Ready in a moment"],
    };
  if (pathname.startsWith("/onboarding"))
    return {
      tag: "Onboarding",
      title: "Tune SalesOS to your motion.",
      body: "A few quiet questions so AI drafts feel like you wrote them — and your pipeline reflects how your team actually sells.",
      stream: ["Calibrating agents", "Mapping your ICP", "Setting your voice"],
    };
  return {
    tag: "Welcome back",
    title: "The operating system for sales.",
    body: "A calm workspace for lead generation, research, outreach, meetings, and pipeline — powered by AI that works in the background.",
    stream: [
      "Restoring your workspace",
      "Syncing 12 conversations",
      "Refreshing pipeline signals",
    ],
  };
}
