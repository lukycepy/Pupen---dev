import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { buildCalendarIcs, escapeIcsText, foldIcsLine, formatIcsDateUtc, stripHtmlToText } from '@/lib/calendar/ics';

function addHours(date: Date, hours: number) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'cs';
  const nowIso = new Date().toISOString();
  const { id } = await ctx.params;

  const res = await supabase
    .from('events')
    .select('id,title,title_en,description_html,description_html_en,description,description_en,location,location_en,date,end_date,published_at')
    .eq('id', id)
    .lte('published_at', nowIso)
    .maybeSingle();

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  const ev: any = res.data;
  if (!ev?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const start = ev?.date ? new Date(String(ev.date)) : null;
  if (!start || Number.isNaN(start.getTime())) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const end = ev?.end_date ? new Date(String(ev.end_date)) : addHours(start, 2);

  const dtstamp = formatIcsDateUtc(new Date());
  const title = lang === 'en' && ev?.title_en ? ev.title_en : ev?.title || 'Event';
  const loc = lang === 'en' && ev?.location_en ? ev.location_en : ev?.location || '';
  const descHtml = lang === 'en' ? (ev?.description_html_en || ev?.description_html || ev?.description_en || ev?.description) : (ev?.description_html || ev?.description || '');
  const desc = stripHtmlToText(descHtml);
  const urlEvent = `https://pupen.org/${lang}/akce/${ev.id}`;

  const vevent = [
    'BEGIN:VEVENT',
    foldIcsLine(`UID:${ev.id}@pupen.org`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatIcsDateUtc(start)}`,
    `DTEND:${formatIcsDateUtc(end)}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(title)}`),
    desc ? foldIcsLine(`DESCRIPTION:${escapeIcsText(desc)}`) : '',
    loc ? foldIcsLine(`LOCATION:${escapeIcsText(loc)}`) : '',
    foldIcsLine(`URL:${urlEvent}`),
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');

  const ics = buildCalendarIcs({
    calName: lang === 'en' ? 'Pupen — Events' : 'Pupen — Akce',
    prodId: '-//Pupen//Event//EN',
    events: [vevent],
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="pupen-event-${ev.id}-${lang}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}

