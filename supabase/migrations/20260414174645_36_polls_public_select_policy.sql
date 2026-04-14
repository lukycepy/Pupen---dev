ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

UPDATE public.polls
SET is_active = COALESCE(is_active, active)
WHERE is_active IS DISTINCT FROM COALESCE(is_active, active);

DROP POLICY IF EXISTS polls_select ON public.polls;
DROP POLICY IF EXISTS poll_options_select ON public.poll_options;
DROP POLICY IF EXISTS polls_select_public ON public.polls;
DROP POLICY IF EXISTS poll_options_select_public ON public.poll_options;

CREATE POLICY polls_select_public
  ON public.polls
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND (ends_at IS NULL OR ends_at > now()));

CREATE POLICY poll_options_select_public
  ON public.poll_options
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.polls p
      WHERE p.id = poll_id
        AND p.is_active = true
        AND (p.ends_at IS NULL OR p.ends_at > now())
    )
  );
