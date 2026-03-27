CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (
      SELECT (p.can_manage_admins = true)
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_superadmin());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_superadmin())
  WITH CHECK (id = auth.uid() OR public.is_superadmin());

ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{all}'::text[];

UPDATE public.newsletter_subscriptions
SET categories = '{all}'::text[]
WHERE categories IS NULL;

CREATE TABLE IF NOT EXISTS public.opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  place_name text NOT NULL,
  place_name_en text,
  hours_mon_fri text,
  hours_sat_sun text,
  note text,
  note_en text
);

ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='opening_hours' AND policyname='opening_hours_public_select') THEN
    CREATE POLICY opening_hours_public_select ON public.opening_hours
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='opening_hours' AND policyname='opening_hours_admin_all') THEN
    CREATE POLICY opening_hours_admin_all ON public.opening_hours
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_hours = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_hours = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.academic_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  title_en text,
  category text NOT NULL DEFAULT 'other',
  start_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.academic_schedule ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='academic_schedule' AND policyname='academic_schedule_public_select_active') THEN
    CREATE POLICY academic_schedule_public_select_active ON public.academic_schedule
      FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='academic_schedule' AND policyname='academic_schedule_admin_all') THEN
    CREATE POLICY academic_schedule_admin_all ON public.academic_schedule
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_schedule = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_schedule = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  name_en text,
  description text,
  description_en text,
  quantity int NOT NULL DEFAULT 1,
  location text,
  location_en text
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assets' AND policyname='assets_admin_all') THEN
    CREATE POLICY assets_admin_all ON public.assets
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_assets = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_assets = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.isic_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  discount text,
  category text,
  location_name text
);

ALTER TABLE public.isic_discounts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='isic_discounts' AND policyname='isic_discounts_public_select') THEN
    CREATE POLICY isic_discounts_public_select ON public.isic_discounts
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='isic_discounts' AND policyname='isic_discounts_admin_all') THEN
    CREATE POLICY isic_discounts_admin_all ON public.isic_discounts
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_discounts = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_discounts = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.book_exchange (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  author text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  contact text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  is_sold boolean NOT NULL DEFAULT false
);

ALTER TABLE public.book_exchange ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='book_exchange' AND policyname='book_exchange_public_select_active') THEN
    CREATE POLICY book_exchange_public_select_active ON public.book_exchange
      FOR SELECT TO anon, authenticated
      USING (status = 'active' AND is_sold = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='book_exchange' AND policyname='book_exchange_public_insert') THEN
    CREATE POLICY book_exchange_public_insert ON public.book_exchange
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='book_exchange' AND policyname='book_exchange_admin_all') THEN
    CREATE POLICY book_exchange_admin_all ON public.book_exchange
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_books = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_books = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_public_insert') THEN
    CREATE POLICY messages_public_insert ON public.messages
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_admin_select') THEN
    CREATE POLICY messages_admin_select ON public.messages
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_view_messages = true OR p.can_edit_messages = true OR p.can_manage_admins = true)
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_admin_update') THEN
    CREATE POLICY messages_admin_update ON public.messages
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_messages = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_messages = true OR p.can_manage_admins = true)
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='messages_admin_delete') THEN
    CREATE POLICY messages_admin_delete ON public.messages
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_messages = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  date timestamptz,
  location text,
  minutes text
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings' AND policyname='meetings_admin_all') THEN
    CREATE POLICY meetings_admin_all ON public.meetings
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_meetings = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_meetings = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  is_published boolean NOT NULL DEFAULT false,
  published_version_id uuid
);

CREATE TABLE IF NOT EXISTS public.governance_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  policy_id uuid NOT NULL REFERENCES public.governance_policies(id) ON DELETE CASCADE,
  version_number int NOT NULL DEFAULT 1,
  content_html text NOT NULL DEFAULT ''
);

ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_policy_versions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='governance_policies' AND policyname='gov_policies_public_select') THEN
    CREATE POLICY gov_policies_public_select ON public.governance_policies
      FOR SELECT TO anon, authenticated
      USING (is_published = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='governance_policy_versions' AND policyname='gov_versions_public_select') THEN
    CREATE POLICY gov_versions_public_select ON public.governance_policy_versions
      FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.governance_policies p
          WHERE p.id = governance_policy_versions.policy_id AND p.is_published = true
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='governance_policies' AND policyname='gov_admin_all') THEN
    CREATE POLICY gov_admin_all ON public.governance_policies
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true)
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='governance_policy_versions' AND policyname='gov_versions_admin_all') THEN
    CREATE POLICY gov_versions_admin_all ON public.governance_policy_versions
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true)
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  summary_html text,
  status text NOT NULL DEFAULT 'draft',
  decided_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL
);

ALTER TABLE public.governance_decisions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='governance_decisions' AND policyname='gov_decisions_public_select') THEN
    CREATE POLICY gov_decisions_public_select ON public.governance_decisions
      FOR SELECT TO anon, authenticated
      USING (is_published = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='governance_decisions' AND policyname='gov_decisions_admin_all') THEN
    CREATE POLICY gov_decisions_admin_all ON public.governance_decisions
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true)
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true AND p.can_manage_admins = true)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.student_blog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  author_name text,
  author_email text,
  views int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT false
);

ALTER TABLE public.student_blog ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_blog' AND policyname='student_blog_public_select') THEN
    CREATE POLICY student_blog_public_select ON public.student_blog
      FOR SELECT TO anon, authenticated
      USING (is_approved = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_blog' AND policyname='student_blog_public_insert') THEN
    CREATE POLICY student_blog_public_insert ON public.student_blog
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_blog' AND policyname='student_blog_admin_all') THEN
    CREATE POLICY student_blog_admin_all ON public.student_blog
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_blog_mod = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_blog_mod = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quizzes' AND policyname='quizzes_admin_all') THEN
    CREATE POLICY quizzes_admin_all ON public.quizzes
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_quizzes = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_quizzes = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.scavenger_hunts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  title_en text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT false,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.scavenger_hunts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scavenger_hunts' AND policyname='hunts_public_select_active') THEN
    CREATE POLICY hunts_public_select_active ON public.scavenger_hunts
      FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scavenger_hunts' AND policyname='hunts_admin_all') THEN
    CREATE POLICY hunts_admin_all ON public.scavenger_hunts
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_hunts = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_hunts = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rating int NOT NULL DEFAULT 5,
  comment text
);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_feedback' AND policyname='event_feedback_public_insert') THEN
    CREATE POLICY event_feedback_public_insert ON public.event_feedback
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_feedback' AND policyname='event_feedback_admin_all') THEN
    CREATE POLICY event_feedback_admin_all ON public.event_feedback
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_feedback = true OR p.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_admin = true AND (p.can_edit_feedback = true OR p.can_manage_admins = true)
        )
      );
  END IF;
END $$;
