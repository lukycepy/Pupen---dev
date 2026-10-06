CREATE TABLE IF NOT EXISTS public.waitlist_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id uuid NOT NULL REFERENCES public.rsvp(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  attendees_count int NOT NULL DEFAULT 1,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  cancelled_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_offers_token_idx
  ON public.waitlist_offers (token);

CREATE INDEX IF NOT EXISTS waitlist_offers_event_status_idx
  ON public.waitlist_offers (event_id, status, expires_at);

CREATE INDEX IF NOT EXISTS waitlist_offers_rsvp_status_idx
  ON public.waitlist_offers (rsvp_id, status, expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waitlist_offers_status_check'
      AND conrelid = 'public.waitlist_offers'::regclass
  ) THEN
    ALTER TABLE public.waitlist_offers
      ADD CONSTRAINT waitlist_offers_status_check
      CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled'));
  END IF;
END $$;

ALTER TABLE public.waitlist_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='waitlist_offers' AND policyname='waitlist_offers_admin_all'
  ) THEN
    CREATE POLICY waitlist_offers_admin_all
      ON public.waitlist_offers
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      );
  END IF;
END $$;

SELECT public.notify_schema_change();
