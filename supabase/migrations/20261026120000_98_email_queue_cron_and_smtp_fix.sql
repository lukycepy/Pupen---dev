-- ============================================================================
-- 98) Odesílání e-mailů: plánování fronty (cron) + oprava nastavení SMTP
-- ============================================================================
-- Proč tato migrace vznikla
-- ----------------------------------------------------------------------------
-- Aplikace neodesílá e-maily přímo – vkládá je do fronty
-- (public.email_send_queue) a teprve endpoint /api/cron/email-queue ji
-- zpracuje a odešle přes SMTP.
--
-- Frontu ale musí někdo pravidelně volat. Pokud na VPS neběží systémový cron,
-- fronta se nikdy nevyprázdní: e-maily zůstanou navěky ve stavu "queued"
-- a nikdo je nedostane. Přesně to se dělo (ve frontě byly e-maily k přihláškám
-- ze 26. 10. 2026, které se nikdy neodeslaly).
--
-- Tato migrace řeší dvě věci:
--   1) Naplánuje volání cron endpointů PŘÍMO Z DATABÁZE (pg_cron + pg_net),
--      takže aplikace přestane být závislá na systémovém cronu na VPS.
--   2) Opraví nekonzistentní nastavení SMTP (port 465 vyžaduje implicitní TLS).
--
-- ============================================================================
-- CO JE POTŘEBA DOPLNIT PO NASAZENÍ (jednorázově, v SQL editoru Supabase)
-- ============================================================================
-- 1) Uložit sdílené tajemství do Vaultu. Hodnota MUSÍ být STEJNÁ jako
--    CRON_SECRET v .env aplikace na VPS:
--
--      select vault.create_secret(
--        'SEM_VLOZTE_HODNOTU_CRON_SECRET',
--        'pupen_cron_secret',
--        'CRON secret pro plánované úlohy aplikace'
--      );
--
-- 2) V administraci (Pupen Control -> Email settings) doplnit SMTP heslo.
--    Bez hesla aplikace hlásí "Email not configured" a e-maily neodešle.
--
-- 3) (Volitelně) změnit URL webu:
--      update public.cron_config set base_url = 'https://pupen.org' where id = 1;
--
-- 4) (Volitelně) plánované úlohy dočasně vypnout:
--      update public.cron_config set enabled = false where id = 1;
--
-- Poznámka: pokud se rozšíření nepodaří zapnout přes SQL, zapněte je
-- v Dashboardu (Database -> Extensions -> pg_cron a pg_net) a spusťte
-- automigrace znovu. Migrace je idempotentní, lze ji spustit opakovaně.
-- ============================================================================


-- ============================================================================
-- ČÁST 1: Oprava nastavení SMTP
-- ============================================================================
-- Port 465 je SMTPS a vyžaduje implicitní TLS (secure = true). Při secure=false
-- se spojení na 465 zasekne (server očekává TLS hned po připojení), takže se
-- e-mail nikdy neodešle. Opravujeme jen prokazatelně nekonzistentní kombinaci.
update public.email_settings
   set smtp_secure = true
 where smtp_port = 465
   and coalesce(smtp_secure, false) = false;


-- ============================================================================
-- ČÁST 2: Plánované úlohy (cron) přímo v databázi
-- ============================================================================

-- 2.1) Zapnutí rozšíření -----------------------------------------------------
do $do$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron se nepodařilo zapnout přes SQL: %', sqlerrm;
  end;

  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net se nepodařilo zapnout přes SQL: %', sqlerrm;
  end;
end
$do$;


-- 2.2) Konfigurace plánovače -------------------------------------------------
create table if not exists public.cron_config (
  id integer primary key,
  base_url text not null default 'https://pupen.org',
  secret_name text not null default 'pupen_cron_secret',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint cron_config_singleton check (id = 1)
);

alter table public.cron_config enable row level security;
-- Záměrně bez RLS politik: tabulka je přístupná jen pro service_role
-- a správce databáze (anon/authenticated k ní nemají přístup).

insert into public.cron_config (id) values (1)
on conflict (id) do nothing;


