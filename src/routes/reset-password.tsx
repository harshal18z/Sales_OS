import { createFileRoute, useNavigate } from "@/lib/router-compat";
import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { AuthShell, Button, Field, Input } from "@/components/auth/shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Set new password — SalesOS AI" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell showBack={{ to: "/login", label: "Sign in" }}>
      <div>
        <h1 className="text-heading">Set a new password</h1>
        <p className="text-body text-foreground-muted mt-2">
          Choose a password you haven't used before.
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Field label="New password">
            <Input
              type="password"
              placeholder="At least 8 characters"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          <Field label="Confirm password">
            <Input
              type="password"
              placeholder="Re-enter password"
              icon={<Lock className="h-4 w-4" />}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            full
            loading={loading}
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Update password
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
