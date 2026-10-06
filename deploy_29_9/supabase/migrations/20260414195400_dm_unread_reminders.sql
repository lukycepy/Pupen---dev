create table if not exists public.dm_unread_reminders (
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  user_id uuid not null,
  first_unread_at timestamptz not null default now(),
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists dm_unread_reminders_user_id_idx on public.dm_unread_reminders(user_id);
create index if not exists dm_unread_reminders_first_unread_at_idx on public.dm_unread_reminders(first_unread_at);

