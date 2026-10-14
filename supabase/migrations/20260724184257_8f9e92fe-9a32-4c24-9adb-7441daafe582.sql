-- Attach the handle_new_user trigger to auth.users so every new signup
-- gets a workspace + owner membership seeded automatically.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create workspace + owner membership for any existing user that
-- currently has neither (this is what's causing the RLS-flavored onboarding
-- failure for the account already sitting in auth.users).
DO $$
DECLARE
  u RECORD;
  new_ws_id UUID;
  base_name TEXT;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.user_id = au.id)
  LOOP
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (u.id, u.email,
            COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
            u.raw_user_meta_data->>'avatar_url')
    ON CONFLICT (id) DO NOTHING;

    base_name := COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'My');
    INSERT INTO public.workspaces (owner_id, name, slug)
    VALUES (u.id, base_name || '''s Workspace',
            'ws-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 10))
    RETURNING id INTO new_ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_ws_id, u.id, 'owner');
  END LOOP;
END $$;