-- Shared message templates and secure, email-bound workspace invitations.

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'general',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_templates_workspace ON public.message_templates(workspace_id, updated_at DESC);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
CREATE POLICY "workspace members read message templates" ON public.message_templates
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "workspace sellers manage message templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (
    public.has_role(workspace_id, auth.uid(), 'owner') OR
    public.has_role(workspace_id, auth.uid(), 'admin') OR
    public.has_role(workspace_id, auth.uid(), 'sales_manager') OR
    public.has_role(workspace_id, auth.uid(), 'sales_rep')
  )
  WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid()) AND (
      public.has_role(workspace_id, auth.uid(), 'owner') OR
      public.has_role(workspace_id, auth.uid(), 'admin') OR
      public.has_role(workspace_id, auth.uid(), 'sales_manager') OR
      public.has_role(workspace_id, auth.uid(), 'sales_rep')
    )
  );

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(trim(email)) <= 320),
  role public.app_role NOT NULL DEFAULT 'sales_rep',
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON public.workspace_invitations(workspace_id, created_at DESC);
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
CREATE POLICY "workspace admins view invitations" ON public.workspace_invitations
  FOR SELECT TO authenticated USING (
    public.has_role(workspace_id, auth.uid(), 'owner') OR
    public.has_role(workspace_id, auth.uid(), 'admin') OR
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
CREATE POLICY "workspace admins create invitations" ON public.workspace_invitations
  FOR INSERT TO authenticated WITH CHECK (
    invited_by = auth.uid() AND (
      public.has_role(workspace_id, auth.uid(), 'owner') OR
      public.has_role(workspace_id, auth.uid(), 'admin')
    )
  );
CREATE POLICY "workspace admins revoke invitations" ON public.workspace_invitations
  FOR DELETE TO authenticated USING (
    public.has_role(workspace_id, auth.uid(), 'owner') OR
    public.has_role(workspace_id, auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE invite public.workspace_invitations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before accepting an invitation'; END IF;
  SELECT * INTO invite FROM public.workspace_invitations
    WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF invite.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation has already been accepted'; END IF;
  IF invite.expires_at <= now() THEN RAISE EXCEPTION 'Invitation has expired'; END IF;
  IF lower(invite.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'Sign in with the email address this invitation was sent to';
  END IF;
  INSERT INTO public.workspace_members(workspace_id, user_id, role)
    VALUES (invite.workspace_id, auth.uid(), invite.role::text)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  INSERT INTO public.user_roles(workspace_id, user_id, role)
    VALUES (invite.workspace_id, auth.uid(), invite.role)
    ON CONFLICT DO NOTHING;
  UPDATE public.workspace_invitations SET accepted_at = now(), accepted_by = auth.uid()
    WHERE id = invite.id;
  RETURN invite.workspace_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_workspace_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(uuid) TO authenticated;
