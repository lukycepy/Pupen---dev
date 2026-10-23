CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  original_name text,
  mime text,
  size_bytes bigint,
  uploaded_by uuid
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_documents_member_kind_unique'
  ) THEN
    ALTER TABLE public.member_documents
      ADD CONSTRAINT member_documents_member_kind_unique UNIQUE (member_id, kind);
  END IF;
END $$;

ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_documents' AND policyname='member_documents_superadmin_all'
  ) THEN
    CREATE POLICY member_documents_superadmin_all
      ON public.member_documents
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.can_manage_admins = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.can_manage_admins = true
        )
      );
  END IF;
END $$;

