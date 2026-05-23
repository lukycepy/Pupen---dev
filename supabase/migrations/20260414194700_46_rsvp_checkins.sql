CREATE TABLE IF NOT EXISTS public.rsvp_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id uuid NOT NULL REFERENCES public.rsvp(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by_email text,
  source text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS rsvp_checkins_event_rsvp_unique
  ON public.rsvp_checkins (event_id, rsvp_id);

CREATE INDEX IF NOT EXISTS rsvp_checkins_event_checked_in_at_idx
  ON public.rsvp_checkins (event_id, checked_in_at DESC);

ALTER TABLE public.rsvp_checkins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rsvp_checkins' AND policyname='rsvp_checkins_admin_all'
  ) THEN
    CREATE POLICY rsvp_checkins_admin_all
      ON public.rsvp_checkins
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
END $$;

