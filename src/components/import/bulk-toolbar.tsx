import type { ReactNode } from "react";
import { X } from "lucide-react";

export function BulkToolbar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm px-3 py-2 flex items-center gap-2 mb-3">
      <button
        onClick={onClear}
        className="h-7 w-7 grid place-items-center rounded-md border border-border text-foreground-muted hover:text-foreground"
        aria-label="Clear selection"
      >
        <X className="h-3 w-3" />
      </button>
      <span className="text-[12px] text-foreground font-medium tabular-nums">
        {count} selected
      </span>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}
