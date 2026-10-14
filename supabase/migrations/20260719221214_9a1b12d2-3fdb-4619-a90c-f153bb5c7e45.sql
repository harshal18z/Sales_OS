
ALTER TABLE public.research_reports
  ADD COLUMN IF NOT EXISTS report JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT;

CREATE TABLE IF NOT EXISTS public.research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.research_reports(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  provider TEXT,
  published_date TIMESTAMPTZ,
  snippet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_sources_report_idx ON public.research_sources(report_id);
CREATE INDEX IF NOT EXISTS research_sources_workspace_idx ON public.research_sources(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_sources TO authenticated;
GRANT ALL ON public.research_sources TO service_role;

ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wm select rs" ON public.research_sources FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "wm insert rs" ON public.research_sources FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "wm update rs" ON public.research_sources FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "wm delete rs" ON public.research_sources FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
