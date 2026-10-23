-- 94: RLS policy for dm_unread_reminders + removal of the legacy tooling table.
--
-- dm_unread_reminders is written and read exclusively by the service role (cron
-- endpoint /api/cron/dm-reminders). Migration 93 enabled RLS and revoked all
-- anon/authenticated privileges, which left the table with RLS enabled but without
-- any policy. Add an explicit superadmin-only SELECT policy (same convention as
-- email_audit_logs / trust_box_audit_logs) so the access model is explicit while
-- regular members keep zero access.

grant select on public.dm_unread_reminders to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dm_unread_reminders'
      and policyname = 'dm_unread_reminders_admin_select'
  ) then
    create policy dm_unread_reminders_admin_select
      on public.dm_unread_reminders
      for select
      to authenticated
      using (public.is_superadmin());
  end if;
end $$;

-- Legacy bookkeeping table of the pre-Supabase migration runner (public.schema_migrations).
-- It is empty and has been unused since the project moved to supabase/migrations, but it
-- was still being created (and exposed to anon/authenticated) on every migrate run.
-- The runner now creates it only when legacy /migrace SQL files exist, so drop the
-- leftover table to remove an unused, unprotected surface from production.

drop table if exists public.schema_migrations;
