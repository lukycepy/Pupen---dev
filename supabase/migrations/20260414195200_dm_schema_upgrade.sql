alter table public.dm_threads
  add column if not exists participant1_email text,
  add column if not exists participant2_email text,
  add column if not exists participant1_unread_count integer not null default 0,
  add column if not exists participant2_unread_count integer not null default 0,
  add column if not exists last_message text,
  add column if not exists last_message_at timestamptz,
  add column if not exists is_blocked boolean not null default false;

alter table public.dm_messages
  add column if not exists sender_email text,
  add column if not exists content text,
  add column if not exists is_read boolean not null default false;

update public.dm_messages
set content = body
where content is null and body is not null;

create or replace function public.increment_unread(t_id uuid, p_num integer)
returns void
language plpgsql
as $$
begin
  if p_num = 1 then
    update public.dm_threads set participant1_unread_count = participant1_unread_count + 1, updated_at = now() where id = t_id;
  elsif p_num = 2 then
    update public.dm_threads set participant2_unread_count = participant2_unread_count + 1, updated_at = now() where id = t_id;
  end if;
end;
$$;

