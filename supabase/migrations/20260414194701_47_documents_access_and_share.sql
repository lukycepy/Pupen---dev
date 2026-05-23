DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='member_only'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='is_member_only'
  ) THEN
    ALTER TABLE public.documents RENAME COLUMN member_only TO is_member_only;
  END IF;
END $$;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS title_en text;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Ostatní';

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'member';

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS share_token text;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS documents_share_token_unique
  ON public.documents (share_token)
  WHERE share_token IS NOT NULL;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documents_select_public ON public.documents;
DROP POLICY IF EXISTS documents_select_members ON public.documents;
DROP POLICY IF EXISTS documents_admin_write ON public.documents;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_select_public'
  ) THEN
    CREATE POLICY documents_select_public
      ON public.documents
      FOR SELECT
      TO anon, authenticated
      USING (access_level = 'public');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_select_members'
  ) THEN
    CREATE POLICY documents_select_members
      ON public.documents
      FOR SELECT
      TO authenticated
      USING (
        access_level = 'public'
        OR (
          access_level = 'member'
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_member = true)
        )
        OR (
          access_level = 'admin'
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_admin_write'
  ) THEN
    CREATE POLICY documents_admin_write
      ON public.documents
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_documents = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_documents = true)));
  END IF;
END $$;

