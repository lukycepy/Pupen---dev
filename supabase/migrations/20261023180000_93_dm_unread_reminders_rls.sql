-- 93_dm_unread_reminders_rls.sql
--
-- Bezpečnostní doplnění zjištěné auditem proti produkční instanci:
--
-- 1) Tabulka public.dm_unread_reminders vznikla (20260414195400) bez zapnutého
--    RLS, ale Supabase default ACL na ni přidělil PLNÁ práva rolím anon
--    a authenticated (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER).
--    Tabulku přitom používá výhradně cron /api/cron/dm-reminders přes
--    service_role. => Zapnout RLS bez politik pro anon/authenticated
--    (deny-by-default) a odebrat přebytečná oprávnění.
--    service_role (rolbypassrls) i postgres (rolbypassrls) zůstávají funkční.
--
-- 2) SECURITY DEFINER funkce bez pinovaného search_path – hardening proti
--    podvržení search_path. Všechny tyto funkce odkazují tabulky plně
--    kvalifikovaně (public.*), takže pinování na "public, pg_temp" je bezpečné.
--
-- Migrace je idempotentní.

-- 1) dm_unread_reminders ------------------------------------------------------
alter table public.dm_unread_reminders enable row level security;

revoke all on public.dm_unread_reminders from anon;
revoke all on public.dm_unread_reminders from authenticated;

-- Cron zapisuje/čte přes service_role – explicitně ponechat potřebná práva.
grant select, insert, update, delete on public.dm_unread_reminders to service_role;

-- 2) search_path hardening pro SECURITY DEFINER funkce ------------------------
do $$
declare
  fn text;
  fn_sigs text[] := array[
    'public.admin_reload_schema_cache()',
    'public.email_queue_claim(integer,text)',
    'public.handle_new_user_profile()',
    'public.increment_newsletter_click(uuid)',
    'public.increment_newsletter_open(uuid)',
    'public.rate_limit_check(text,text,integer,integer)'
  ];
begin
  foreach fn in array fn_sigs loop
    begin
      execute format('alter function %s set search_path = public, pg_temp', fn);
    exception
      when undefined_function then
        null; -- funkce v této instanci neexistuje
    end;
  end loop;
end $$;
