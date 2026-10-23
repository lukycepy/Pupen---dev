alter table public.trust_box_messages
  add column if not exists author_user_id uuid,
  add column if not exists author_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trust_box_messages_author_user_id_fkey'
  ) then
    alter table public.trust_box_messages
      add constraint trust_box_messages_author_user_id_fkey
      foreign key (author_user_id) references auth.users(id) on delete set null;
  end if;
end $$;

