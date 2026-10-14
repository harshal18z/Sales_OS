import { createFileRoute, Link, useNavigate } from "@/lib/router-compat";
import { useState } from "react";
import { ArrowRight, Building2, Check, Lock, Mail, User } from "lucide-react";
import { AuthShell, Button, Divider, Field, Input } from "@/components/auth/shell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create your account — SalesOS AI" },
      { name: "description", content: "Create your SalesOS AI workspace in two minutes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const nextPath = search.redirect?.startsWith("/") && !search.redirect.startsWith("//") ? search.redirect : "/onboarding";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
          company,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Auto-confirm is enabled → a session exists immediately.
    // If for any reason it doesn't, still route to onboarding after sign-in.
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        toast.success("Account created. Please sign in.");
        navigate({ to: "/login" });
        return;
      }
    }
    navigate(nextPath);
  };


  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${nextPath}`,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error(result.error.message ?? "Google sign-up failed");
      return;
    }
    if (result.redirected) return;
    navigate(nextPath);
  };


  return (
    <AuthShell showBack={{ to: "/login", label: "Sign in" }}>
      <div>
        <h1 className="text-heading">Create your account</h1>
        <p className="text-body text-foreground-muted mt-2">
          Two minutes to your workspace. No credit card required.
        </p>

        <div className="mt-8">
          <Button
            variant="secondary"
            size="lg"
            full
            icon={<GoogleGlyph />}
            loading={googleLoading}
            onClick={handleGoogle}
          >
            Continue with Google
          </Button>
        </div>

        <Divider>or with email</Divider>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input
                placeholder="Alex"
                icon={<User className="h-4 w-4" />}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </Field>
            <Field label="Last name">
              <Input
                placeholder="Vance"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Work email">
            <Input
              type="email"
              placeholder="you@company.com"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="Company">
            <Input
              placeholder="Acme Corp"
              icon={<Building2 className="h-4 w-4" />}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>

          <Field label="Password" hint="At least 8 characters.">
            <Input
              type="password"
              placeholder="Create a password"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>

          <div className="pt-1 space-y-2">
            {[
              "Free 14-day trial · full features",
              "AI research, drafting, and follow-ups included",
              "Cancel anytime · no credit card",
            ].map((l) => (
              <div key={l} className="flex items-center gap-2 text-[13px] text-foreground-muted">
                <div className="h-4 w-4 rounded-full bg-[color-mix(in_oklab,var(--success)_16%,transparent)] text-[color:var(--success)] grid place-items-center">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </div>
                {l}
              </div>
            ))}
          </div>

          <Button
            type="submit"
            size="lg"
            full
            loading={loading}
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Create account
          </Button>

          <p className="text-caption text-center pt-1">
            By continuing you agree to our{" "}
            <Link to="/terms" className="text-foreground hover:underline underline-offset-4">Terms</Link>{" "}
            &{" "}
            <Link to="/privacy" className="text-foreground hover:underline underline-offset-4">Privacy Policy</Link>.
          </p>

        </form>
      </div>
    </AuthShell>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
