ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS min_age int,
  ADD COLUMN IF NOT EXISTS max_age int;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_age_range_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_age_range_check
      CHECK (
        (min_age IS NULL OR min_age >= 0)
        AND (max_age IS NULL OR max_age >= 0)
        AND (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  label text NOT NULL,
  label_en text,
  starts_at timestamptz,
  ends_at timestamptz,
  amount_czk numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS event_price_rules_event_sort_idx
  ON public.event_price_rules (event_id, sort_order, starts_at);

ALTER TABLE public.event_price_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='event_price_rules'
      AND policyname='event_price_rules_select_public'
  ) THEN
    CREATE POLICY event_price_rules_select_public
      ON public.event_price_rules
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.events e
          WHERE e.id = event_price_rules.event_id
            AND e.published_at IS NOT NULL
            AND e.published_at <= now()
            AND COALESCE(e.archived_at IS NULL, true)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='event_price_rules'
      AND policyname='event_price_rules_admin_write'
  ) THEN
    CREATE POLICY event_price_rules_admin_write
      ON public.event_price_rules
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_registration_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  label text NOT NULL,
  label_en text,
  placeholder text,
  placeholder_en text,
  helper_text text,
  helper_text_en text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS event_registration_fields_event_key_idx
  ON public.event_registration_fields (event_id, field_key);

CREATE INDEX IF NOT EXISTS event_registration_fields_event_sort_idx
  ON public.event_registration_fields (event_id, sort_order);

ALTER TABLE public.event_registration_fields ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_registration_fields_type_check'
      AND conrelid = 'public.event_registration_fields'::regclass
  ) THEN
    ALTER TABLE public.event_registration_fields
      ADD CONSTRAINT event_registration_fields_type_check
      CHECK (field_type IN ('text', 'textarea', 'checkbox', 'select', 'date'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='event_registration_fields'
      AND policyname='event_registration_fields_select_public'
  ) THEN
    CREATE POLICY event_registration_fields_select_public
      ON public.event_registration_fields
      FOR SELECT
      TO anon, authenticated
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.events e
          WHERE e.id = event_registration_fields.event_id
            AND e.published_at IS NOT NULL
            AND e.published_at <= now()
            AND COALESCE(e.archived_at IS NULL, true)
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='event_registration_fields'
      AND policyname='event_registration_fields_admin_write'
  ) THEN
    CREATE POLICY event_registration_fields_admin_write
      ON public.event_registration_fields
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_events = true)
        )
      );
  END IF;
END $$;

ALTER TABLE public.rsvp
  ADD COLUMN IF NOT EXISTS form_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS price_total numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CZK',
  ADD COLUMN IF NOT EXISTS pricing_label text,
  ADD COLUMN IF NOT EXISTS pricing_label_en text,
  ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES public.event_price_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rsvp_event_price_rule_idx
  ON public.rsvp (event_id, pricing_rule_id);

SELECT public.notify_schema_change();
