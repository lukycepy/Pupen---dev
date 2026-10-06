CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_email text,
  author_name text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  moderated_at timestamptz,
  moderated_by text
);

CREATE INDEX IF NOT EXISTS post_comments_post_created_at_idx
  ON public.post_comments (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_comments_status_created_at_idx
  ON public.post_comments (status, created_at DESC);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_comments_select_public ON public.post_comments;
DROP POLICY IF EXISTS post_comments_select_auth ON public.post_comments;
DROP POLICY IF EXISTS post_comments_insert_own ON public.post_comments;
DROP POLICY IF EXISTS post_comments_admin_all ON public.post_comments;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='post_comments_select_public') THEN
    CREATE POLICY post_comments_select_public
      ON public.post_comments
      FOR SELECT
      TO anon, authenticated
      USING (
        status = 'approved'
        AND EXISTS (
          SELECT 1 FROM public.posts p
          WHERE p.id = post_id AND p.published_at IS NOT NULL AND p.published_at <= now()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='post_comments_select_auth') THEN
    CREATE POLICY post_comments_select_auth
      ON public.post_comments
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='post_comments_insert_own') THEN
    CREATE POLICY post_comments_insert_own
      ON public.post_comments
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() AND status = 'pending');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='post_comments_admin_all') THEN
    CREATE POLICY post_comments_admin_all
      ON public.post_comments
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_news = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_news = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'like'
);

CREATE UNIQUE INDEX IF NOT EXISTS post_reactions_post_user_unique
  ON public.post_reactions (post_id, user_id);

CREATE INDEX IF NOT EXISTS post_reactions_post_created_at_idx
  ON public.post_reactions (post_id, created_at DESC);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_reactions_select_own ON public.post_reactions;
DROP POLICY IF EXISTS post_reactions_insert_own ON public.post_reactions;
DROP POLICY IF EXISTS post_reactions_delete_own ON public.post_reactions;
DROP POLICY IF EXISTS post_reactions_admin_all ON public.post_reactions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_reactions' AND policyname='post_reactions_select_own') THEN
    CREATE POLICY post_reactions_select_own
      ON public.post_reactions
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_reactions' AND policyname='post_reactions_insert_own') THEN
    CREATE POLICY post_reactions_insert_own
      ON public.post_reactions
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_reactions' AND policyname='post_reactions_delete_own') THEN
    CREATE POLICY post_reactions_delete_own
      ON public.post_reactions
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_reactions' AND policyname='post_reactions_admin_all') THEN
    CREATE POLICY post_reactions_admin_all
      ON public.post_reactions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_news = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_news = true)
        )
      );
  END IF;
END $$;

