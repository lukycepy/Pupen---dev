CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.security_bans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  kind text NOT NULL,
  ip cidr,
  identity_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_from_ip inet,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_from_ip inet,
  CONSTRAINT security_bans_kind_check CHECK (kind IN ('ip', 'identity')),
  CONSTRAINT security_bans_target_check CHECK (
    (kind = 'ip' AND ip IS NOT NULL AND identity_id IS NULL)
    OR
    (kind = 'identity' AND identity_id IS NOT NULL AND ip IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS security_bans_active_idx
  ON public.security_bans (active, expires_at, revoked_at, created_at DESC);

CREATE INDEX IF NOT EXISTS security_bans_identity_active_idx
  ON public.security_bans (identity_id)
  WHERE kind = 'identity' AND active = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS security_bans_ip_active_idx
  ON public.security_bans (ip)
  WHERE kind = 'ip' AND active = true AND revoked_at IS NULL;

ALTER TABLE public.security_bans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_bans' AND policyname = 'security_bans_superadmin_select'
  ) THEN
    CREATE POLICY security_bans_superadmin_select
      ON public.security_bans
      FOR SELECT
      TO authenticated
      USING (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_bans' AND policyname = 'security_bans_superadmin_insert'
  ) THEN
    CREATE POLICY security_bans_superadmin_insert
      ON public.security_bans
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_bans' AND policyname = 'security_bans_superadmin_update'
  ) THEN
    CREATE POLICY security_bans_superadmin_update
      ON public.security_bans
      FOR UPDATE
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_bans' AND policyname = 'security_bans_superadmin_delete'
  ) THEN
    CREATE POLICY security_bans_superadmin_delete
      ON public.security_bans
      FOR DELETE
      TO authenticated
      USING (public.is_superadmin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.security_is_banned(
  ip_text text DEFAULT NULL,
  identity_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  ip_in inet;
BEGIN
  IF ip_text IS NOT NULL AND btrim(ip_text) <> '' AND ip_text <> 'unknown' THEN
    BEGIN
      ip_in := inet(ip_text);
    EXCEPTION WHEN others THEN
      ip_in := NULL;
    END;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.security_bans b
    WHERE b.active = true
      AND b.revoked_at IS NULL
      AND (b.expires_at IS NULL OR b.expires_at > now())
      AND (
        (identity_id IS NOT NULL AND b.kind = 'identity' AND b.identity_id = identity_id)
        OR
        (ip_in IS NOT NULL AND b.kind = 'ip' AND b.ip IS NOT NULL AND ip_in <<= b.ip)
      )
    LIMIT 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.security_is_banned(text, uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.security_is_banned(text, uuid) TO service_role;
  END IF;
END $$;
