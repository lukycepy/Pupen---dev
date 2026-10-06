CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  number text UNIQUE,
  type text NOT NULL DEFAULT 'invoice',
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'CZK',
  buyer_name text,
  buyer_address text,
  buyer_email text,
  ico text,
  dic text,
  note text,
  issue_date date,
  due_date date,
  total numeric NOT NULL DEFAULT 0,
  source_deposit_invoice_id uuid REFERENCES public.billing_invoices(id),
  credited_invoice_id uuid REFERENCES public.billing_invoices(id)
);

CREATE TABLE IF NOT EXISTS public.billing_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  position int NOT NULL,
  title text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total numeric NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='billing_invoice_items' AND indexname='billing_invoice_items_invoice_id_position_key'
  ) THEN
    CREATE UNIQUE INDEX billing_invoice_items_invoice_id_position_key ON public.billing_invoice_items (invoice_id, position);
  END IF;
END $$;

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_invoices' AND policyname='billing_invoices_admin'
  ) THEN
    CREATE POLICY billing_invoices_admin ON public.billing_invoices
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_invoice_items' AND policyname='billing_invoice_items_admin'
  ) THEN
    CREATE POLICY billing_invoice_items_admin ON public.billing_invoice_items
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.billing_invoices') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_billing_invoices') THEN
    CREATE TRIGGER trg_set_updated_at_billing_invoices
      BEFORE UPDATE ON public.billing_invoices
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF to_regclass('public.billing_invoice_items') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_billing_invoice_items') THEN
    CREATE TRIGGER trg_set_updated_at_billing_invoice_items
      BEFORE UPDATE ON public.billing_invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.billing_invoice_counters (
  year int NOT NULL,
  kind text NOT NULL,
  last_value int NOT NULL DEFAULT 0,
  PRIMARY KEY (year, kind)
);

ALTER TABLE public.billing_invoice_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_invoice_counters' AND policyname='billing_invoice_counters_admin_read'
  ) THEN
    CREATE POLICY billing_invoice_counters_admin_read ON public.billing_invoice_counters
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.can_manage_admins = true)));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.billing_next_invoice_number(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y int := extract(year from now())::int;
  next_val int;
  prefix text;
BEGIN
  prefix := CASE
    WHEN p_kind = 'deposit' THEN 'ZL'
    WHEN p_kind = 'credit_note' THEN 'DB'
    ELSE 'FV'
  END;

  INSERT INTO public.billing_invoice_counters (year, kind, last_value)
  VALUES (y, p_kind, 0)
  ON CONFLICT (year, kind) DO NOTHING;

  UPDATE public.billing_invoice_counters
  SET last_value = last_value + 1
  WHERE year = y AND kind = p_kind
  RETURNING last_value INTO next_val;

  RETURN prefix || '-' || y::text || '-' || lpad(next_val::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.billing_next_invoice_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_next_invoice_number(text) TO service_role;

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

REVOKE ALL ON FUNCTION public.billing_invoice_create(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_invoice_create(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_invoice_create(jsonb, jsonb) TO service_role;

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

REVOKE ALL ON FUNCTION public.billing_invoice_update(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_invoice_update(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_invoice_update(uuid, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.billing_issue_invoice(p_invoice_id uuid)
RETURNS public.billing_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.billing_invoices;
  num text;
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

  UPDATE public.billing_invoices bi
  SET
    number = num,
    status = 'issued',
    issue_date = COALESCE(issue_date, now()::date),
    total = COALESCE((SELECT sum(total) FROM public.billing_invoice_items bii WHERE bii.invoice_id = bi.id), 0)
  WHERE bi.id = inv.id
  RETURNING * INTO inv;

  RETURN inv;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_issue_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_issue_invoice(uuid) TO service_role;
