import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AskCitation = {
  id: string;
  kind: "lead" | "company" | "deal" | "email" | "meeting" | "research" | "campaign" | "revenue";
  label: string;
  href?: string;
  detail?: string;
};

export type AskState = {
  answer: string;
  stage: string;
  citations: AskCitation[];
  streaming: boolean;
  error: string | null;
  cached: boolean;
  jobId: string | null;
};

const initial: AskState = {
  answer: "",
  stage: "",
  citations: [],
  streaming: false,
  error: null,
  cached: false,
  jobId: null,
};

export function useAIAsk(workspaceId: string | null) {
  const [state, setState] = useState<AskState>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, streaming: false }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState(initial);
  }, [cancel]);

  const ask = useCallback(
    async (question: string) => {
      if (!workspaceId) {
        setState({ ...initial, error: "No workspace" });
        return;
      }
      const q = question.trim();
      if (!q) return;

      cancel();
      const ac = new AbortController();
      abortRef.current = ac;
      setState({ ...initial, streaming: true, stage: "Preparing…" });

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setState({ ...initial, error: "Not signed in" });
        return;
      }

      try {
        const res = await fetch("/api/ai/ask", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workspaceId, question: q }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => "");
          setState((s) => ({
            ...s,
            streaming: false,
            error: t || `Request failed (${res.status})`,
          }));
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = raw.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const j = JSON.parse(payload) as
                | { type: "stage"; text: string }
                | { type: "token"; text: string }
                | { type: "citations"; items: AskCitation[] }
                | { type: "done"; cached?: boolean; jobId?: string | null }
                | { type: "error"; message: string };
              if (j.type === "stage") {
                setState((s) => ({ ...s, stage: j.text }));
              } else if (j.type === "token") {
                setState((s) => ({ ...s, answer: s.answer + j.text }));
              } else if (j.type === "citations") {
                setState((s) => ({ ...s, citations: j.items }));
              } else if (j.type === "done") {
                setState((s) => ({
                  ...s,
                  streaming: false,
                  cached: !!j.cached,
                  jobId: j.jobId ?? null,
                  stage: "",
                }));
              } else if (j.type === "error") {
                setState((s) => ({ ...s, streaming: false, error: j.message }));
              }
            } catch {
              // ignore
            }
          }
        }
        setState((s) => (s.streaming ? { ...s, streaming: false } : s));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          streaming: false,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [workspaceId, cancel],
  );

  return { ...state, ask, cancel, reset };
}
