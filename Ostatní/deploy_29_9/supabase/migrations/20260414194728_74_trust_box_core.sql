create table if not exists public.trust_box_settings (
  id int primary key default 1,
  retention_days int not null default 365,
  auto_anonymize bool not null default true,
  allowed_staff_subdomains text[] not null default array['af','pef','ftz','rektorat','kam','lib','tf','fzp','bezpecnost','fld','ivp','ktv','oikt'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.trust_box_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.trust_box_admins (
  user_id uuid primary key,
  can_view_pii bool not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.trust_box_threads (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'new',
  priority text not null default 'normal',
  category text not null default 'other',
  subject text not null,
  allow_followup bool not null default false,
  allow_forward_to_faculty bool not null default false,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  anonymized_at timestamptz null
);

create table if not exists public.trust_box_identities (
  thread_id uuid primary key references public.trust_box_threads(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  email_type text not null default 'unknown',
  created_at timestamptz not null default now()
);

create table if not exists public.trust_box_access_tokens (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.trust_box_threads(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trust_box_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.trust_box_threads(id) on delete cascade,
  author_type text not null default 'reporter',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trust_box_attachments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.trust_box_threads(id) on delete cascade,
  message_id uuid not null references public.trust_box_messages(id) on delete cascade,
  bucket text not null,
  path text not null,
  original_name text not null,
  content_type text not null,
  size_bytes int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trust_box_verifications (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  code_hash text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  email_type text not null default 'unknown',
  draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz null
);

create table if not exists public.trust_box_verification_attachments (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.trust_box_verifications(id) on delete cascade,
  bucket text not null,
  path text not null,
  original_name text not null,
  content_type text not null,
  size_bytes int not null,
  created_at timestamptz not null default now()
);

alter table public.trust_box_settings enable row level security;
alter table public.trust_box_admins enable row level security;
alter table public.trust_box_threads enable row level security;
alter table public.trust_box_identities enable row level security;
alter table public.trust_box_access_tokens enable row level security;
alter table public.trust_box_messages enable row level security;
alter table public.trust_box_attachments enable row level security;
alter table public.trust_box_verifications enable row level security;
alter table public.trust_box_verification_attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_settings' and policyname='trust_box_settings_admin_all') then
    create policy trust_box_settings_admin_all on public.trust_box_settings
      for all to authenticated
      using (is_superadmin())
      with check (is_superadmin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_admins' and policyname='trust_box_admins_admin_all') then
    create policy trust_box_admins_admin_all on public.trust_box_admins
      for all to authenticated
      using (is_superadmin())
      with check (is_superadmin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_threads' and policyname='trust_box_threads_admin_select') then
    create policy trust_box_threads_admin_select on public.trust_box_threads
      for select to authenticated
      using (is_superadmin() or exists(select 1 from public.trust_box_admins a where a.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_messages' and policyname='trust_box_messages_admin_select') then
    create policy trust_box_messages_admin_select on public.trust_box_messages
      for select to authenticated
      using (is_superadmin() or exists(select 1 from public.trust_box_admins a where a.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_attachments' and policyname='trust_box_attachments_admin_select') then
    create policy trust_box_attachments_admin_select on public.trust_box_attachments
      for select to authenticated
      using (is_superadmin() or exists(select 1 from public.trust_box_admins a where a.user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_identities' and policyname='trust_box_identities_pii_select') then
    create policy trust_box_identities_pii_select on public.trust_box_identities
      for select to authenticated
      using (is_superadmin() or exists(select 1 from public.trust_box_admins a where a.user_id = auth.uid() and a.can_view_pii = true));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_access_tokens' and policyname='trust_box_access_tokens_admin_select') then
    create policy trust_box_access_tokens_admin_select on public.trust_box_access_tokens
      for select to authenticated
      using (is_superadmin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_verifications' and policyname='trust_box_verifications_admin_select') then
    create policy trust_box_verifications_admin_select on public.trust_box_verifications
      for select to authenticated
      using (is_superadmin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trust_box_verification_attachments' and policyname='trust_box_verification_attachments_admin_select') then
    create policy trust_box_verification_attachments_admin_select on public.trust_box_verification_attachments
      for select to authenticated
      using (is_superadmin());
  end if;
end $$;
