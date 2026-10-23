ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_view_site_pages boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_site_pages boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_site_nav boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_site_nav boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_site_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_site_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_site_member_portal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_site_member_portal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_site_maintenance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_site_maintenance boolean NOT NULL DEFAULT false;

