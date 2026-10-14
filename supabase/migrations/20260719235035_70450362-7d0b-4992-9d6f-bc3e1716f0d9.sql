
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ai_sequence jsonb,
  ADD COLUMN IF NOT EXISTS ai_sequence_at timestamptz,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
