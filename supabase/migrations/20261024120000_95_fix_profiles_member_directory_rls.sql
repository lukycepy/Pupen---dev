-- Oprava: policy profiles_select_member_directory používala ve svém USING
-- EXISTS (SELECT 1 FROM public.profiles me ...), tedy dotaz na stejnou tabulku,
-- na kterou je policy aplikovaná. PostgreSQL to odmítá chybou
-- "infinite recursion detected in policy for relation \"profiles\"",
-- což shazovalo /api/auth/me-profile (HTTP 500) pro každého přihlášeného.
--
-- Řešení: kontrola oprávnění se přesune do SECURITY DEFINER funkce
-- s vypnutým row_security (stejný vzor jako public.is_superadmin()).

CREATE OR REPLACE FUNCTION public.can_view_member_directory()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (
      SELECT (
        p.is_member = true
        OR p.is_admin = true
        OR p.can_manage_admins = true
        OR p.can_view_member_portal = true
        OR p.can_edit_member_portal = true
      )
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_member_directory ON public.profiles;

CREATE POLICY profiles_select_member_directory
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    is_member = true
    AND is_blocked = false
    AND public.can_view_member_directory()
  );