-- 2.3) Pomocné funkce --------------------------------------------------------
-- Načte konfiguraci + tajemství z Vaultu (tajemství nikdy neukládáme do tabulky).
create or replace function public.cron_config_get()
returns table (base_url text, secret text, enabled boolean)
language sql
security definer
set search_path = public, vault, pg_temp
as $fn$
  select c.base_url,
         s.decrypted_secret,
         c.enabled
  from public.cron_config c
  left join vault.decrypted_secrets s on s.name = c.secret_name
  where c.id = 1
  limit 1;
$fn$;

-- Zavolá endpoint aplikace. Tajemství předává jak v query (?secret=), tak
-- v hlavičce x-cron-secret – různé cron endpointy akceptují různé varianty.
create or replace function public.app_cron_ping(
  path text,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_ms integer default 10000
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  cfg record;
  http_fn text;
  prms jsonb;
  hdrs jsonb;
  req_id bigint;
begin
  select * into cfg from public.cron_config_get();
  if cfg is null or cfg.enabled is not true then
    return null;
  end if;
  -- Bez URL nebo bez tajemství nic neposíláme (aby úlohy tiše neselhávaly).
  if cfg.base_url is null or cfg.secret is null or length(cfg.secret) = 0 then
    return null;
  end if;

  -- pg_net může být nainstalován v schématu "net" nebo "extensions".
  http_fn := case
    when to_regprocedure('net.http_get(text,jsonb,jsonb,integer)') is not null then 'net.http_get'
    when to_regprocedure('extensions.http_get(text,jsonb,jsonb,integer)') is not null then 'extensions.http_get'
    else null
  end;
  if http_fn is null then
    return null;
  end if;

  prms := coalesce(params, '{}'::jsonb) || jsonb_build_object('secret', cfg.secret);
  hdrs := coalesce(headers, '{}'::jsonb) || jsonb_build_object('x-cron-secret', cfg.secret);

  execute format(
    'select %s(url := $1, params := $2, headers := $3, timeout_milliseconds := $4)',
    http_fn
  )
  into req_id
  using cfg.base_url || path, prms, hdrs, greatest(1000, coalesce(timeout_ms, 10000));

  return req_id;
end;
$fn$;

-- Tyto funkce nesmí být dostupné veřejně ( obsahují práci s tajemstvím ).
revoke all on function public.cron_config_get() from public;
revoke all on function public.app_cron_ping(text, jsonb, jsonb, integer) from public;
grant execute on function public.cron_config_get() to service_role;
grant execute on function public.app_cron_ping(text, jsonb, jsonb, integer) to service_role;


-- 2.4) Naplánování úloh ------------------------------------------------------
do $do$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'cron.schedule není dostupné – úlohy se nevytvořily. Zapněte rozšíření pg_cron a spusťte migraci znovu.';
    return;
  end if;

  -- E-mailová fronta: potvrzení přihlášek, notifikace adminům, faktury…
  -- Běží každou minutu, vždy zpracuje dávku 10 e-mailů.
  perform cron.schedule(
    'pupen-email-queue',
    '* * * * *',
    $job$ select public.app_cron_ping('/api/cron/email-queue', jsonb_build_object('limit', '10'), '{}'::jsonb, 60000); $job$
  );

  -- Souhrnný přehled (každých 10 minut)
  perform cron.schedule(
    'pupen-digest',
    '*/10 * * * *',
    $job$ select public.app_cron_ping('/api/cron/digest', '{}'::jsonb, '{}'::jsonb, 30000); $job$
  );

  -- Exspirace členství (denně ve 3:00)
  perform cron.schedule(
    'pupen-membership-expiry',
    '0 3 * * *',
    $job$ select public.app_cron_ping('/api/cron/membership-expiry', '{}'::jsonb, '{}'::jsonb, 30000); $job$
  );
end
$do$;

-- Poznámka: další dostupné endpointy (banka, RSVP, waitlist, DM připomínky,
-- schránka důvěry) lze naplánovat stejným způsobem voláním cron.schedule
-- s příslušnou cestou, např. '/api/cron/bank-transactions'.


-- ============================================================================
-- ČÁST 3: Reload PostgREST schéma cache
-- ============================================================================
select pg_notify('pgrst', 'reload schema');
