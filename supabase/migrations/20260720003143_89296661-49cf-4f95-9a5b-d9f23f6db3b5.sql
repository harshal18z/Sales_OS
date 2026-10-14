
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS companies_owner_id_idx ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS contacts_owner_id_idx ON public.contacts(owner_id);
CREATE INDEX IF NOT EXISTS companies_workspace_domain_idx ON public.companies(workspace_id, lower(domain));
CREATE INDEX IF NOT EXISTS contacts_workspace_email_idx ON public.contacts(workspace_id, lower(email));
