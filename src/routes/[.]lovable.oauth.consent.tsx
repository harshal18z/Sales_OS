import { createFileRoute, redirect } from "@/lib/router-compat";
import { useState } from "react";
import { Sparkles, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type OAuthAuthNS = {
  getAuthorizationDetails: (id: string) => Promise<{
    data:
      | {
          client?: { name?: string; client_uri?: string; redirect_uris?: string[] } | null;
          scope?: string | null;
          redirect_url?: string | null;
          redirect_to?: string | null;
        }
      | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
};

function oauthApi(): OAuthAuthNS {
  return (supabase.auth as unknown as { oauth: OAuthAuthNS }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }: any) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }: any) => {
    const params = new URLSearchParams(location.search);
    const authorizationId = params.get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ to: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }: any) => (
    <main className="min-h-screen grid place-items-center bg-background text-foreground px-6">
      <div className="max-w-md text-center">
        <h1 className="text-heading">Could not load this request</h1>
        <p className="text-body text-foreground-muted mt-2">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an app";
  const scopes = (details?.scope ?? "openid email profile").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(null);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen grid place-items-center bg-background text-foreground px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)] p-8">
        <div className="flex items-center gap-2 text-caption uppercase tracking-wide">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
          Authorize access
        </div>
        <h1 className="text-section mt-2">
          Connect {clientName} to SalesOS AI
        </h1>
        <p className="text-body text-foreground-muted mt-2">
          This lets {clientName} use SalesOS AI as you. It does not bypass SalesOS AI's
          permissions or backend policies.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-surface-muted px-4 py-3">
          <div className="flex items-center gap-2 text-caption uppercase tracking-wide">
            <Sparkles className="h-3 w-3 text-[var(--accent)]" />
            Requested access
          </div>
          <ul className="mt-2 space-y-1.5 text-[13.5px]">
            {scopes.map((s: string) => (
              <li key={s} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground-subtle" />
                <span>{scopeLabel(s)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground-subtle" />
              <span>Call SalesOS AI tools while you are signed in.</span>
            </li>
          </ul>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            disabled={busy !== null}
            onClick={() => decide(true)}
            className="flex-1 h-10 rounded-lg bg-foreground text-background text-[14px] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy === "approve" ? "Connecting…" : `Approve ${clientName}`}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => decide(false)}
            className="h-10 px-4 rounded-lg border border-border text-[14px] font-medium hover:bg-surface-muted disabled:opacity-50 flex items-center gap-1.5"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </div>
    </main>
  );
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case "openid":
      return "Verify your identity.";
    case "email":
      return "Share your email address.";
    case "profile":
      return "Share your basic profile.";
    default:
      return `Additional permission requested: ${scope}`;
  }
}
