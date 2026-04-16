CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_view_analytics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_analytics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_member_portal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_member_portal boolean NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS description_en text;

UPDATE public.events
SET description = COALESCE(description, description_html)
WHERE description IS NULL AND description_html IS NOT NULL;

UPDATE public.events
SET description_en = COALESCE(description_en, description_html_en)
WHERE description_en IS NULL AND description_html_en IS NOT NULL;

ALTER TABLE public.app_roles
  ADD COLUMN IF NOT EXISTS color_hex text NOT NULL DEFAULT '#16a34a';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='app_roles') THEN
    INSERT INTO public.app_roles (name, permissions, color_hex)
    VALUES
      (
        'ČLEN',
        jsonb_build_object(
          'is_member', true,
          'can_view_member_portal', true
        ),
        '#2563eb'
      ),
      (
        'ADMIN',
        jsonb_build_object(
          'is_admin', true,
          'can_manage_admins', true
        ),
        '#16a34a'
      ),
      (
        'SUPERADMIN',
        jsonb_build_object(
          'is_admin', true,
          'is_member', true,
          'can_manage_admins', true,
          'can_view_analytics', true,
          'can_edit_analytics', true,
          'can_view_member_portal', true,
          'can_edit_member_portal', true
        ),
        '#7c3aed'
      )
    ON CONFLICT (name) DO UPDATE
      SET permissions = EXCLUDED.permissions,
          color_hex = EXCLUDED.color_hex,
          updated_at = now();
  END IF;
END $$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;
