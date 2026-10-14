CREATE TABLE IF NOT EXISTS public.scheduled_email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_draft_id text NOT NULL,
  recipients text[] NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_email_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view scheduled email jobs"
  ON public.scheduled_email_jobs FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Members can schedule their own email jobs"
  ON public.scheduled_email_jobs FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Members can cancel their own pending email jobs"
  ON public.scheduled_email_jobs FOR DELETE
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND user_id = auth.uid() AND status = 'pending');

CREATE INDEX IF NOT EXISTS scheduled_email_jobs_due_idx
  ON public.scheduled_email_jobs (scheduled_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.claim_scheduled_email_jobs(batch_size integer DEFAULT 25)
RETURNS SETOF public.scheduled_email_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT id
    FROM public.scheduled_email_jobs
    WHERE (status = 'pending' AND scheduled_at <= now())
       OR (status = 'processing' AND claimed_at < now() - interval '15 minutes')
    ORDER BY scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(batch_size, 1), 100)
  )
  UPDATE public.scheduled_email_jobs AS job
  SET status = 'processing', claimed_at = now(), attempts = attempts + 1
  FROM due
  WHERE job.id = due.id
  RETURNING job.*;
$$;

REVOKE ALL ON FUNCTION public.claim_scheduled_email_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_email_jobs(integer) TO service_role;
