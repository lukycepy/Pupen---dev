create table if not exists public.trust_box_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  actor_email text null,
  action text not null,
  thread_id uuid null,
  attachment_id uuid null,
  pii_accessed bool not null default false,
  reason text null,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists trust_box_audit_logs_created_at_idx on public.trust_box_audit_logs (created_at desc);
create index if not exists trust_box_audit_logs_thread_id_idx on public.trust_box_audit_logs (thread_id);

alter table public.trust_box_audit_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_audit_logs' and policyname='trust_box_audit_logs_admin_select') then
    create policy trust_box_audit_logs_admin_select on public.trust_box_audit_logs
      for select to authenticated
      using (is_superadmin() or exists(select 1 from public.trust_box_admins a where a.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_audit_logs' and policyname='trust_box_audit_logs_superadmin_insert') then
    create policy trust_box_audit_logs_superadmin_insert on public.trust_box_audit_logs
      for insert to authenticated
      with check (is_superadmin());
  end if;
end $$;

