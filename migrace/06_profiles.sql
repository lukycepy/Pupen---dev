CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  is_member boolean NOT NULL DEFAULT false,
  member_since timestamptz,
  can_manage_admins boolean NOT NULL DEFAULT false,
  can_view_events boolean NOT NULL DEFAULT false,
  can_edit_events boolean NOT NULL DEFAULT false,
  can_view_news boolean NOT NULL DEFAULT false,
  can_edit_news boolean NOT NULL DEFAULT false,
  can_view_faq boolean NOT NULL DEFAULT false,
  can_edit_faq boolean NOT NULL DEFAULT false,
  can_view_partners boolean NOT NULL DEFAULT false,
  can_edit_partners boolean NOT NULL DEFAULT false,
  can_view_apps boolean NOT NULL DEFAULT false,
  can_edit_apps boolean NOT NULL DEFAULT false,
  can_view_documents boolean NOT NULL DEFAULT false,
  can_edit_documents boolean NOT NULL DEFAULT false,
  can_view_gallery boolean NOT NULL DEFAULT false,
  can_edit_gallery boolean NOT NULL DEFAULT false,
  can_view_map boolean NOT NULL DEFAULT false,
  can_edit_map boolean NOT NULL DEFAULT false,
  can_view_hunts boolean NOT NULL DEFAULT false,
  can_edit_hunts boolean NOT NULL DEFAULT false,
  can_view_budget boolean NOT NULL DEFAULT false,
  can_edit_budget boolean NOT NULL DEFAULT false,
  can_view_logs boolean NOT NULL DEFAULT false,
  can_edit_logs boolean NOT NULL DEFAULT false,
  can_view_messages boolean NOT NULL DEFAULT false,
  can_edit_messages boolean NOT NULL DEFAULT false,
  can_view_meetings boolean NOT NULL DEFAULT false,
  can_edit_meetings boolean NOT NULL DEFAULT false,
  can_view_polls boolean NOT NULL DEFAULT false,
  can_edit_polls boolean NOT NULL DEFAULT false,
  can_view_quizzes boolean NOT NULL DEFAULT false,
  can_edit_quizzes boolean NOT NULL DEFAULT false,
  can_view_jobs boolean NOT NULL DEFAULT false,
  can_edit_jobs boolean NOT NULL DEFAULT false,
  can_view_schedule boolean NOT NULL DEFAULT false,
  can_edit_schedule boolean NOT NULL DEFAULT false,
  can_view_guide boolean NOT NULL DEFAULT false,
  can_edit_guide boolean NOT NULL DEFAULT false,
  can_view_hours boolean NOT NULL DEFAULT false,
  can_edit_hours boolean NOT NULL DEFAULT false,
  can_view_discounts boolean NOT NULL DEFAULT false,
  can_edit_discounts boolean NOT NULL DEFAULT false,
  can_view_feedback boolean NOT NULL DEFAULT false,
  can_edit_feedback boolean NOT NULL DEFAULT false,
  can_view_qr boolean NOT NULL DEFAULT false,
  can_edit_qr boolean NOT NULL DEFAULT false,
  can_view_assets boolean NOT NULL DEFAULT false,
  can_edit_assets boolean NOT NULL DEFAULT false,
  can_view_archive boolean NOT NULL DEFAULT false,
  can_edit_archive boolean NOT NULL DEFAULT false,
  can_view_books boolean NOT NULL DEFAULT false,
  can_edit_books boolean NOT NULL DEFAULT false,
  can_view_blog_mod boolean NOT NULL DEFAULT false,
  can_edit_blog_mod boolean NOT NULL DEFAULT false,
  can_view_reviews boolean NOT NULL DEFAULT false,
  can_edit_reviews boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user_profile();
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (id = auth.uid() OR is_admin = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_admin_all'
  ) THEN
    CREATE POLICY profiles_admin_all
      ON public.profiles
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_manage_admins = true))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_manage_admins = true));
  END IF;
END $$;

