alter table public.profiles
  add column if not exists can_view_governance boolean not null default false,
  add column if not exists can_edit_governance boolean not null default false;

