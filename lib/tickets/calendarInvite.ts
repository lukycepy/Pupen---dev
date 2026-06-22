import type { Attachment } from 'nodemailer/lib/mailer';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildCalendarIcs, escapeIcsText, foldIcsLine, formatIcsDateUtc, stripHtmlToText } from '@/lib/calendar/ics';
import { getPublicBaseUrl, getPublicHost } from '@/lib/public-base-url';

function addHours(date: Date, hours: number) {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
  return copy;
}

function safeFileName(input: string) {
  return String(input || 'pupen-event')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'pupen-event';
}

export async function buildEventCalendarAttachment(eventId: string, lang: 'cs' | 'en' = 'cs'): Promise<Attachment | null> {
  const supabase = getServerSupabase();
  const nowIso = new Date().toISOString();
  const select =
    'id,title,title_en,description_html,description_html_en,description,description_en,location,location_en,date,end_date,published_at';

  const run = (withMemberFilter: boolean) => {
    let query = supabase.from('events').select(select).eq('id', eventId).lte('published_at', nowIso);
    if (withMemberFilter) query = query.eq('is_member_only', false);
    return query.maybeSingle();
  };

  let res = await run(true);
  if (res.error && /is_member_only/i.test(res.error.message) && /schema cache/i.test(res.error.message)) {
    res = await run(false);
  }
  if (res.error || !res.data?.id) return null;

  const event = res.data as Record<string, unknown>;
  const start = event.date ? new Date(String(event.date)) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = event.end_date ? new Date(String(event.end_date)) : addHours(start, 2);

  const title = lang === 'en' && event.title_en ? String(event.title_en) : String(event.title || 'Event');
  const location = lang === 'en' && event.location_en ? String(event.location_en) : String(event.location || '');
  const descHtml =
    lang === 'en'
      ? String(event.description_html_en || event.description_html || event.description_en || event.description || '')
      : String(event.description_html || event.description || '');
  const description = stripHtmlToText(descHtml);
  const baseUrl = getPublicBaseUrl();
  const host = getPublicHost();
  const eventUrl = `${baseUrl}/${lang}/akce/${event.id}`;

  const vevent = [
    'BEGIN:VEVENT',
    foldIcsLine(`UID:${event.id}@${host}`),
    `DTSTAMP:${formatIcsDateUtc(new Date())}`,
    `DTSTART:${formatIcsDateUtc(start)}`,
    `DTEND:${formatIcsDateUtc(end)}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(title)}`),
    description ? foldIcsLine(`DESCRIPTION:${escapeIcsText(description)}`) : '',
    location ? foldIcsLine(`LOCATION:${escapeIcsText(location)}`) : '',
    foldIcsLine(`URL:${eventUrl}`),
    'END:VEVENT',
  ]
    .filter(Boolean)
    .join('\r\n');

  const ics = buildCalendarIcs({
    calName: lang === 'en' ? 'Pupen — Events' : 'Pupen — Akce',
    prodId: '-//Pupen//TicketInvite//EN',
    events: [vevent],
  });

  return {
    filename: `${safeFileName(title)}.ics`,
    content: ics,
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
  };
}
