CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (p.is_admin OR p.can_manage_admins)
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_superadmin());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_superadmin())
  WITH CHECK (id = auth.uid() OR public.is_superadmin());

CREATE POLICY profiles_admin_all
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  text text NOT NULL,
  text_en text,
  link_url text,
  link_text text,
  link_text_en text,
  bg_color text,
  is_active boolean NOT NULL DEFAULT false
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banners' AND policyname='banners_select_active') THEN
    CREATE POLICY banners_select_active ON public.banners
      FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='banners' AND policyname='banners_admin_all') THEN
    CREATE POLICY banners_admin_all ON public.banners
      FOR ALL TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

UPDATE public.partners
SET link_url = COALESCE(link_url, url)
WHERE link_url IS NULL;

ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS integration_type text NOT NULL DEFAULT 'mail',
  ADD COLUMN IF NOT EXISTS fio_api_token text;

UPDATE public.payment_settings
SET updated_at = now()
WHERE updated_at IS NULL;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS is_active boolean;

UPDATE public.polls
SET is_active = COALESCE(is_active, active);

ALTER TABLE public.polls
  ALTER COLUMN is_active SET DEFAULT false;

ALTER TABLE public.poll_options
  ADD COLUMN IF NOT EXISTS votes int NOT NULL DEFAULT 0;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS chairwoman_signature text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.applications
SET
  full_name = COALESCE(full_name, name),
  chairwoman_signature = COALESCE(chairwoman_signature, signature_data_url),
  rejection_reason = COALESCE(rejection_reason, decision_reason);

