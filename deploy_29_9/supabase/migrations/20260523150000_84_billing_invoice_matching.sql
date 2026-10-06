ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS vs text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS billing_invoices_vs_idx ON public.billing_invoices (vs);
CREATE INDEX IF NOT EXISTS billing_invoices_status_idx ON public.billing_invoices (status);
CREATE INDEX IF NOT EXISTS billing_invoices_due_date_idx ON public.billing_invoices (due_date);

CREATE TABLE IF NOT EXISTS public.billing_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  method text NOT NULL DEFAULT 'bank',
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoice_payments_bank_transaction_unique
  ON public.billing_invoice_payments (bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_invoice_payments_invoice_paid_at_idx
  ON public.billing_invoice_payments (invoice_id, paid_at DESC);

ALTER TABLE public.billing_invoice_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_invoice_payments' AND policyname='billing_invoice_payments_admin'
  ) THEN
    CREATE POLICY billing_invoice_payments_admin ON public.billing_invoice_payments
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.billing_invoice_create(p_invoice jsonb, p_items jsonb)
RETURNS public.billing_invoices
LANGUAGE plpgsql
AS $$
DECLARE
  inv public.billing_invoices;
  i jsonb;
  pos int;
  qty numeric;
  unit_price numeric;
  line_total numeric;
BEGIN
  INSERT INTO public.billing_invoices (
    type,
    status,
    currency,
    buyer_name,
    buyer_address,
    buyer_email,
    ico,
    dic,
    note,
    issue_date,
    due_date,
    vs,
    source_deposit_invoice_id,
    credited_invoice_id
  )
  VALUES (
    COALESCE(NULLIF(p_invoice->>'type', ''), 'invoice'),
    'draft',
    COALESCE(NULLIF(p_invoice->>'currency', ''), 'CZK'),
    NULLIF(p_invoice->>'buyer_name', ''),
    NULLIF(p_invoice->>'buyer_address', ''),
    NULLIF(p_invoice->>'buyer_email', ''),
    NULLIF(p_invoice->>'ico', ''),
    NULLIF(p_invoice->>'dic', ''),
    NULLIF(p_invoice->>'note', ''),
    NULLIF(p_invoice->>'issue_date', '')::date,
    NULLIF(p_invoice->>'due_date', '')::date,
    NULLIF(p_invoice->>'vs', ''),
    NULLIF(p_invoice->>'source_deposit_invoice_id', '')::uuid,
    NULLIF(p_invoice->>'credited_invoice_id', '')::uuid
  )
  RETURNING * INTO inv;

  pos := 0;
  FOR i IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    pos := pos + 1;
    qty := COALESCE((i->>'quantity')::numeric, 0);
    unit_price := COALESCE((i->>'unit_price')::numeric, 0);
    line_total := qty * unit_price;

    INSERT INTO public.billing_invoice_items (invoice_id, position, title, quantity, unit_price, total)
    VALUES (inv.id, COALESCE((i->>'position')::int, pos), COALESCE(NULLIF(i->>'title', ''), 'Položka'), qty, unit_price, line_total);
  END LOOP;

  UPDATE public.billing_invoices bi
  SET total = COALESCE((SELECT sum(total) FROM public.billing_invoice_items bii WHERE bii.invoice_id = inv.id), 0)
  WHERE bi.id = inv.id
  RETURNING * INTO inv;

  RETURN inv;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_invoice_update(p_invoice_id uuid, p_invoice jsonb, p_items jsonb)
RETURNS public.billing_invoices
LANGUAGE plpgsql
AS $$
DECLARE
  inv public.billing_invoices;
  i jsonb;
  pos int;
  qty numeric;
  unit_price numeric;
  line_total numeric;
