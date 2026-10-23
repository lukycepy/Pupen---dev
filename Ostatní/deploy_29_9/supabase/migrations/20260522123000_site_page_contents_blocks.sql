alter table public.site_page_contents
  add column if not exists content_blocks jsonb;

