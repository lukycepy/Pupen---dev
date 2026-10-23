import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface UserExportRow {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  is_member?: boolean | null;
  is_admin?: boolean | null;
  is_blocked?: boolean | null;
  can_manage_admins?: boolean | null;
}

interface ContactExportItem {
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  note: string;
}

function csvEscape(value: unknown) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toVcf(items: ContactExportItem[]) {
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
      .map((r) => {
        const row = r as UserExportRow;
        const email = String(row.email || '').trim().toLowerCase();
        if (!email) return null;
        const noteParts = [];
        if (row.is_admin || row.can_manage_admins) noteParts.push('admin');
        if (row.is_member) noteParts.push('member');
        if (row.is_blocked) noteParts.push('blocked');
        return {
          email,
          first_name: row.first_name || null,
          last_name: row.last_name || null,
          phone: row.phone || null,
          note: noteParts.length ? noteParts.join(', ') : '',
        };
      })
      .filter((item): item is ContactExportItem => item !== null);

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
