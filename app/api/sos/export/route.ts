import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

function csvEscape(v: any) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toVcf(items: any[]) {
  return items
    .map((c) => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${String(c.title || '').replace(/\n/g, ' ')}`,
      ];
      if (c.phone) lines.push(`TEL;TYPE=WORK,VOICE:${String(c.phone).trim()}`);
      if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${String(c.email).trim()}`);
      if (c.url) lines.push(`URL:${String(c.url).trim()}`);
      if (c.note) lines.push(`NOTE:${String(c.note).replace(/\n/g, ' ')}`);
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
    const items = res.data || [];

    if (format === 'json') {
      return NextResponse.json({ ok: true, items });
    }

    if (format === 'csv') {
      const header = ['title', 'category', 'phone', 'email', 'url', 'note'].join(',');
      const body = items
        .map((c: any) =>
          [c.title, c.category, c.phone, c.email, c.url, c.note].map(csvEscape).join(','),
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

