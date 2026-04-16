CREATE OR REPLACE FUNCTION public.admin_reload_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reload_schema_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reload_schema_cache() TO service_role;
