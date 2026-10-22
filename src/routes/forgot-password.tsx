import { createFileRoute, Link } from "@/lib/router-compat";
import { useState } from "react";
import { ArrowRight, Mail, MailCheck } from "lucide-react";
import { AuthShell, Button, Field } from "@/components/auth/shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — SalesOS AI" },
      { name: "description", content: "Reset your SalesOS AI password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
          <h1 className="text-heading">Reset your password</h1>
          <p className="text-body text-foreground-muted mt-2">
            Enter your work email and we'll send a secure link to set a new password.
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
              Send reset link
            </Button>
          </form>
          <p className="text-caption text-center mt-8">
            Remembered it?{" "}
            <Link
              to="/login"
              className="text-foreground font-medium hover:underline underline-offset-4"
            >
              Sign in instead
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}

function SentState({ email, onResend }: { email: string; onResend: () => void }) {
  return (
    <div className="text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl border border-border bg-surface grid place-items-center animate-[scale-in_180ms_cubic-bezier(0.25,1,0.5,1)_both]">
        <MailCheck className="h-6 w-6 text-[color:var(--success)]" />
      </div>
      <h1 className="text-heading mt-6">Check your inbox</h1>
      <p className="text-body text-foreground-muted mt-2 max-w-[340px] mx-auto">
        We sent a reset link to <span className="text-foreground font-medium">{email}</span>.
      </p>
      <div className="mt-8">
        <Link to="/login">
          <Button size="lg" full>
            Back to sign in
          </Button>
        </Link>
      </div>
      <button
        onClick={onResend}
        className="mt-4 text-[13px] text-foreground-muted hover:text-foreground transition-colors"
      >
        Didn't get it? Send again
      </button>
    </div>
  );
}
