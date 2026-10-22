import type { ReactNode, ComponentType } from "react";
import { Sparkles } from "lucide-react";

export function PagePlaceholder({
  title,
  description,
  icon: Icon = Sparkles,
  comingNext,
  actions,
}: {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  comingNext: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="px-6 md:px-10 py-8 md:py-10 max-w-6xl">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between mb-8">
        <div className="min-w-0">
          <h1 className="text-heading truncate">{title}</h1>
          <p className="mt-1.5 text-body text-foreground-muted max-w-2xl">{description}</p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>

      <section className="rounded-xl border border-border bg-surface">
        <div className="px-6 py-14 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-xl bg-surface-muted border border-border grid place-items-center mb-4">
            <Icon className="h-5 w-5 text-foreground-muted" />
          </div>
          <h2 className="text-card-title">Nothing here yet</h2>
          <p className="mt-1.5 text-body text-foreground-muted max-w-md">
            This space will fill in as you use SalesOS AI. Get started or wait for AI to surface
            something for you.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-caption uppercase tracking-wide">Coming next</span>
          <span className="hairline flex-1" />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {comingNext.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-border bg-surface px-4 py-3 text-[13.5px] text-foreground-muted"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
