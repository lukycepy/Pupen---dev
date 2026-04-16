function stripHtml(input: string) {
  return String(input || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function draftEventDescriptionHtmlCz(args: {
  title: string;
  date?: string;
  time?: string;
  location?: string;
  category?: string;
  isMemberOnly?: boolean;
}) {
  const lines: string[] = [];
  lines.push(`<p><strong>${args.title}</strong></p>`);
  lines.push('<h2>O akci</h2>');
  lines.push('<p>Napište krátký úvod: pro koho je akce, co si odnesete a proč přijít.</p>');
  lines.push('<h2>Prakticky</h2>');
  lines.push('<ul>');
  if (args.date) lines.push(`<li><strong>Datum:</strong> ${args.date}</li>`);
  if (args.time) lines.push(`<li><strong>Čas:</strong> ${args.time}</li>`);
  if (args.location) lines.push(`<li><strong>Místo:</strong> ${args.location}</li>`);
  if (args.category) lines.push(`<li><strong>Kategorie:</strong> ${args.category}</li>`);
  if (args.isMemberOnly) lines.push('<li><strong>Přístup:</strong> pouze pro členy</li>');
  lines.push('</ul>');
  lines.push('<h2>Program</h2>');
  lines.push('<ul><li></li><li></li><li></li></ul>');
  lines.push('<h2>Co s sebou</h2>');
  lines.push('<ul><li></li><li></li></ul>');
  lines.push('<h2>Kontakt</h2>');
  lines.push('<p>Máte dotazy? Napište nám.</p>');
  return lines.join('\n');
}

export function draftEventDescriptionHtmlEn(args: {
  title: string;
  date?: string;
  time?: string;
  location?: string;
  category?: string;
  isMemberOnly?: boolean;
}) {
  const lines: string[] = [];
  lines.push(`<p><strong>${args.title}</strong></p>`);
  lines.push('<h2>About</h2>');
  lines.push('<p>Write a short intro: who it is for, what you will get, and why to join.</p>');
  lines.push('<h2>Details</h2>');
  lines.push('<ul>');
  if (args.date) lines.push(`<li><strong>Date:</strong> ${args.date}</li>`);
  if (args.time) lines.push(`<li><strong>Time:</strong> ${args.time}</li>`);
  if (args.location) lines.push(`<li><strong>Location:</strong> ${args.location}</li>`);
  if (args.category) lines.push(`<li><strong>Category:</strong> ${args.category}</li>`);
  if (args.isMemberOnly) lines.push('<li><strong>Access:</strong> members only</li>');
  lines.push('</ul>');
  lines.push('<h2>Agenda</h2>');
  lines.push('<ul><li></li><li></li><li></li></ul>');
  lines.push('<h2>Bring</h2>');
  lines.push('<ul><li></li><li></li></ul>');
  lines.push('<h2>Contact</h2>');
  lines.push('<p>Questions? Contact us.</p>');
  return lines.join('\n');
}

const CZ_TO_EN_WORDS: Array<[RegExp, string]> = [
  [/\bakce\b/gi, 'event'],
  [/\bpárty\b/gi, 'party'],
  [/\bvýlet\b/gi, 'trip'],
  [/\bvzdělávání\b/gi, 'workshop'],
  [/\bworkshop\b/gi, 'workshop'],
  [/\bregistrace\b/gi, 'registration'],
  [/\bvstup\b/gi, 'entry'],
  [/\bčlen\b/gi, 'member'],
  [/\bčlenové\b/gi, 'members'],
  [/\bspolek\b/gi, 'association'],
];

export function suggestEnglishText(input: string) {
  const base = stripHtml(input);
  if (!base) return '';
  let out = base;
  for (const [re, repl] of CZ_TO_EN_WORDS) out = out.replace(re, repl);
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

export function summarizeHtmlToBullets(html: string, maxItems = 8) {
  const text = stripHtml(html);
  if (!text) return { bullets: [] as string[], raw: '' };
  const parts = text
    .split(/[\n•]+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentences = parts.flatMap((p) => p.split(/(?<=[.!?])\s+/g)).map((s) => s.trim()).filter(Boolean);
  const bullets: string[] = [];
  for (const s of sentences) {
    if (bullets.length >= maxItems) break;
    if (s.length < 18) continue;
    bullets.push(s.length > 140 ? `${s.slice(0, 137)}…` : s);
  }
  return { bullets, raw: text };
}

export function seoSuggestions(args: {
  title: string;
  descriptionHtml?: string;
  imageUrl?: string | null;
  canonicalPath?: string;
}) {
  const items: string[] = [];
  const title = String(args.title || '').trim();
  const descText = stripHtml(args.descriptionHtml || '');

  if (title.length < 20) items.push('Titulek je krátký; zvažte 30–60 znaků.');
  if (title.length > 70) items.push('Titulek je dlouhý; zvažte zkrácení pod ~70 znaků.');
  if (!descText) items.push('Chybí popis; doplňte úvodní odstavec a praktické info.');
  if (descText && descText.length < 80) items.push('Popis je krátký; zvažte 80–160 znaků v úvodu.');
  if (descText && descText.length > 320) items.push('Úvodní text je dlouhý; zvažte kratší první odstavec.');
  if (!args.imageUrl) items.push('Chybí obrázek; doplňte pro lepší sdílení (OG).');
  if (args.canonicalPath && !args.canonicalPath.startsWith('/')) items.push('Kanonická cesta má mít formát /cs/…');
  return items;
}
