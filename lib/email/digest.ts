import type { SupabaseClient } from '@supabase/supabase-js';

function esc(input: any) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function section(title: string, rows: Array<{ label: string; value: any }>) {
  return `
    <div style="margin: 16px 0; padding: 16px; border: 1px solid #e7e5e4; border-radius: 16px; background: #fafaf9;">
      <div style="font-weight: 800; margin-bottom: 10px; color: #1c1917;">${esc(title)}</div>
      ${rows
        .map((r) => `<div style="margin: 6px 0;"><strong>${esc(r.label)}:</strong> ${esc(r.value)}</div>`)
        .join('')}
    </div>
  `;
}

export async function buildWeeklyDigest(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const upcomingUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const [appsRes, rsvpRes, reportsRes, joinsRes, eventsRes, pollsRes] = await Promise.all([
    supabase.from('applications').select('id, created_at, status').gte('created_at', since),
    supabase.from('rsvp').select('id, created_at, status').gte('created_at', since),
    supabase.from('admin_logs').select('id').ilike('action', 'REPORT:%').limit(500),
    supabase.from('admin_logs').select('id').eq('action', 'PROJECT:join').gte('created_at', since).limit(500),
    supabase.from('events').select('id, title, date, location').gte('date', new Date().toISOString()).lte('date', upcomingUntil).order('date', { ascending: true }).limit(10),
    supabase.from('polls').select('id, question, is_active, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const apps = appsRes.data || [];
  const rsvps = rsvpRes.data || [];
  const reports = reportsRes.data || [];
  const joins = joinsRes.data || [];
  const events = eventsRes.data || [];
  const activePoll = pollsRes.data || null;

  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 720px; margin: auto;">
      <h2 style="color: #16a34a; margin-top: 0;">Pupen — Týdenní digest</h2>
      <div style="color:#78716c; font-size: 12px; margin-bottom: 14px;">Období: posledních 7 dní • Vygenerováno: ${new Date().toLocaleString('cs-CZ')}</div>
      ${section('Registrace a přihlášky', [
        { label: 'Nové přihlášky členství', value: apps.length },
        { label: 'Nové RSVP', value: rsvps.length },
        { label: 'Žádosti o zapojení do projektů', value: joins.length },
      ])}
      ${section('Moderace', [{ label: 'Nahlášení (celkem v logu)', value: reports.length }])}
      ${section(
        'Nadcházející akce (14 dní)',
        events.length
          ? events.map((e: any) => ({
              label: e.title || 'Akce',
              value: `${e.date ? new Date(e.date).toLocaleDateString('cs-CZ') : ''}${e.location ? ` • ${e.location}` : ''}`,
            }))
          : [{ label: 'Akce', value: '—' }]
      )}
      ${section('Ankety', [{ label: 'Aktivní anketa', value: activePoll ? activePoll.question : '—' }])}
      <div style="margin-top: 16px; font-size: 12px; color: #78716c; text-align: center;">
        Tento e-mail byl odeslán automaticky systémem Pupen.
      </div>
    </div>
  `;

  return {
    subject: 'Pupen — Týdenní digest',
    html,
    metrics: {
      apps: apps.length,
      rsvps: rsvps.length,
      joins: joins.length,
      reports: reports.length,
      upcomingEvents: events.length,
      activePoll: !!activePoll,
    },
  };
}

