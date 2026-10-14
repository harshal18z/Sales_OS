import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-[320px] grid place-items-center px-6 py-12">
      <div className="max-w-sm text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-surface-muted border border-border grid place-items-center">
          <Icon className="h-5 w-5 text-foreground-muted" />
        </div>
        <h2 className="mt-5 text-[16px] font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-2 text-[13px] text-foreground-muted leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

export function SkeletonRow({ height = "h-12" }: { height?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-surface-muted/40 animate-pulse ${height}`} />
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-xs text-foreground-subtle mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function PrimaryBtn({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="h-8 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 text-xs font-medium hover:opacity-90 transition disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs text-foreground-muted hover:text-foreground hover:border-border-strong transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-foreground-muted mb-1.5 uppercase tracking-wider">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-foreground-subtle">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-9 rounded-md bg-surface border border-border px-3 text-[13px] text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full min-h-[80px] rounded-md bg-surface border border-border px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full h-9 rounded-md bg-surface border border-border px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
