function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatIcsDateUtc(d: Date) {
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

export function escapeIcsText(s: string) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function stripHtmlToText(html: string) {
  const raw = String(html || '');
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function foldIcsLine(line: string) {
  const out: string[] = [];
  const s = String(line || '');
  const limit = 75;
  for (let i = 0; i < s.length; i += limit) {
    const chunk = s.slice(i, i + limit);
    out.push(i === 0 ? chunk : ` ${chunk}`);
  }
  return out.join('\r\n');
}

export function buildCalendarIcs(opts: { calName: string; prodId: string; events: string[] }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    foldIcsLine(`PRODID:${opts.prodId}`),
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${escapeIcsText(opts.calName)}`),
    ...opts.events,
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

