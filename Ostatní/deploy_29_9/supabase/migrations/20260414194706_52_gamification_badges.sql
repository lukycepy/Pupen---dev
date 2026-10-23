-- Gamification badges

CREATE TABLE IF NOT EXISTS public.gamification_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- e.g., 'star', 'award', or a URL
    criteria TEXT,
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.gamification_badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    awarded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE(user_id, badge_id) -- A user can only have a specific badge once
);

-- RLS
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Policies for gamification_badges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gamification_badges' AND policyname='Public read gamification_badges'
  ) THEN
    EXECUTE 'CREATE POLICY \"Public read gamification_badges\" ON public.gamification_badges FOR SELECT USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gamification_badges' AND policyname='Admin all gamification_badges'
  ) THEN
    EXECUTE '
      CREATE POLICY \"Admin all gamification_badges\"
        ON public.gamification_badges
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
          )
        )
    ';
  END IF;
END $$;

-- Policies for user_badges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_badges' AND policyname='Public read user_badges'
  ) THEN
    EXECUTE 'CREATE POLICY \"Public read user_badges\" ON public.user_badges FOR SELECT USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_badges' AND policyname='Admin all user_badges'
  ) THEN
    EXECUTE '
      CREATE POLICY \"Admin all user_badges\"
        ON public.user_badges
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
          )
        )
    ';
  END IF;
END $$;
