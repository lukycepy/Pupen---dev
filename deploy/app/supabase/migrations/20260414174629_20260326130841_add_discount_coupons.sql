create table public.discount_coupons (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  description text,
  discount_amount numeric,
  discount_percentage numeric,
  max_uses integer,
  current_uses integer default 0,
  valid_from timestamp with time zone default now(),
  valid_until timestamp with time zone,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users(id)
);

alter table public.discount_coupons enable row level security;

create policy "Admins can manage discount coupons"
  on public.discount_coupons
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and (profiles.is_admin = true or profiles.can_manage_admins = true)
    )
  );

create policy "Anyone can view active discount coupons"
  on public.discount_coupons
  for select
  using (is_active = true);
