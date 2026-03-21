import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { buildWeeklyDigest } from '@/lib/email/digest';

function weekdayToNum(w: string) {
  const x = String(w || '').toLowerCase();
  if (x.startsWith('mon')) return 1;
  if (x.startsWith('tue')) return 2;
  if (x.startsWith('wed')) return 3;
  if (x.startsWith('thu')) return 4;
  if (x.startsWith('fri')) return 5;
  if (x.startsWith('sat')) return 6;
  if (x.startsWith('sun')) return 7;
  return 0;
}

function nowParts(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return { dayOfWeek: weekdayToNum(m.weekday), hour: Number(m.hour), minute: Number(m.minute) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();

  try {
    const cfgRes = await supabase
      .from('admin_logs')
      .select('created_at, details')
      .eq('action', 'DIGEST_CONFIG')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cfgRes.error) throw cfgRes.error;

    const config = {
      enabled: false,
      timezone: 'Europe/Prague',
      dayOfWeek: 1,
      hour: 9,
      minute: 0,
      windowMinutes: 20,
      maxRecipients: 200,
      minIntervalHours: 72,
      ...(cfgRes.data?.details?.config && typeof cfgRes.data.details.config === 'object' ? cfgRes.data.details.config : {}),
    };

    if (!config.enabled) return NextResponse.json({ ok: true, skipped: 'disabled' });

    const parts = nowParts(String(config.timezone || 'Europe/Prague'));
    const deltaMin = Math.abs(parts.minute - Number(config.minute || 0));
    const inWindow = parts.dayOfWeek === Number(config.dayOfWeek || 1) && parts.hour === Number(config.hour || 9) && deltaMin <= Number(config.windowMinutes || 20);
    if (!inWindow) return NextResponse.json({ ok: true, skipped: 'not_due', now: parts });

    const lastRes = await supabase
      .from('admin_logs')
      .select('created_at')
      .eq('action', 'DIGEST_SCHEDULED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRes.error) throw lastRes.error;

    if (lastRes.data?.created_at) {
      const lastMs = new Date(lastRes.data.created_at).getTime();
      const minIntervalMs = Number(config.minIntervalHours || 72) * 60 * 60 * 1000;
      if (Date.now() - lastMs < minIntervalMs) return NextResponse.json({ ok: true, skipped: 'min_interval' });
    }

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    const digest = await buildWeeklyDigest(supabase);

    const profilesRes = await supabase.from('profiles').select('id, email, is_member').eq('is_member', true).not('email', 'is', null).limit(Number(config.maxRecipients || 200));
    if (profilesRes.error) throw profilesRes.error;
    const profiles = profilesRes.data || [];

    const ids = profiles.map((p: any) => String(p.id));
    const prefsById = new Map<string, any>();
    if (ids.length) {
      const prefsRes = await supabase
        .from('admin_logs')
        .select('target_id, created_at, details')
        .eq('action', 'USER_EMAIL_PREFS')
        .in('target_id', ids)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (prefsRes.error) throw prefsRes.error;
      for (const row of prefsRes.data || []) {
        const tid = String(row.target_id || '');
        if (!tid || prefsById.has(tid)) continue;
        prefsById.set(tid, row.details?.prefs || {});
      }
    }

    const recipients = profiles
      .map((p: any) => ({ id: String(p.id), email: String(p.email || '').toLowerCase() }))
      .filter((p: any) => p.email && (prefsById.get(p.id)?.digestWeekly === false ? false : true));

    const batchId = Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);

    for (const r of recipients) {
      try {
        await transporter.sendMail({
          from,
          to: r.email,
          subject: digest.subject,
          html: digest.html,
        });
        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: 'cron',
              admin_name: 'Digest',
              action: 'DIGEST_SENT',
              target_id: r.email,
              details: { type: 'scheduled', batchId, to: r.email, metrics: digest.metrics, createdAt: new Date().toISOString() },
            },
          ]);
        } catch {}
      } catch {}
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: 'cron',
          admin_name: 'Digest',
          action: 'DIGEST_SCHEDULED',
          target_id: null,
          details: { batchId, recipients: recipients.length, config, metrics: digest.metrics, createdAt: new Date().toISOString() },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true, batchId, recipients: recipients.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
