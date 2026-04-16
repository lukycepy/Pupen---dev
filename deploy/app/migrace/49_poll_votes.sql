CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ip text
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_user_unique
  ON public.poll_votes (poll_id, user_id);

CREATE INDEX IF NOT EXISTS poll_votes_poll_created_at_idx
  ON public.poll_votes (poll_id, created_at DESC);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_votes_member_select_own ON public.poll_votes;
DROP POLICY IF EXISTS poll_votes_admin_select ON public.poll_votes;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='poll_votes' AND policyname='poll_votes_member_select_own') THEN
    CREATE POLICY poll_votes_member_select_own
      ON public.poll_votes
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='poll_votes' AND policyname='poll_votes_admin_select') THEN
    CREATE POLICY poll_votes_admin_select
      ON public.poll_votes
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = true
            AND (p.can_view_polls = true OR p.can_edit_polls = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

