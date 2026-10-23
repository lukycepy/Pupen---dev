CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_login_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  normalized_email text NOT NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.user_login_aliases
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS normalized_email text,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL;

UPDATE public.user_login_aliases
SET normalized_email = lower(trim(email))
WHERE coalesce(trim(normalized_email), '') = ''
  AND coalesce(trim(email), '') <> '';

DELETE FROM public.user_login_aliases
WHERE coalesce(trim(email), '') = ''
   OR coalesce(trim(normalized_email), '') = '';

WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY normalized_email
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.user_login_aliases
)
DELETE FROM public.user_login_aliases target
USING ranked
WHERE target.ctid = ranked.ctid
  AND ranked.rn > 1;

ALTER TABLE public.user_login_aliases
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN normalized_email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_login_aliases_normalized_email_uidx
  ON public.user_login_aliases (normalized_email);

CREATE UNIQUE INDEX IF NOT EXISTS user_login_aliases_user_id_normalized_email_uidx
  ON public.user_login_aliases (user_id, normalized_email);

CREATE INDEX IF NOT EXISTS user_login_aliases_user_id_idx
  ON public.user_login_aliases (user_id);

ALTER TABLE public.user_login_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'set_updated_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_set_updated_at_user_login_aliases'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_user_login_aliases
      BEFORE UPDATE ON public.user_login_aliases
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_login_aliases'
      AND policyname = 'user_login_aliases_select_own'
  ) THEN
    CREATE POLICY user_login_aliases_select_own
      ON public.user_login_aliases
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_login_aliases'
      AND policyname = 'user_login_aliases_insert_superadmin'
  ) THEN
    CREATE POLICY user_login_aliases_insert_superadmin
      ON public.user_login_aliases
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_login_aliases'
      AND policyname = 'user_login_aliases_update_superadmin'
  ) THEN
    CREATE POLICY user_login_aliases_update_superadmin
      ON public.user_login_aliases
      FOR UPDATE
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_login_aliases'
      AND policyname = 'user_login_aliases_delete_superadmin'
  ) THEN
    CREATE POLICY user_login_aliases_delete_superadmin
      ON public.user_login_aliases
      FOR DELETE
      TO authenticated
      USING (public.is_superadmin());
  END IF;
END $$;
