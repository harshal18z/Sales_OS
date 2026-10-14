-- Restrict SECURITY DEFINER helpers to signed-in users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid, uuid) TO authenticated;

-- Also lock the existing is_workspace_member helper the same way
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;

-- Owners/admins can manage roles; users can never self-elevate
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (
  public.has_role(workspace_id, auth.uid(), 'owner')
  OR public.has_role(workspace_id, auth.uid(), 'admin')
)
WITH CHECK (
  public.has_role(workspace_id, auth.uid(), 'owner')
  OR public.has_role(workspace_id, auth.uid(), 'admin')
);
