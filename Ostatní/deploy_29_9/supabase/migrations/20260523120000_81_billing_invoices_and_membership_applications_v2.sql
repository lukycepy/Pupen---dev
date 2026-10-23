CREATE TABLE IF NOT EXISTS public.invoice_number_counters (
  series text NOT NULL,
  year int NOT NULL,
  next_no bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (series, year)
);

ALTER TABLE public.invoice_number_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_number_counters' AND policyname='invoice_number_counters_admin_all'
  ) THEN
    CREATE POLICY invoice_number_counters_admin_all
      ON public.invoice_number_counters
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'manual',
  provider_tx_id text,
  booked_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CZK',
  account_iban text,
  counterparty_iban text,
  counterparty_name text,
  vs text,
  ks text,
  ss text,
  message text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_provider_tx_unique
  ON public.bank_transactions (provider, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bank_transactions_booked_at_idx
  ON public.bank_transactions (booked_at DESC);

CREATE INDEX IF NOT EXISTS bank_transactions_vs_idx
  ON public.bank_transactions (vs);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_transactions' AND policyname='bank_transactions_admin_all'
  ) THEN
    CREATE POLICY bank_transactions_admin_all
      ON public.bank_transactions
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  number_series text NOT NULL DEFAULT 'INV',
  number_year int NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  number bigint,
  issued_at timestamptz,
  due_at date,
  paid_at timestamptz,
  currency text NOT NULL DEFAULT 'CZK',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  vs text,
  note text,
  billing_name text,
  billing_address text,
  billing_ico text,
  billing_dic text
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_unique
  ON public.invoices (number_series, number_year, number)
  WHERE number IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoices_member_issued_at_idx
  ON public.invoices (member_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS invoices_status_idx
  ON public.invoices (status);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='invoices_admin_all'
  ) THEN
    CREATE POLICY invoices_admin_all
      ON public.invoices
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='invoices_member_select'
  ) THEN
    CREATE POLICY invoices_member_select
      ON public.invoices
      FOR SELECT
      TO authenticated
      USING (member_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_sort_idx
  ON public.invoice_items (invoice_id, sort_order);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_items' AND policyname='invoice_items_admin_all'
  ) THEN
    CREATE POLICY invoice_items_admin_all
      ON public.invoice_items
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_items' AND policyname='invoice_items_member_select'
  ) THEN
    CREATE POLICY invoice_items_member_select
      ON public.invoice_items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.invoices i
          WHERE i.id = invoice_id
            AND i.member_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  method text NOT NULL DEFAULT 'bank',
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_bank_transaction_unique
  ON public.invoice_payments (bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_paid_at_idx
  ON public.invoice_payments (invoice_id, paid_at DESC);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_payments' AND policyname='invoice_payments_admin_all'
  ) THEN
    CREATE POLICY invoice_payments_admin_all
      ON public.invoice_payments
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_payments' AND policyname='invoice_payments_member_select'
  ) THEN
    CREATE POLICY invoice_payments_member_select
      ON public.invoice_payments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.invoices i
          WHERE i.id = invoice_id
            AND i.member_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.membership_applications_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  faculty text,
  address text,
  motivation text,
  status text NOT NULL DEFAULT 'pending',
  signature_data_url text,
  decision_reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS membership_applications_v2_created_at_idx
  ON public.membership_applications_v2 (created_at DESC);

CREATE INDEX IF NOT EXISTS membership_applications_v2_status_idx
  ON public.membership_applications_v2 (status);

CREATE INDEX IF NOT EXISTS membership_applications_v2_email_idx
  ON public.membership_applications_v2 (email);

ALTER TABLE public.membership_applications_v2 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_applications_v2' AND policyname='membership_applications_v2_public_insert'
  ) THEN
    CREATE POLICY membership_applications_v2_public_insert
      ON public.membership_applications_v2
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_applications_v2' AND policyname='membership_applications_v2_own_select'
  ) THEN
    CREATE POLICY membership_applications_v2_own_select
      ON public.membership_applications_v2
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_applications_v2' AND policyname='membership_applications_v2_admin_all'
  ) THEN
    CREATE POLICY membership_applications_v2_admin_all
      ON public.membership_applications_v2
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_view_apps = true OR p.can_edit_apps = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_apps = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.membership_application_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  application_id uuid NOT NULL REFERENCES public.membership_applications_v2(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'member_applications',
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS membership_application_files_path_unique
  ON public.membership_application_files (storage_bucket, storage_path);

CREATE INDEX IF NOT EXISTS membership_application_files_application_created_at_idx
  ON public.membership_application_files (application_id, created_at DESC);

ALTER TABLE public.membership_application_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_application_files' AND policyname='membership_application_files_owner_select'
  ) THEN
    CREATE POLICY membership_application_files_owner_select
      ON public.membership_application_files
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.membership_applications_v2 a
          WHERE a.id = application_id
            AND a.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_application_files' AND policyname='membership_application_files_owner_insert'
  ) THEN
    CREATE POLICY membership_application_files_owner_insert
      ON public.membership_application_files
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.membership_applications_v2 a
          WHERE a.id = application_id
            AND a.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='membership_application_files' AND policyname='membership_application_files_admin_all'
  ) THEN
    CREATE POLICY membership_application_files_admin_all
      ON public.membership_application_files
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_view_apps = true OR p.can_edit_apps = true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.can_manage_admins = true OR p.can_edit_apps = true)
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_trigger_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  trigger_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS email_trigger_settings_trigger_key_unique
  ON public.email_trigger_settings (trigger_key);

