
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperature text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS buying_intent integer,
  ADD COLUMN IF NOT EXISTS win_probability integer,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS ai_insight jsonb,
  ADD COLUMN IF NOT EXISTS ai_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
