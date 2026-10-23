ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_member_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_public ON public.events;
DROP POLICY IF EXISTS events_select_anon_public ON public.events;
DROP POLICY IF EXISTS events_select_authenticated ON public.events;

CREATE POLICY events_select_anon_public
  ON public.events
  FOR SELECT
  TO anon
  USING (published_at IS NOT NULL AND published_at <= now() AND is_member_only = false);

CREATE POLICY events_select_authenticated
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL
    AND published_at <= now()
    AND (
      is_member_only = false
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_member = true OR p.is_admin = true)
      )
    )
  );

