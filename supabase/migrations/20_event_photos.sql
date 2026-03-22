CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_photos' AND policyname='event_photos_select_public'
  ) THEN
    CREATE POLICY event_photos_select_public
      ON public.event_photos
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = event_id
            AND e.published_at IS NOT NULL
            AND e.published_at <= now()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_photos' AND policyname='event_photos_admin_write'
  ) THEN
    CREATE POLICY event_photos_admin_write
      ON public.event_photos
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      );
  END IF;
END $$;

