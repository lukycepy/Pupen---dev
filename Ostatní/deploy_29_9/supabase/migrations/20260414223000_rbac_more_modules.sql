alter table public.profiles
  add column if not exists can_view_banners boolean not null default false,
  add column if not exists can_edit_banners boolean not null default false,
  add column if not exists can_view_newsletter boolean not null default false,
  add column if not exists can_edit_newsletter boolean not null default false,
  add column if not exists can_view_email_settings boolean not null default false,
  add column if not exists can_edit_email_settings boolean not null default false,
  add column if not exists can_view_projects boolean not null default false,
  add column if not exists can_edit_projects boolean not null default false,
  add column if not exists can_view_moderation boolean not null default false,
  add column if not exists can_edit_moderation boolean not null default false,
  add column if not exists can_view_refunds boolean not null default false,
  add column if not exists can_edit_refunds boolean not null default false,
  add column if not exists can_view_ticket_security boolean not null default false,
  add column if not exists can_edit_ticket_security boolean not null default false,
  add column if not exists can_view_og_preview boolean not null default false,
  add column if not exists can_edit_og_preview boolean not null default false;

