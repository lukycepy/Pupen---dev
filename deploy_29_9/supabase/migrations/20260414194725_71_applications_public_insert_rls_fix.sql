ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.applications TO anon, authenticated;

DROP POLICY IF EXISTS applications_public_insert ON public.applications;
CREATE POLICY applications_public_insert
  ON public.applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

SELECT public.notify_schema_change();
