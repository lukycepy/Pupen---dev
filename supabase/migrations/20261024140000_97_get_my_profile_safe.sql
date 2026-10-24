-- Bezpečné načtení vlastního profilu pro auth flow.
--
-- Některé deploymenty mohou běžet proti databázi, kde je `profiles` RLS
-- dočasně nekonzistentní (např. starší/self-referenční policy). Přímý SELECT
-- přes PostgREST pak skončí chybou typu:
--   infinite recursion detected in policy for relation "profiles"
--
-- Auth flow ale potřebuje umět načíst právě jeden vlastní profil. Proto
-- přidáváme úzce omezenou SECURITY DEFINER funkci, která vrací pouze řádek
-- aktuálně přihlášeného uživatele a nespoléhá na běžné SELECT policy.

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT to_jsonb(p)
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO service_role;
