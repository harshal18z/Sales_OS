import { useEffect, useState, type ReactNode } from "react";
import { AppSidebar } from "./sidebar";
import { AppTopNav } from "./topnav";
import { AICommandCenter } from "./ai-command-center";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState<string | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAiQuery(undefined);
        setAiOpen(true);
      }
    };
    const onAsk = (e: Event) => {
      const detail = (e as CustomEvent<{ query?: string }>).detail;
      setAiQuery(detail?.query);
      setAiOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("salesos:ask-ai", onAsk as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("salesos:ask-ai", onAsk as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppTopNav />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <AICommandCenter
        open={aiOpen}
        onOpenChange={(v) => {
          setAiOpen(v);
          if (!v) setAiQuery(undefined);
        }}
        initialQuery={aiQuery}
      />
    </div>
  );
}
