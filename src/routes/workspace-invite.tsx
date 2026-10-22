import { createFileRoute, Link, useNavigate } from "@/lib/router-compat";
import { useMutation, useQueryClient } from "@/lib/query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Button } from "@/components/auth/shell";
import { useSearch } from "@/lib/router-compat";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/workspace-invite")({
  head: () => ({
    meta: [{ title: "Join a workspace — SalesOS AI" }, { name: "robots", content: "noindex" }],
  }),
  component: WorkspaceInvitePage,
});

function WorkspaceInvitePage() {
  const { token } = useSearch<{ token?: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accept = useMutation({
    mutationFn: async () => {
      if (!token || !/^[0-9a-f-]{36}$/i.test(token))
        throw new Error("This invitation link is invalid.");
      const { data, error } = await (supabase.rpc as any)("accept_workspace_invitation", {
        p_token: token,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      navigate("/dashboard", { replace: true });
    },
  });
  const loginRedirect = `/workspace-invite?token=${encodeURIComponent(token || "")}`;

  return (
    <AuthShell showBack={{ to: "/", label: "Home" }}>
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface">
          <Link2 className="h-6 w-6 text-foreground-muted" />
        </div>
        <h1 className="mt-5 text-heading">Join a SalesOS workspace</h1>
        {!token ? (
          <p className="mt-2 text-body text-foreground-muted">
            This invitation link is missing its token. Ask the workspace admin to create a new
            invitation.
          </p>
        ) : loading ? (
          <div className="mt-5 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !user ? (
          <>
            <p className="mt-2 text-body text-foreground-muted">
              Sign in using the email address that received the invitation, then return here to
              accept it.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/login" search={{ redirect: loginRedirect }}>
                <Button>Sign in</Button>
              </Link>
              <Link to="/signup" search={{ redirect: loginRedirect }}>
                <Button variant="secondary">Create account</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-body text-foreground-muted">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>.
              Accepting the invitation will add this account to the workspace with the role selected
              by its admin.
            </p>
            {accept.error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left text-[12px] text-destructive"
              >
                {(accept.error as Error).message}
              </p>
            )}
            {accept.isSuccess ? (
              <div className="mt-5 inline-flex items-center gap-2 text-[13px] text-foreground">
                <CheckCircle2 className="h-4 w-4" /> Invitation accepted
              </div>
            ) : (
              <div className="mt-6">
                <Button full onClick={() => accept.mutate()} disabled={accept.isPending}>
                  {accept.isPending ? "Accepting…" : "Accept invitation"}
                </Button>
              </div>
            )}
          </>
        )}
        <p className="mt-6 text-caption">
          Invitation links expire after seven days and can only be accepted by the invited email
          address.
        </p>
      </div>
    </AuthShell>
  );
}
