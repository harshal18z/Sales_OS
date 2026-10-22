import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 text-foreground-muted" />
      <span className="text-[12px] text-foreground">
        You're offline · changes will retry when reconnected
      </span>
    </div>
  );
}
