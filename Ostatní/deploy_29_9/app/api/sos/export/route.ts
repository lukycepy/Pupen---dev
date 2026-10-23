import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

interface SosExportRow {
  title?: string | null;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  url?: string | null;
  note?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

function csvEscape(value: unknown) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function toVcf(items: SosExportRow[]) {
  return items
    .map((contact) => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${String(contact.title || '').replace(/\n/g, ' ')}`,
      ];
      if (contact.phone) lines.push(`TEL;TYPE=WORK,VOICE:${String(contact.phone).trim()}`);
      if (contact.email) lines.push(`EMAIL;TYPE=INTERNET:${String(contact.email).trim()}`);
      if (contact.url) lines.push(`URL:${String(contact.url).trim()}`);
      if (contact.note) lines.push(`NOTE:${String(contact.note).replace(/\n/g, ' ')}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    })
    .join('\n');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = String(searchParams.get('format') || 'vcf').toLowerCase();

    const supabase = getServerSupabase();
    const res = await supabase
      .from('sos_contacts')
      .select('title,category,phone,email,url,note,sort_order,created_at')
      .eq('is_public', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200);
    if (res.error) throw res.error;
    const items = (res.data || []) as SosExportRow[];

    if (format === 'json') {
      return NextResponse.json({ ok: true, items });
    }

    if (format === 'csv') {
      const header = ['title', 'category', 'phone', 'email', 'url', 'note'].join(',');
      const body = items
        .map((contact) =>
          [contact.title, contact.category, contact.phone, contact.email, contact.url, contact.note].map(csvEscape).join(','),
        )
        .join('\n');
      const out = `${header}\n${body}\n`;
      return new NextResponse(out, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pupen-sos-contacts.csv"',
        },
      });
    }

    const out = toVcf(items);
    return new NextResponse(out, {
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': 'attachment; filename="pupen-sos-contacts.vcf"',
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