ALTER TABLE public.email_trigger_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_trigger_settings' AND policyname='email_trigger_settings_admin_all'
  ) THEN
    CREATE POLICY email_trigger_settings_admin_all
      ON public.email_trigger_settings
      FOR ALL
      TO authenticated
      USING (public.is_superadmin())
      WITH CHECK (public.is_superadmin());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx
  ON public.audit_logs (actor_user_id);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON public.audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='audit_logs_admin_select'
  ) THEN
    CREATE POLICY audit_logs_admin_select
      ON public.audit_logs
      FOR SELECT
      TO authenticated
      USING (public.is_superadmin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_invoice_number(p_series text DEFAULT 'INV', p_year int DEFAULT EXTRACT(year FROM now())::int)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v bigint;
BEGIN
  INSERT INTO public.invoice_number_counters (series, year, next_no)
  VALUES (p_series, p_year, 2)
  ON CONFLICT (series, year)
  DO UPDATE SET next_no = public.invoice_number_counters.next_no + 1
  RETURNING next_no - 1 INTO v;

  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_invoice_number(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_invoice_number(text, int) TO service_role;

CREATE OR REPLACE FUNCTION public.assign_invoice_number(p_invoice_id uuid)
RETURNS TABLE (
  invoice_id uuid,
  number_series text,
  number_year int,
  number bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_series text;
  v_year int;
  v_number bigint;
BEGIN
  SELECT i.number_series, i.number_year
  INTO v_series, v_year
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice not found: %', p_invoice_id;
  END IF;

  SELECT i.number
  INTO v_number
  FROM public.invoices i
  WHERE i.id = p_invoice_id;

  IF v_number IS NOT NULL THEN
    RETURN QUERY
    SELECT i.id, i.number_series, i.number_year, i.number
    FROM public.invoices i
    WHERE i.id = p_invoice_id;
    RETURN;
  END IF;

  v_number := public.reserve_invoice_number(v_series, v_year);

  UPDATE public.invoices i
  SET
    number = v_number,
    issued_at = COALESCE(i.issued_at, now()),
    status = CASE WHEN i.status = 'draft' THEN 'issued' ELSE i.status END,
    updated_at = now()
  WHERE i.id = p_invoice_id
    AND i.number IS NULL;

  RETURN QUERY
  SELECT i.id, i.number_series, i.number_year, i.number
  FROM public.invoices i
  WHERE i.id = p_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_invoice_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_invoice_number(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pair_bank_transaction_to_invoice(p_bank_transaction_id uuid, p_invoice_id uuid, p_amount numeric DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_tx_amount numeric(12,2);
  v_tx_currency text;
  v_tx_paid_at timestamptz;
  v_payment_amount numeric(12,2);
  v_payment_id uuid;
  v_invoice_total numeric(12,2);
  v_paid numeric(12,2);
BEGIN
  PERFORM 1
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice not found: %', p_invoice_id;
  END IF;

  SELECT t.amount, t.currency, t.booked_at
  INTO v_tx_amount, v_tx_currency, v_tx_paid_at
  FROM public.bank_transactions t
  WHERE t.id = p_bank_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bank transaction not found: %', p_bank_transaction_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.invoice_payments p
    WHERE p.bank_transaction_id = p_bank_transaction_id
  ) THEN
    RAISE EXCEPTION 'bank transaction already paired: %', p_bank_transaction_id;
  END IF;

  v_payment_amount := ABS(COALESCE(p_amount, v_tx_amount));

  INSERT INTO public.invoice_payments (
    invoice_id,
    paid_at,
    amount,
    currency,
    method,
    bank_transaction_id
  )
  VALUES (
    p_invoice_id,
    COALESCE(v_tx_paid_at, now()),
    v_payment_amount,
    v_tx_currency,
    'bank',
    p_bank_transaction_id
  )
  RETURNING id INTO v_payment_id;

  SELECT i.total
  INTO v_invoice_total
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_paid
  FROM public.invoice_payments p
  WHERE p.invoice_id = p_invoice_id;

  UPDATE public.invoices i
  SET
    updated_at = now(),
    paid_at = CASE
      WHEN v_invoice_total > 0 AND v_paid >= v_invoice_total THEN COALESCE(i.paid_at, now())
      ELSE i.paid_at
    END,
    status = CASE
      WHEN v_invoice_total > 0 AND v_paid >= v_invoice_total THEN 'paid'
      ELSE i.status
    END
  WHERE i.id = p_invoice_id;

  RETURN v_payment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pair_bank_transaction_to_invoice(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_bank_transaction_to_invoice(uuid, uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.unpair_bank_transaction_from_invoice(p_bank_transaction_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_total numeric(12,2);
  v_paid numeric(12,2);
BEGIN
  DELETE FROM public.invoice_payments p
  WHERE p.bank_transaction_id = p_bank_transaction_id
  RETURNING p.invoice_id INTO v_invoice_id;

  IF v_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT i.total
  INTO v_invoice_total
  FROM public.invoices i
  WHERE i.id = v_invoice_id
  FOR UPDATE;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_paid
  FROM public.invoice_payments p
  WHERE p.invoice_id = v_invoice_id;

  UPDATE public.invoices i
  SET
    updated_at = now(),
    paid_at = CASE
      WHEN v_invoice_total > 0 AND v_paid < v_invoice_total THEN NULL
      ELSE i.paid_at
    END,
    status = CASE
      WHEN v_invoice_total > 0 AND v_paid < v_invoice_total AND i.status = 'paid' THEN 'issued'
      ELSE i.status
    END
  WHERE i.id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unpair_bank_transaction_from_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unpair_bank_transaction_from_invoice(uuid) TO service_role;
