DO $$
BEGIN
  DROP POLICY IF EXISTS newsletter_subscriptions_admin_write ON public.newsletter_subscriptions;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='newsletter_subscriptions' AND policyname='newsletter_subscriptions_admin_select'
  ) THEN
    CREATE POLICY newsletter_subscriptions_admin_select
      ON public.newsletter_subscriptions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_manage_admins = true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='newsletter_subscriptions' AND policyname='newsletter_subscriptions_admin_update'
  ) THEN
    CREATE POLICY newsletter_subscriptions_admin_update
      ON public.newsletter_subscriptions
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_manage_admins = true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='newsletter_subscriptions' AND policyname='newsletter_subscriptions_admin_delete'
  ) THEN
    CREATE POLICY newsletter_subscriptions_admin_delete
      ON public.newsletter_subscriptions
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_manage_admins = true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='newsletter' AND policyname='newsletter_admin_all'
  ) THEN
    CREATE POLICY newsletter_admin_all
      ON public.newsletter
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_manage_admins = true)
        )
      );
  END IF;
END $$;
