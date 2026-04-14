import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function csvEscape(v: any) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toVcf(items: Array<{ email: string; first_name?: string | null; last_name?: string | null; phone?: string | null; note?: string }>) {
  return items
    .map((c) => {
      const fn = String([c.first_name, c.last_name].filter(Boolean).join(' ') || c.email).replace(/\n/g, ' ');
      const nLast = String(c.last_name || '').replace(/\n/g, ' ');
      const nFirst = String(c.first_name || '').replace(/\n/g, ' ');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${fn}`, `N:${nLast};${nFirst};;;`];
      if (c.phone) lines.push(`TEL;TYPE=CELL:${String(c.phone).trim()}`);
      if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${String(c.email).trim()}`);
      if (c.note) lines.push(`NOTE:${String(c.note).replace(/\n/g, ' ')}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    })
    .join('\n');
}

export async function GET(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const format = String(searchParams.get('format') || 'csv').toLowerCase();
    const scope = String(searchParams.get('scope') || 'active').toLowerCase();

    const supabase = getServerSupabase();

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Admin API',
        action: 'EXPORT_DOWNLOAD',
        target_id: 'users_outlook_contacts',
        details: { format, scope, exportedBy: user.id },
      },
    ]);

    let q = supabase
      .from('profiles')
      .select('email,first_name,last_name,phone,is_member,is_admin,is_blocked,can_manage_admins')
      .not('email', 'is', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (scope === 'active') q = q.eq('is_blocked', false);
    if (scope === 'members') q = q.eq('is_member', true).eq('is_blocked', false);
    if (scope === 'admins') q = q.or('is_admin.eq.true,can_manage_admins.eq.true').eq('is_blocked', false);

    const res = await q.limit(10000);
    if (res.error) throw res.error;

    const items = (res.data || [])
      .map((r: any) => {
        const email = String(r.email || '').trim().toLowerCase();
        if (!email) return null;
        const noteParts = [];
        if (r.is_admin || r.can_manage_admins) noteParts.push('admin');
        if (r.is_member) noteParts.push('member');
        if (r.is_blocked) noteParts.push('blocked');
        return {
          email,
          first_name: r.first_name || null,
          last_name: r.last_name || null,
          phone: r.phone || null,
          note: noteParts.length ? noteParts.join(', ') : '',
        };
      })
      .filter(Boolean) as Array<{ email: string; first_name?: string | null; last_name?: string | null; phone?: string | null; note?: string }>;

    if (format === 'vcf') {
      const out = toVcf(items);
      return new NextResponse(out, {
        headers: {
          'Content-Type': 'text/vcard; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pupen-contacts.vcf"',
        },
      });
    }

    const rows = items.map((c) => {
      const firstName = String(c.first_name || '');
      const lastName = String(c.last_name || '');
      const fullName = String([firstName, lastName].filter(Boolean).join(' ') || c.email);
      return [
        csvEscape(firstName),
        csvEscape(lastName),
        csvEscape(fullName),
        csvEscape(c.email),
        csvEscape(fullName),
        csvEscape(c.phone || ''),
        csvEscape(c.note || ''),
      ].join(',');
    });

    const header = ['First Name', 'Last Name', 'Full Name', 'E-mail Address', 'E-mail Display Name', 'Mobile Phone', 'Notes'].join(',');
    const csv = `\uFEFF${header}\n${rows.join('\n')}\n`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="pupen-contacts-outlook.csv"',
      },
    });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

