import { createFileRoute, Link } from "@/lib/router-compat";
import { useState } from "react";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { AuthShell, Button, Field } from "@/components/auth/shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/magic-link")({
  head: () => ({
    meta: [
      { title: "Magic link — SalesOS AI" },
      { name: "description", content: "Sign in to SalesOS AI with a magic link." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MagicLinkPage,
});

function MagicLinkPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell showBack={{ to: "/login", label: "Sign in" }}>
      {sent ? (
        <SentState email={email} onResend={() => setSent(false)} />
      ) : (
        <div>
          <div className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border border-border bg-surface">
            <Sparkles className="h-3 w-3 text-[color:var(--ai)]" />
            <span className="text-[11.5px] font-medium text-[color:var(--ai)]">Passwordless</span>
          </div>
          <h1 className="text-heading mt-4">Sign in without a password</h1>
          <p className="text-body text-foreground-muted mt-2">
            Enter your work email — we'll send you a one-tap link.
          </p>
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <Field label="Work email">
              <div className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/5 transition-all">
                <Mail className="h-4 w-4 text-foreground-subtle" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-foreground-subtle"
                />
              </div>
            </Field>
            <Button
              type="submit"
              size="lg"
              full
              loading={loading}
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Send magic link
            </Button>
          </form>
          <p className="text-caption text-center mt-8">
            Prefer a password?{" "}
            <Link
              to="/login"
              className="text-foreground font-medium hover:underline underline-offset-4"
            >
              Sign in with password
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}

function SentState({ email, onResend }: { email: string; onResend: () => void }) {
  return (
    <div>
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl border border-border bg-background grid place-items-center">
            <Mail className="h-4 w-4 text-foreground-muted" />
          </div>
          <div className="min-w-0">
            <div className="text-card-title">Check your inbox</div>
            <p className="text-caption mt-1">
              A magic link is on its way to{" "}
              <span className="text-foreground font-medium">{email}</span>.
            </p>
          </div>
        </div>
      </div>
      <p className="text-caption text-center mt-6">
        Didn't get it?{" "}
        <button
          onClick={onResend}
          className="text-foreground font-medium hover:underline underline-offset-4"
        >
          Send again
        </button>
      </p>
    </div>
  );
}
