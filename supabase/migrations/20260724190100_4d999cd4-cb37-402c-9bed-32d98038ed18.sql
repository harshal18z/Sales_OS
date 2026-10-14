
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS products text[],
  ADD COLUMN IF NOT EXISTS icp_score integer,
  ADD COLUMN IF NOT EXISTS confidence_score integer,
  ADD COLUMN IF NOT EXISTS recommended_outreach text,
  ADD COLUMN IF NOT EXISTS last_research_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_research_report_id uuid REFERENCES public.research_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companies_workspace_domain_idx
  ON public.companies (workspace_id, lower(domain));
