CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_email text,
  admin_name text,
  action text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_logs' AND policyname='admin_logs_admin_read'
  ) THEN
    CREATE POLICY admin_logs_admin_read
      ON public.admin_logs
      FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_logs' AND policyname='admin_logs_admin_write'
  ) THEN
    CREATE POLICY admin_logs_admin_write
      ON public.admin_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_settings (
  id int PRIMARY KEY DEFAULT 1,
  smtp_host text,
  smtp_user text,
  smtp_pass text,
  smtp_port int,
  smtp_secure boolean,
  sender_name text,
  sender_email text
);
INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id int PRIMARY KEY DEFAULT 1,
  notification_email text
);
INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_settings' AND policyname='email_settings_admin'
  ) THEN
    CREATE POLICY email_settings_admin ON public.email_settings
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_manage_admins = true))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_manage_admins = true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_settings' AND policyname='payment_settings_admin'
  ) THEN
    CREATE POLICY payment_settings_admin ON public.payment_settings
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_manage_admins = true))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_manage_admins = true));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  title_en text,
  category text,
  date timestamptz NOT NULL,
  end_date timestamptz,
  location text,
  location_en text,
  image_url text,
  description_html text,
  description_html_en text,
  capacity int,
  published_at timestamptz,
  gallery_url text
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_select_public'
  ) THEN
    CREATE POLICY events_select_public
      ON public.events
      FOR SELECT
      TO anon, authenticated
      USING (published_at IS NOT NULL AND published_at <= now());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='events_admin_write'
  ) THEN
    CREATE POLICY events_admin_write
      ON public.events
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_events = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_events = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rsvp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text,
  email text,
  status text NOT NULL DEFAULT 'reserved',
  expires_at timestamptz,
  attendees jsonb,
  promo_code text,
  payment_method text,
  qr_token text,
  checked_in_at timestamptz
);

ALTER TABLE public.rsvp ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rsvp' AND policyname='rsvp_public_insert'
  ) THEN
    CREATE POLICY rsvp_public_insert
      ON public.rsvp
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rsvp' AND policyname='rsvp_admin_read'
  ) THEN
    CREATE POLICY rsvp_admin_read
      ON public.rsvp
      FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  title_en text,
  slug text UNIQUE,
  excerpt text,
  excerpt_en text,
  content_html text,
  content_html_en text,
  image_url text,
  tags text[],
  category text,
  published_at timestamptz
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='posts_select_public'
  ) THEN
    CREATE POLICY posts_select_public
      ON public.posts
      FOR SELECT
      TO anon, authenticated
      USING (published_at IS NOT NULL AND published_at <= now());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='posts_admin_write'
  ) THEN
    CREATE POLICY posts_admin_write
      ON public.posts
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_news = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_news = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  edited_by text
);

ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='content_versions' AND policyname='content_versions_admin'
  ) THEN
    CREATE POLICY content_versions_admin
      ON public.content_versions
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  file_url text,
  file_name text,
  member_only boolean NOT NULL DEFAULT false,
  published_at timestamptz
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_select_public'
  ) THEN
    CREATE POLICY documents_select_public
      ON public.documents
      FOR SELECT
      TO anon, authenticated
      USING (member_only = false);
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
      USING (member_only = false OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_member = true));
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

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text,
  email text,
  phone text,
  faculty text,
  motivation text,
  status text NOT NULL DEFAULT 'pending',
  signature_data_url text,
  decision_reason text
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='applications' AND policyname='applications_public_insert'
  ) THEN
    CREATE POLICY applications_public_insert
      ON public.applications
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='applications' AND policyname='applications_admin_all'
  ) THEN
    CREATE POLICY applications_admin_all
      ON public.applications
      FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_view_apps = true OR p.can_edit_apps = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_apps = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campus_map_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text UNIQUE NOT NULL,
  icon_name text NOT NULL DEFAULT 'MapPin'
);

CREATE TABLE IF NOT EXISTS public.campus_map_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  name_en text,
  building_code text,
  category text,
  description text,
  description_en text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  icon_name text NOT NULL DEFAULT 'MapPin'
);

