import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Building2,
  Users,
  Briefcase,
  Mail,
  Calendar,
  FileSearch,
  Megaphone,
  TrendingUp,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAIAsk, type AskCitation } from "@/hooks/use-ai-ask";
import { useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Which deals are at risk?",
  "Who should I contact today?",
  "Summarize our top company account.",
  "Generate a follow-up for my hottest lead.",
  "Show hottest leads.",
  "Which campaigns performed best?",
  "Forecast this month's revenue.",
  "Which customers haven't replied?",
];

const KIND_META: Record<
  AskCitation["kind"],
  { label: string; icon: typeof Users }
> = {
  lead: { label: "Lead", icon: Users },
  company: { label: "Company", icon: Building2 },
  deal: { label: "Deal", icon: Briefcase },
  email: { label: "Email", icon: Mail },
  meeting: { label: "Meeting", icon: Calendar },
  research: { label: "Research", icon: FileSearch },
  campaign: { label: "Campaign", icon: Megaphone },
  revenue: { label: "Revenue", icon: TrendingUp },
};

// Very small, safe formatter: paragraphs, list items, and inline **bold**.
function renderAnswer(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (list.length === 0) return;
    nodes.push(
      <ul
        key={`ul-${nodes.length}`}
        className="list-disc pl-5 space-y-1 my-2 text-[13.5px] text-foreground"
      >
        {list.map((li, i) => (
          <li key={i}>{renderInline(li)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();
    if (line.trim() === "") continue;
    nodes.push(
      <p
        key={`p-${nodes.length}`}
        className="text-[13.5px] text-foreground leading-relaxed my-2"
      >
        {renderInline(line)}
      </p>,
    );
  }
  flushList();
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  // Strip inline citation markers like [lead:uuid] — shown separately.
  const cleaned = text.replace(/\[(lead|deal|company|email|meeting|research|campaign|revenue):[a-f0-9-]+\]/gi, "");
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function AICommandCenter({
  open,
  onOpenChange,
  initialQuery,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialQuery?: string;
}) {
  const { workspaceId } = useWorkspace();
  const {
    ask,
    answer,
    stage,
    citations,
    streaming,
    error,
    cached,
    reset,
  } = useAIAsk(workspaceId);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ(initialQuery ?? "");
      requestAnimationFrame(() => inputRef.current?.focus());
      if (initialQuery && initialQuery.trim()) {
        void ask(initialQuery);
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [answer, citations, stage]);

  const submit = () => {
    if (!q.trim() || streaming) return;
    void ask(q);
  };

  const hasResult = answer.length > 0 || streaming || error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-foreground text-background grid place-items-center">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="text-[13.5px] font-semibold flex-1">
            AI Command Center
          </div>
          {cached && (
            <span className="text-[11px] text-foreground-muted px-1.5 py-0.5 rounded border border-border">
              cached
            </span>
          )}
        </div>

        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask anything about your CRM…"
              className="flex-1 resize-none bg-transparent outline-none text-[14px] placeholder:text-foreground-muted min-h-[28px] max-h-32"
            />
            <button
              onClick={submit}
              disabled={!q.trim() || streaming}
              className="h-8 w-8 grid place-items-center rounded-md bg-foreground text-background disabled:opacity-40 hover:opacity-90 transition"
              aria-label="Ask"
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="max-h-[60vh] overflow-y-auto px-4 py-3"
        >
          {!hasResult && (
            <div>
              <div className="text-caption mb-2">Try asking</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setQ(ex);
                      void ask(ex);
                    }}
                    className="text-left text-[13px] px-2.5 py-1.5 rounded-md border border-border hover:bg-surface-muted transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage && streaming && !answer && (
            <div className="flex items-center gap-2 text-[13px] text-foreground-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {stage}
            </div>
          )}

          {answer && (
            <div>
              {renderAnswer(answer)}
              {streaming && (
                <span className="inline-block h-3 w-1.5 bg-foreground/60 align-middle animate-pulse ml-0.5" />
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 text-[13px] text-destructive">
              {error}
            </div>
          )}

          {citations.length > 0 && (
            <div className="mt-4">
              <div className="text-caption mb-1.5">Sources</div>
              <div className="flex flex-wrap gap-1.5">
                {citations.slice(0, 24).map((c) => {
                  const M = KIND_META[c.kind];
                  const Icon = M.icon;
                  const body = (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11.5px] px-2 py-0.5 rounded-full border border-border bg-surface hover:bg-surface-muted transition",
                      )}
                    >
                      <Icon className="h-3 w-3 text-foreground-muted" />
                      <span className="font-medium">{M.label}</span>
                      <span className="text-foreground-muted truncate max-w-[180px]">
                        {c.label}
                      </span>
                    </span>
                  );
                  return c.href ? (
                    <Link
                      key={`${c.kind}-${c.id}`}
                      to={c.href}
                      onClick={() => onOpenChange(false)}
                    >
                      {body}
                    </Link>
                  ) : (
                    <span key={`${c.kind}-${c.id}`}>{body}</span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[11.5px] text-foreground-muted">
          <div className="flex items-center gap-1.5">
            <kbd className="kbd">↵</kbd> to send
            <span className="mx-1">·</span>
            <kbd className="kbd">⌘</kbd>
            <kbd className="kbd">J</kbd> to open
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <X className="h-3 w-3" /> close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
