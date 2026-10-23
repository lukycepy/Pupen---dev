ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_select_public'
  ) THEN
    EXECUTE 'DROP POLICY events_select_public ON public.events';
  END IF;
END $$;

CREATE POLICY events_select_public
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (published_at IS NOT NULL AND published_at <= now() AND archived_at IS NULL);

CREATE TABLE IF NOT EXISTS public.activity_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  year int NOT NULL,
  title text NOT NULL,
  title_en text,
  description text,
  description_en text
);

ALTER TABLE public.activity_archive
ADD COLUMN IF NOT EXISTS source_event_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS activity_archive_source_event_id_key
  ON public.activity_archive (source_event_id)
  WHERE source_event_id IS NOT NULL;

ALTER TABLE public.activity_archive ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_archive' AND policyname='activity_archive_select_public'
  ) THEN
    CREATE POLICY activity_archive_select_public
      ON public.activity_archive
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_archive' AND policyname='activity_archive_admin_write'
  ) THEN
    CREATE POLICY activity_archive_admin_write
      ON public.activity_archive
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_events = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_events = true)));
  END IF;
END $$;
