create table if not exists public.email_audit_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid,
  to_email text not null,
  from_email text not null,
  subject text not null,
  status text not null,
  provider text,
  provider_message_id text,
  meta jsonb not null default '{}'::jsonb,
  error jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_audit_logs_created_at_idx on public.email_audit_logs(created_at desc);
create index if not exists email_audit_logs_status_idx on public.email_audit_logs(status);

alter table public.email_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='email_audit_logs' and policyname='email_audit_logs_admin_select'
  ) then
    create policy email_audit_logs_admin_select
      on public.email_audit_logs
      for select
      to authenticated
      using (public.is_superadmin());
  end if;
end $$;