ALTER TABLE public.campus_map_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_map_points ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campus_map_categories' AND policyname='campus_map_categories_select'
  ) THEN
    CREATE POLICY campus_map_categories_select ON public.campus_map_categories
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campus_map_points' AND policyname='campus_map_points_select'
  ) THEN
    CREATE POLICY campus_map_points_select ON public.campus_map_points
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campus_map_categories' AND policyname='campus_map_categories_admin'
  ) THEN
    CREATE POLICY campus_map_categories_admin ON public.campus_map_categories
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_map = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_map = true)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campus_map_points' AND policyname='campus_map_points_admin'
  ) THEN
    CREATE POLICY campus_map_points_admin ON public.campus_map_points
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_map = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_map = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='faqs' AND policyname='faqs_select_public'
  ) THEN
    CREATE POLICY faqs_select_public ON public.faqs
      FOR SELECT TO anon, authenticated
      USING (is_public = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='faqs' AND policyname='faqs_admin'
  ) THEN
    CREATE POLICY faqs_admin ON public.faqs
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_faq = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_faq = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  url text,
  logo_url text,
  description text,
  tier text,
  is_public boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.sport_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  url text,
  logo_url text,
  description text,
  is_public boolean NOT NULL DEFAULT true
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sport_partners ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partners' AND policyname='partners_select_public') THEN
    CREATE POLICY partners_select_public ON public.partners FOR SELECT TO anon, authenticated USING (is_public = true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='partners' AND policyname='partners_admin') THEN
    CREATE POLICY partners_admin ON public.partners FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_partners = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_partners = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  event_id uuid,
  cover_url text,
  folder text,
  published_at timestamptz
);

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery' AND policyname='gallery_select_public') THEN
    CREATE POLICY gallery_select_public ON public.gallery
      FOR SELECT TO anon, authenticated
      USING (published_at IS NOT NULL AND published_at <= now());
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery' AND policyname='gallery_admin') THEN
    CREATE POLICY gallery_admin ON public.gallery
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_gallery = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_gallery = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subject_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  subject_code text,
  subject_name text,
  rating int,
  difficulty int,
  comment text,
  author_id uuid
);

ALTER TABLE public.subject_reviews ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subject_reviews' AND policyname='subject_reviews_select') THEN
    CREATE POLICY subject_reviews_select ON public.subject_reviews
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  question text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  ends_at timestamptz,
  allow_multiple boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='polls' AND policyname='polls_select') THEN
    CREATE POLICY polls_select ON public.polls FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='poll_options' AND policyname='poll_options_select') THEN
    CREATE POLICY poll_options_select ON public.poll_options FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  participant1_id uuid,
  participant2_id uuid,
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id uuid,
  body text NOT NULL
);

ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dm_threads' AND policyname='dm_threads_auth') THEN
    CREATE POLICY dm_threads_auth ON public.dm_threads
      FOR SELECT TO authenticated
      USING (participant1_id = auth.uid() OR participant2_id = auth.uid());
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dm_messages' AND policyname='dm_messages_auth') THEN
    CREATE POLICY dm_messages_auth ON public.dm_messages
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.dm_threads t WHERE t.id = thread_id AND (t.participant1_id = auth.uid() OR t.participant2_id = auth.uid())));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'expense',
  category text,
  date date NOT NULL DEFAULT (now()::date)
);

CREATE TABLE IF NOT EXISTS public.budget_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  budget_id uuid NOT NULL REFERENCES public.budget(id) ON DELETE CASCADE,
  image_url text,
  ocr_data jsonb
);

ALTER TABLE public.budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_receipts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='budget' AND policyname='budget_admin') THEN
    CREATE POLICY budget_admin ON public.budget
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_view_budget = true OR p.can_edit_budget = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_budget = true)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='budget_receipts' AND policyname='budget_receipts_admin') THEN
    CREATE POLICY budget_receipts_admin ON public.budget_receipts
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_view_budget = true OR p.can_edit_budget = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.can_manage_admins = true OR p.can_edit_budget = true)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  consent boolean NOT NULL DEFAULT true,
  source text
);

CREATE TABLE IF NOT EXISTS public.newsletter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  subject text,
  html text,
  sent_at timestamptz
);

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='newsletter_subscriptions' AND policyname='newsletter_subscriptions_insert') THEN
    CREATE POLICY newsletter_subscriptions_insert ON public.newsletter_subscriptions
      FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

