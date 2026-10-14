
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sub_industry text,
  ADD COLUMN IF NOT EXISTS target_customers text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS headquarters text,
  ADD COLUMN IF NOT EXISTS executive_summary text;
