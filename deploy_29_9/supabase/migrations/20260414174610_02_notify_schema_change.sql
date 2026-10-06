CREATE OR REPLACE FUNCTION public.notify_schema_change()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_schema_change() TO PUBLIC;

