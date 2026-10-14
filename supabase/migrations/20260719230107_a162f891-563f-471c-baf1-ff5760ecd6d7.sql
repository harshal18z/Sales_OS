-- 1) Roles enum + user_roles table with security-definer has_role()
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'sales_manager', 'sales_rep', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own roles or workspace admins" ON public.user_roles;
CREATE POLICY "read own roles or workspace admins" ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_workspace_member(workspace_id, auth.uid())
);

CREATE OR REPLACE FUNCTION public.has_role(_workspace_id uuid, _user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_workspace_id uuid, _user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE workspace_id = _workspace_id AND user_id = _user_id
  ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'sales_manager' THEN 3
    WHEN 'sales_rep' THEN 4
    WHEN 'viewer' THEN 5
  END
  LIMIT 1;
$$;

-- Backfill: existing workspace owners get owner role
INSERT INTO public.user_roles (workspace_id, user_id, role)
SELECT id, owner_id, 'owner'::public.app_role FROM public.workspaces
ON CONFLICT DO NOTHING;

-- Existing workspace members get sales_rep if not already roled
INSERT INTO public.user_roles (workspace_id, user_id, role)
SELECT wm.workspace_id, wm.user_id, 'sales_rep'::public.app_role
FROM public.workspace_members wm
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.workspace_id = wm.workspace_id AND ur.user_id = wm.user_id
)
ON CONFLICT DO NOTHING;

-- 2) Soft-delete columns on core tables (nullable timestamptz)
ALTER TABLE public.companies    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contacts     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.leads        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.crm_deals    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.campaigns    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.emails       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.meetings     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3) Indexes on hot query paths
CREATE INDEX IF NOT EXISTS idx_companies_ws            ON public.companies (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_ws             ON public.contacts (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ws_stage          ON public.leads (workspace_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ws_score          ON public.leads (workspace_id, score DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_deals_ws_stage      ON public.crm_deals (workspace_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_ws            ON public.campaigns (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emails_ws_status        ON public.emails (workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_ws_starts      ON public.meetings (workspace_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_ws_status         ON public.tasks (workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_jobs_ws_status       ON public.ai_jobs (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_ws_time   ON public.activity_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_time ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_reports_ws_company ON public.research_reports (workspace_id, company_id);
CREATE INDEX IF NOT EXISTS idx_research_reports_cache  ON public.research_reports (workspace_id, company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup       ON public.user_roles (workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user  ON public.workspace_members (user_id);

-- 4) AI cost + prompt version tracking on ai_jobs (nullable, non-breaking)
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS prompt_version text;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS tokens_input integer;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS tokens_output integer;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6);
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS cache_key text;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_ai_jobs_cache_key       ON public.ai_jobs (workspace_id, cache_key) WHERE cache_key IS NOT NULL;
