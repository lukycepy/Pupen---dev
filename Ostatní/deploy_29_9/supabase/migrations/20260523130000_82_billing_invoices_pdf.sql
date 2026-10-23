do $$
begin
  if not exists (select 1 from storage.buckets where id = 'billing_invoices') then
    insert into storage.buckets (id, name, public)
    values ('billing_invoices', 'billing_invoices', false);
  end if;
end $$;

alter table public.billing_invoices
  add column if not exists pdf_bucket text,
  add column if not exists pdf_path text,
  add column if not exists pdf_generated_at timestamptz,
  add column if not exists pdf_size_bytes int,
  add column if not exists pdf_mime text;
