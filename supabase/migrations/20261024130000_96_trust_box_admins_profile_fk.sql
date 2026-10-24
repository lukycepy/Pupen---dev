-- TrustBox: doplnění chybějícího cizího klíče trust_box_admins.user_id -> profiles(id).
--
-- Bez FK nemůže PostgREST sestavit embed `profiles(email, first_name, last_name)`
-- v /api/admin/trustbox/admins. Vracel PGRST200
-- ("Could not find a relationship between 'trust_box_admins' and 'profiles'")
-- a endpoint končil HTTP 500.

do $$
begin
  -- Osiřelé řádky (user_id bez odpovídajícího profilu) by přidání FK zablokovaly.
  -- Odstraníme je, protože TrustBox admin musí být existující uživatel.
  delete from public.trust_box_admins a
  where not exists (select 1 from public.profiles p where p.id = a.user_id);

  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'trust_box_admins_user_id_fkey'
      and c.conrelid = 'public.trust_box_admins'::regclass
  ) then
    alter table public.trust_box_admins
      add constraint trust_box_admins_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Invalidace PostgREST schema cache, aby se nový vztah okamžitě projevil.
notify pgrst, 'reload schema';
