CREATE TABLE IF NOT EXISTS public.site_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  page_slug text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.app_roles(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT site_page_permissions_target_chk CHECK ((user_id IS NULL) <> (role_id IS NULL)),
  CONSTRAINT site_page_permissions_edit_implies_view_chk CHECK ((can_edit = false) OR (can_view = true))
);

CREATE INDEX IF NOT EXISTS site_page_permissions_page_slug_idx ON public.site_page_permissions(page_slug);
CREATE INDEX IF NOT EXISTS site_page_permissions_user_id_idx ON public.site_page_permissions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_page_permissions_role_id_idx ON public.site_page_permissions(role_id) WHERE role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS site_page_permissions_unique_user_slug
  ON public.site_page_permissions(page_slug, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS site_page_permissions_unique_role_slug
  ON public.site_page_permissions(page_slug, role_id)
  WHERE role_id IS NOT NULL;

ALTER TABLE public.site_page_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_page_permissions' AND policyname='site_page_permissions_superadmin_all'
  ) THEN
    CREATE POLICY site_page_permissions_superadmin_all
      ON public.site_page_permissions
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_view_site_page(page_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    public.is_superadmin()
    OR COALESCE((SELECT p.can_view_site_pages = true OR p.can_edit_site_pages = true FROM public.profiles p WHERE p.id = auth.uid()), false)
    OR EXISTS (
      SELECT 1
      FROM public.site_page_permissions spp
      WHERE spp.page_slug = page_slug
        AND (
          (spp.user_id = auth.uid() AND spp.can_view = true)
          OR (
            spp.role_id IS NOT NULL
            AND spp.can_view = true
            AND EXISTS (
              SELECT 1
              FROM public.app_user_roles ur
              WHERE ur.user_id = auth.uid()
                AND ur.role_id = spp.role_id
            )
          )
        )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_site_page(page_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    public.is_superadmin()
    OR COALESCE((SELECT p.can_edit_site_pages = true FROM public.profiles p WHERE p.id = auth.uid()), false)
    OR EXISTS (
      SELECT 1
      FROM public.site_page_permissions spp
      WHERE spp.page_slug = page_slug
        AND (
          (spp.user_id = auth.uid() AND spp.can_edit = true)
          OR (
            spp.role_id IS NOT NULL
            AND spp.can_edit = true
            AND EXISTS (
              SELECT 1
              FROM public.app_user_roles ur
              WHERE ur.user_id = auth.uid()
                AND ur.role_id = spp.role_id
            )
          )
        )
    ),
    false
  );
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_page_contents' AND policyname='site_page_contents_superadmin_write'
  ) THEN
    DROP POLICY site_page_contents_superadmin_write ON public.site_page_contents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_page_contents' AND policyname='site_page_contents_rbac_write'
  ) THEN
    CREATE POLICY site_page_contents_rbac_write
      ON public.site_page_contents
      FOR ALL
      TO authenticated
      USING (public.can_edit_site_page(slug))
      WITH CHECK (public.can_edit_site_page(slug));
  END IF;
END $$;

