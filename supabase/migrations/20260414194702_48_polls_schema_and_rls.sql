ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS question_en text;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false;

ALTER TABLE public.poll_options
  ADD COLUMN IF NOT EXISTS option_text text;

ALTER TABLE public.poll_options
  ADD COLUMN IF NOT EXISTS option_text_en text;

UPDATE public.poll_options
SET option_text = COALESCE(option_text, label)
WHERE option_text IS NULL AND label IS NOT NULL;

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS polls_public_select ON public.polls;
DROP POLICY IF EXISTS polls_select_public_active ON public.polls;
DROP POLICY IF EXISTS polls_admin_all ON public.polls;
DROP POLICY IF EXISTS polls_admin_select ON public.polls;

DROP POLICY IF EXISTS poll_options_public_select ON public.poll_options;
DROP POLICY IF EXISTS poll_options_select_public_active ON public.poll_options;
DROP POLICY IF EXISTS poll_options_admin_all ON public.poll_options;
DROP POLICY IF EXISTS poll_options_admin_select ON public.poll_options;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='polls' AND policyname='polls_select_public_active') THEN
    CREATE POLICY polls_select_public_active
      ON public.polls
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true AND (ends_at IS NULL OR ends_at > now()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='polls' AND policyname='polls_admin_select') THEN
    CREATE POLICY polls_admin_select
      ON public.polls
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_view_polls = true OR p.can_edit_polls = true OR p.can_manage_admins = true)
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='polls' AND policyname='polls_admin_all') THEN
    CREATE POLICY polls_admin_all
      ON public.polls
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_edit_polls = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_edit_polls = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='poll_options' AND policyname='poll_options_select_public_active') THEN
    CREATE POLICY poll_options_select_public_active
      ON public.poll_options
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.polls p
          WHERE p.id = poll_id
            AND p.is_active = true
            AND (p.ends_at IS NULL OR p.ends_at > now())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='poll_options' AND policyname='poll_options_admin_select') THEN
    CREATE POLICY poll_options_admin_select
      ON public.poll_options
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_view_polls = true OR p.can_edit_polls = true OR p.can_manage_admins = true)
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='poll_options' AND policyname='poll_options_admin_all') THEN
    CREATE POLICY poll_options_admin_all
      ON public.poll_options
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_edit_polls = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_edit_polls = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

