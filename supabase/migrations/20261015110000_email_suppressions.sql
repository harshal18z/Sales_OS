CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribe',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT email_suppressions_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT email_suppressions_reason_check CHECK (reason IN ('unsubscribe', 'complaint', 'bounce', 'manual', 'other')),
  CONSTRAINT email_suppressions_source_check CHECK (source IN ('manual', 'unsubscribe_link', 'provider', 'import')),
  CONSTRAINT email_suppressions_unique_email UNIQUE (workspace_id, email)
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view suppression list"
  ON public.email_suppressions FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace managers can manage suppression list"
  ON public.email_suppressions FOR ALL
  USING (
    public.has_role(workspace_id, auth.uid(), 'owner') OR
    public.has_role(workspace_id, auth.uid(), 'admin') OR
    public.has_role(workspace_id, auth.uid(), 'sales_manager')
  )
  WITH CHECK (
    public.has_role(workspace_id, auth.uid(), 'owner') OR
    public.has_role(workspace_id, auth.uid(), 'admin') OR
    public.has_role(workspace_id, auth.uid(), 'sales_manager')
  );

CREATE INDEX IF NOT EXISTS email_suppressions_workspace_email_idx
  ON public.email_suppressions (workspace_id, email);
