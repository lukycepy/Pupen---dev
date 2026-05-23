-- 76_content_moderation_status.sql

-- 1) student_blog: change is_approved to status
ALTER TABLE public.student_blog ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
UPDATE public.student_blog SET status = 'published' WHERE is_approved = true;
UPDATE public.student_blog SET status = 'pending' WHERE is_approved = false;
ALTER TABLE public.student_blog DROP COLUMN IF EXISTS is_approved;

-- 2) subject_reviews: change is_approved to status
ALTER TABLE public.subject_reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
UPDATE public.subject_reviews SET status = 'published' WHERE is_approved = true;
UPDATE public.subject_reviews SET status = 'pending' WHERE is_approved = false;
ALTER TABLE public.subject_reviews DROP COLUMN IF EXISTS is_approved;

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
      USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='moderation_logs' AND policyname='moderation_logs_admin_insert') THEN
    CREATE POLICY moderation_logs_admin_insert ON public.moderation_logs
      FOR INSERT TO authenticated
      WITH CHECK (is_admin());
  END IF;
END $$;
