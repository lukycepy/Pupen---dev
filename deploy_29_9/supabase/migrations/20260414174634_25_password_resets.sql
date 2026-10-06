CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.password_resets (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text
);

CREATE INDEX IF NOT EXISTS password_resets_expires_at_idx ON public.password_resets (expires_at);

ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'password_resets'
      AND policyname = 'password_resets_deny_all'
  ) THEN
    CREATE POLICY password_resets_deny_all
      ON public.password_resets
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

