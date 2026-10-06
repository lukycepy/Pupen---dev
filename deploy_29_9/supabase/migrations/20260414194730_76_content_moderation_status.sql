-- 76_content_moderation_status.sql

-- 1) student_blog: change is_approved to status
ALTER TABLE public.student_blog ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_blog' AND column_name = 'is_approved'
  ) THEN
    EXECUTE 'UPDATE public.student_blog SET status = ''published'' WHERE is_approved = true';
    EXECUTE 'UPDATE public.student_blog SET status = ''pending'' WHERE is_approved = false';

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'student_blog'
        AND (qual ILIKE '%is_approved%' OR with_check ILIKE '%is_approved%')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.student_blog', pol.policyname);
    END LOOP;

    EXECUTE 'ALTER TABLE public.student_blog DROP COLUMN IF EXISTS is_approved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_blog' AND policyname = 'student_blog_public_select'
  ) THEN
    EXECUTE 'CREATE POLICY student_blog_public_select ON public.student_blog FOR SELECT TO anon, authenticated USING (status = ''published'')';
  END IF;
END $$;

-- 2) subject_reviews: change is_approved to status
ALTER TABLE public.subject_reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subject_reviews' AND column_name = 'is_approved'
  ) THEN
    EXECUTE 'UPDATE public.subject_reviews SET status = ''published'' WHERE is_approved = true';
    EXECUTE 'UPDATE public.subject_reviews SET status = ''pending'' WHERE is_approved = false';

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'subject_reviews'
        AND (qual ILIKE '%is_approved%' OR with_check ILIKE '%is_approved%')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.subject_reviews', pol.policyname);
    END LOOP;

    EXECUTE 'ALTER TABLE public.subject_reviews DROP COLUMN IF EXISTS is_approved';
  END IF;
END $$;

-- 3) posts: add status
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
UPDATE public.posts SET status = 'published' WHERE published_at IS NOT NULL AND published_at <= now();

-- 4) moderation logs
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='moderation_logs' AND policyname='moderation_logs_admin_select') THEN
    CREATE POLICY moderation_logs_admin_select ON public.moderation_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='moderation_logs' AND policyname='moderation_logs_admin_insert') THEN
    CREATE POLICY moderation_logs_admin_insert ON public.moderation_logs
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;
