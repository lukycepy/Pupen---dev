create table if not exists public.site_page_contents (
  slug text not null,
  lang text not null,
  title text,
  content_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (slug, lang)
);

alter table public.site_page_contents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_page_contents' and policyname='site_page_contents_public_select'
  ) then
    create policy site_page_contents_public_select
      on public.site_page_contents
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='site_page_contents' and policyname='site_page_contents_superadmin_write'
  ) then
    create policy site_page_contents_superadmin_write
      on public.site_page_contents
      for all
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin());
  end if;
end $$;

