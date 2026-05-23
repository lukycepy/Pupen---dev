DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_rbac_read'
  ) THEN
    CREATE POLICY events_rbac_read
      ON public.events
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (
              p.can_manage_admins = true
              OR p.can_view_events = true
              OR p.can_edit_events = true
              OR p.can_view_analytics = true
            )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='posts_rbac_read'
  ) THEN
    CREATE POLICY posts_rbac_read
      ON public.posts
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (
              p.can_manage_admins = true
              OR p.can_view_news = true
              OR p.can_edit_news = true
              OR p.can_view_analytics = true
            )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rsvp' AND policyname='rsvp_rbac_read'
  ) THEN
    CREATE POLICY rsvp_rbac_read
      ON public.rsvp
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (
              p.can_manage_admins = true
              OR p.can_view_events = true
              OR p.can_edit_events = true
              OR p.can_view_analytics = true
            )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_logs' AND policyname='admin_logs_rbac_read'
  ) THEN
    CREATE POLICY admin_logs_rbac_read
      ON public.admin_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (
              p.is_admin = true
              OR p.can_manage_admins = true
              OR p.can_view_logs = true
              OR p.can_view_analytics = true
            )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;
