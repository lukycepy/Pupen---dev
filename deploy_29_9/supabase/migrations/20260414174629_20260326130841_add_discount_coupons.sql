CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_amount numeric,
  discount_percentage numeric,
  max_uses integer,
  current_uses integer DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.discount_coupons
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric,
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS current_uses integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='discount_coupons' AND indexname='discount_coupons_code_unique'
  ) THEN
    CREATE UNIQUE INDEX discount_coupons_code_unique ON public.discount_coupons (code);
  END IF;
END $$;

ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discount_coupons' AND policyname='Admins can manage discount coupons'
  ) THEN
    CREATE POLICY "Admins can manage discount coupons"
      ON public.discount_coupons
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.can_manage_admins = true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discount_coupons' AND policyname='Anyone can view active discount coupons'
  ) THEN
    CREATE POLICY "Anyone can view active discount coupons"
      ON public.discount_coupons
      FOR SELECT
      USING (is_active = true);
  END IF;
END $$;