BEGIN
  SELECT * INTO inv FROM public.billing_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  IF inv.status <> 'draft' THEN
    RAISE EXCEPTION 'Invoice is not editable';
  END IF;

  UPDATE public.billing_invoices
  SET
    type = COALESCE(NULLIF(p_invoice->>'type', ''), type),
    currency = COALESCE(NULLIF(p_invoice->>'currency', ''), currency),
    buyer_name = COALESCE(NULLIF(p_invoice->>'buyer_name', ''), buyer_name),
    buyer_address = COALESCE(NULLIF(p_invoice->>'buyer_address', ''), buyer_address),
    buyer_email = COALESCE(NULLIF(p_invoice->>'buyer_email', ''), buyer_email),
    ico = COALESCE(NULLIF(p_invoice->>'ico', ''), ico),
    dic = COALESCE(NULLIF(p_invoice->>'dic', ''), dic),
    note = COALESCE(NULLIF(p_invoice->>'note', ''), note),
    issue_date = COALESCE(NULLIF(p_invoice->>'issue_date', '')::date, issue_date),
    due_date = COALESCE(NULLIF(p_invoice->>'due_date', '')::date, due_date),
    vs = COALESCE(NULLIF(p_invoice->>'vs', ''), vs),
    source_deposit_invoice_id = COALESCE(NULLIF(p_invoice->>'source_deposit_invoice_id', '')::uuid, source_deposit_invoice_id),
    credited_invoice_id = COALESCE(NULLIF(p_invoice->>'credited_invoice_id', '')::uuid, credited_invoice_id)
  WHERE id = p_invoice_id
  RETURNING * INTO inv;

  DELETE FROM public.billing_invoice_items WHERE invoice_id = p_invoice_id;

  pos := 0;
  FOR i IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    pos := pos + 1;
    qty := COALESCE((i->>'quantity')::numeric, 0);
    unit_price := COALESCE((i->>'unit_price')::numeric, 0);
    line_total := qty * unit_price;

    INSERT INTO public.billing_invoice_items (invoice_id, position, title, quantity, unit_price, total)
    VALUES (inv.id, COALESCE((i->>'position')::int, pos), COALESCE(NULLIF(i->>'title', ''), 'Položka'), qty, unit_price, line_total);
  END LOOP;

  UPDATE public.billing_invoices bi
  SET total = COALESCE((SELECT sum(total) FROM public.billing_invoice_items bii WHERE bii.invoice_id = inv.id), 0)
  WHERE bi.id = inv.id
  RETURNING * INTO inv;

  RETURN inv;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_issue_invoice(p_invoice_id uuid)
RETURNS public.billing_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.billing_invoices;
  num text;
  v_vs text;
BEGIN
  SELECT * INTO inv FROM public.billing_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  IF inv.status <> 'draft' THEN
    RAISE EXCEPTION 'Invalid status transition';
  END IF;

  IF inv.number IS NULL OR inv.number = '' THEN
    num := public.billing_next_invoice_number(inv.type);
  ELSE
    num := inv.number;
  END IF;

  v_vs := CASE
    WHEN inv.vs IS NULL OR inv.vs = '' THEN regexp_replace(num, '\D', '', 'g')
    ELSE inv.vs
  END;

  UPDATE public.billing_invoices bi
  SET
    number = num,
    status = 'issued',
    issue_date = COALESCE(issue_date, now()::date),
    vs = v_vs,
    total = COALESCE((SELECT sum(total) FROM public.billing_invoice_items bii WHERE bii.invoice_id = bi.id), 0)
  WHERE bi.id = inv.id
  RETURNING * INTO inv;

  RETURN inv;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_issue_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_issue_invoice(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pair_bank_transaction_to_billing_invoice(p_bank_transaction_id uuid, p_invoice_id uuid, p_amount numeric DEFAULT NULL)
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
  v_status text;
BEGIN
  SELECT i.status
  INTO v_status
  FROM public.billing_invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice not found: %', p_invoice_id;
  END IF;

  IF v_status IN ('cancelled','credited') THEN
    RAISE EXCEPTION 'invoice is not payable: %', p_invoice_id;
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
    FROM public.billing_invoice_payments p
    WHERE p.bank_transaction_id = p_bank_transaction_id
  ) THEN
    RAISE EXCEPTION 'bank transaction already paired: %', p_bank_transaction_id;
  END IF;

  v_payment_amount := ABS(COALESCE(p_amount, v_tx_amount));

  INSERT INTO public.billing_invoice_payments (
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
  FROM public.billing_invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_paid
  FROM public.billing_invoice_payments p
  WHERE p.invoice_id = p_invoice_id;

  UPDATE public.billing_invoices i
  SET
    updated_at = now(),
    paid_amount = v_paid,
    paid_at = CASE
      WHEN v_invoice_total > 0 AND v_paid >= v_invoice_total THEN COALESCE(i.paid_at, now())
      ELSE i.paid_at
    END,
    status = CASE
      WHEN v_invoice_total > 0 AND v_paid >= v_invoice_total THEN 'paid'
      WHEN v_invoice_total > 0 AND v_paid > 0 AND v_paid < v_invoice_total AND i.status IN ('issued','sent','partially_paid') THEN 'partially_paid'
      ELSE i.status
    END
  WHERE i.id = p_invoice_id;

  RETURN v_payment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pair_bank_transaction_to_billing_invoice(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_bank_transaction_to_billing_invoice(uuid, uuid, numeric) TO service_role;
