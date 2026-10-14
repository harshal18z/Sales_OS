ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_campaign_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE can_approve boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.ai_sequence IS DISTINCT FROM OLD.ai_sequence OR
    NEW.goal IS DISTINCT FROM OLD.goal OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.channel IS DISTINCT FROM OLD.channel OR
    NEW.settings IS DISTINCT FROM OLD.settings
  ) THEN
    NEW.approval_status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    IF OLD.status = 'active' THEN NEW.status := 'paused'; END IF;
  END IF;

  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    can_approve := auth.role() = 'service_role' OR
      public.has_role(NEW.workspace_id, auth.uid(), 'owner') OR
      public.has_role(NEW.workspace_id, auth.uid(), 'admin') OR
      public.has_role(NEW.workspace_id, auth.uid(), 'sales_manager');
    IF NOT can_approve THEN RAISE EXCEPTION 'A workspace manager must approve campaign activation'; END IF;
    IF NEW.approval_status <> 'approved' OR NEW.approved_at IS NULL OR NEW.approved_by IS NULL THEN
      RAISE EXCEPTION 'Approve the campaign sequence before activation';
    END IF;
    IF NEW.ai_sequence IS NULL OR COALESCE(jsonb_typeof(NEW.ai_sequence -> 'steps') <> 'array', true) OR COALESCE(jsonb_array_length(NEW.ai_sequence -> 'steps'), 0) = 0 THEN
      RAISE EXCEPTION 'Generate a sequence before activating the campaign';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_campaign_activation ON public.campaigns;
CREATE TRIGGER guard_campaign_activation
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_campaign_activation();
