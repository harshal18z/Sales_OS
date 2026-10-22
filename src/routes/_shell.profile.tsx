import { createFileRoute } from "@/lib/router-compat";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@/lib/query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PageHeader, PrimaryBtn, TextInput } from "@/components/app/data-ui";

export const Route = createFileRoute("/_shell/profile")({
  head: () => ({ meta: [{ title: "Profile — SalesOS AI" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url,updated_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    setFullName(profile.data?.full_name || "");
    setAvatarUrl(profile.data?.avatar_url || "");
  }, [profile.data]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) return;
    if (avatarUrl && !/^https:\/\//i.test(avatarUrl))
      return toast.error("Profile image URL must use HTTPS.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: fullName.trim() || null,
        email: user.email || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Profile saved");
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters for your password.");
    if (password !== confirmPassword) return toast.error("The passwords do not match.");
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) return toast.error(error.message);
    setPassword("");
    setConfirmPassword("");
    toast.success("Password updated");
  }

  return (
    <div className="min-h-full">
      <PageHeader title="Profile" subtitle="Update your personal details and account settings." />
      <main className="max-w-3xl p-6">
        <form onSubmit={save} className="rounded-xl border border-border bg-surface p-5 sm:p-7">
          <div className="flex items-center gap-4 border-b border-border pb-5">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-border bg-surface-muted text-lg font-semibold">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                (fullName || user?.email || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-[14px] font-semibold">Personal information</h2>
              <p className="mt-1 text-[12px] text-foreground-muted">
                Used in your workspace and sales activity.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                Full name
              </span>
              <TextInput
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                maxLength={120}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                Profile image URL
              </span>
              <TextInput
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                Email
              </span>
              <TextInput value={user?.email || ""} readOnly disabled />
            </label>
          </div>
          <div className="mt-6 flex justify-end border-t border-border pt-5">
            <PrimaryBtn type="submit" disabled={saving || profile.isLoading}>
              {saving ? "Saving…" : "Save profile"}
            </PrimaryBtn>
          </div>
        </form>
        <form
          onSubmit={changePassword}
          className="mt-5 rounded-xl border border-border bg-surface p-5 sm:p-7"
        >
          <h2 className="text-[14px] font-semibold">Change password</h2>
          <p className="mt-1 text-[12px] text-foreground-muted">
            Choose a new password for your SalesOS account.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                New password
              </span>
              <TextInput
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                Confirm password
              </span>
              <TextInput
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <PrimaryBtn type="submit" disabled={savingPassword || !password || !confirmPassword}>
              {savingPassword ? "Updating…" : "Update password"}
            </PrimaryBtn>
          </div>
        </form>
        <p className="mt-4 text-[11px] leading-5 text-foreground-subtle">
          Your email address is managed by your sign-in provider. To change it, use your account
          provider’s email update flow.
        </p>
      </main>
    </div>
  );
}
