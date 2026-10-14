import { createFileRoute, Link } from "@/lib/router-compat";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Copy, Mail, Plus, Shield, Trash2, Users } from "lucide-react";
import { Field, PageHeader, PrimaryBtn, Select, TextInput } from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/team")({
  head: () => ({ meta: [{ title: "Team — SalesOS AI" }] }),
  component: TeamPage,
});

type Invite = { id: string; email: string; role: string; token: string; expires_at: string; created_at: string };
const ROLES = ["admin", "sales_manager", "sales_rep", "viewer"];

function TeamPage() {
  const { user } = useAuth();
  const { workspaceId, workspace } = useWorkspace();
  const { data: members = [], isLoading } = useWorkspaceMembers();
  const permissions = usePermissions();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("sales_rep");
  const canManage = permissions.canManageMembers;
  const invites = useQuery({
    queryKey: ["workspace-invitations", workspaceId],
    enabled: !!workspaceId && canManage,
    queryFn: async () => {
      const { data, error } = await (supabase.from("workspace_invitations" as never) as any).select("id,email,role,token,expires_at,created_at").eq("workspace_id", workspaceId).is("accepted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invite[];
    },
  });
  const createInvite = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !user?.id) throw new Error("A signed-in workspace admin is required.");
      const cleanEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");
      if (members.some((member) => member.email?.toLowerCase() === cleanEmail)) throw new Error("This person is already in the workspace.");
      const { data, error } = await (supabase.from("workspace_invitations" as never) as any).insert({ workspace_id: workspaceId, email: cleanEmail, role, invited_by: user.id, token: crypto.randomUUID() }).select("id,email,role,token,expires_at,created_at").single();
      if (error) throw error;
      return data as Invite;
    },
    onSuccess: async (invite) => {
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["workspace-invitations", workspaceId] });
      const link = `${window.location.origin}/workspace-invite?token=${encodeURIComponent(invite.token)}`;
      try { await navigator.clipboard.writeText(link); toast.success("Invitation created and link copied", { description: `Share it with ${invite.email}.` }); }
      catch { toast.success("Invitation created", { description: `Copy the invitation link for ${invite.email} from the pending list.` }); }
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const revokeInvite = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase.from("workspace_invitations" as never) as any).delete().eq("id", id).eq("workspace_id", workspaceId); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workspace-invitations", workspaceId] }); toast.success("Invitation revoked"); },
    onError: (error: Error) => toast.error(error.message),
  });
  async function copyInvite(invite: Invite) {
    const url = `${window.location.origin}/workspace-invite?token=${encodeURIComponent(invite.token)}`;
    try { await navigator.clipboard.writeText(url); toast.success("Invitation link copied"); }
    catch { toast.error("Clipboard access is unavailable in this browser."); }
  }

  return <div className="min-h-full"><PageHeader title="Team" subtitle={`${workspace?.name || "Workspace"} · ${members.length} member${members.length === 1 ? "" : "s"}`} /><main className="max-w-5xl space-y-6 p-6">
    <section className="rounded-xl border border-border bg-surface p-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-muted"><Users className="h-4 w-4" /></div><div><h2 className="text-[14px] font-semibold">Workspace members</h2><p className="text-[11px] text-foreground-muted">Roles are used to control access to sales and workspace actions.</p></div></div>
      {isLoading ? <p className="mt-5 text-[12px] text-foreground-muted">Loading members…</p> : <div className="mt-4 divide-y divide-border">{members.map((member) => <div key={member.user_id} className="flex items-center gap-3 py-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-[12px] font-semibold">{(member.full_name || member.email || "U").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium">{member.full_name || member.email || "Workspace member"}</p><p className="truncate text-[11px] text-foreground-muted">{member.email || member.user_id}</p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] capitalize text-foreground-muted"><Shield className="h-3 w-3" />{member.role.replaceAll("_", " ")}</span></div>)}</div>}
    </section>
    {canManage ? <>
      <section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-[14px] font-semibold">Invite a teammate</h2><p className="mt-1 text-[11px] text-foreground-muted">Create a private link that expires in seven days. Share it with the invited email address.</p><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"><Field label="Work email"><TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" /></Field><Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></Field><PrimaryBtn onClick={() => createInvite.mutate()} disabled={!email.trim() || createInvite.isPending}><Plus className="h-3.5 w-3.5" />{createInvite.isPending ? "Creating…" : "Create invitation"}</PrimaryBtn></div><p className="mt-3 text-[10px] text-foreground-subtle">Email delivery is not configured. The link is copied so you can send it using your normal email client.</p></section>
      <section className="rounded-xl border border-border bg-surface p-5"><h2 className="text-[14px] font-semibold">Pending invitations</h2>{invites.isLoading ? <p className="mt-3 text-[12px] text-foreground-muted">Loading invitations…</p> : !invites.data?.length ? <p className="mt-3 text-[12px] text-foreground-subtle">No pending invitations.</p> : <div className="mt-3 divide-y divide-border">{invites.data.map((invite) => { const expired = new Date(invite.expires_at) <= new Date(); return <div key={invite.id} className="flex flex-wrap items-center gap-3 py-3"><Mail className="h-4 w-4 text-foreground-subtle" /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{invite.email}</p><p className="text-[10px] capitalize text-foreground-subtle">{invite.role.replaceAll("_", " ")} · {expired ? "Expired" : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}</p></div><button onClick={() => copyInvite(invite)} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[10.5px] text-foreground-muted"><Copy className="h-3 w-3" /> Copy link</button><button onClick={() => revokeInvite.mutate(invite.id)} className="rounded-md border border-border p-1.5 text-foreground-muted hover:text-destructive" aria-label="Revoke invitation"><Trash2 className="h-3.5 w-3.5" /></button></div>; })}</div>}</section>
    </> : <div className="rounded-lg border border-border bg-surface-muted/30 p-4 text-[12px] text-foreground-muted">Only workspace owners and admins can create or revoke invitations.</div>}
    {!permissions.loading && permissions.role == null && <div className="rounded-lg border border-border bg-surface-muted/30 p-4 text-[12px] text-foreground-muted">Your membership does not have a configured role. Ask a workspace owner to assign one.</div>}
  </main></div>;
}
