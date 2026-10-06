import { z } from 'zod';

export const LinkaContactSchema = z.object({
  id: z.number().int().positive(),
  jmeno: z.string().min(1).max(200).trim(),
  oddeleni: z.string().min(1).max(200).trim(),
  fakulta: z.string().min(1).max(200).trim(),
  budova: z.string().min(1).max(200).trim(),
  mistnost: z.string().min(1).max(100).trim(),
  klapka: z.string().regex(/^\d{4}$/, 'Linka musí být přesně 4 číslice'),
  email: z.string().email().max(200).trim().toLowerCase(),
});

export const LinkaPayloadSchema = z.object({
  version: z.number().int().nonnegative(),
  lastUpdated: z.string().min(1),
  contacts: z.array(LinkaContactSchema),
});

export type LinkaContact = z.infer<typeof LinkaContactSchema>;
export type LinkaPayload = z.infer<typeof LinkaPayloadSchema>;

export const DEFAULT_LINKA_DATA: LinkaPayload = {
  version: 1,
  lastUpdated: '2026-09-29T00:00:00.000Z',
  contacts: [
    {
      id: 11,
      jmeno: 'Lukáš Čepelák',
      oddeleni: 'Podpora aplikace Linka',
      fakulta: 'Studentský spolek Pupen, z.s.',
      budova: 'Studentské centrum',
      mistnost: 'Pupen klubovna',
      klapka: '1777',
      email: 'tech@pupen.org',
    },
    {
      id: 12,
      jmeno: 'Studentský spolek Pupen, z.s.',
      oddeleni: 'Studentské projekty',
      fakulta: 'Studentský spolek Pupen, z.s.',
      budova: 'Studentské centrum',
      mistnost: 'Pupen klubovna',
      klapka: '1700',
      email: 'info@pupen.org',
    },
  ],
};

export function validateContacts(contacts: LinkaContact[]): string[] {
  const errors: string[] = [];

  const ids = new Set<number>();
  const klapky = new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const idx = i + 1;
    const r = LinkaContactSchema.safeParse(c);
    if (!r.success) {
      for (const issue of r.error.issues) {
        const path = issue.path.join('.') || '?';
        errors.push(`Kontakt #${idx} (${String(c.jmeno || c.id || '?')}): ${path}: ${issue.message}`);
      }
      continue;
    }
    if (ids.has(c.id)) errors.push(`Kontakt #${idx}: duplicitní id ${c.id}`);
    ids.add(c.id);
    if (klapky.has(c.klapka)) errors.push(`Kontakt #${idx}: duplicitní linka ${c.klapka} (${c.jmeno})`);
    klapky.add(c.klapka);
  }

  return errors;
};

export function nextContactId(contacts: LinkaContact[]): number {
  let max = 0;
  for (const c of contacts) {
    if (Number.isFinite(c.id) && c.id > max) max = c.id;
  }
  return max + 1;
}

export function removeDiacritics(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function contactMatches(contact: LinkaContact, query: string): boolean {
  const q = removeDiacritics(query).trim();
  if (!q) return true;
  const hay = removeDiacritics(
    [
      contact.id,
      contact.jmeno,
      contact.oddeleni,
      contact.fakulta,
      contact.budova,
      contact.mistnost,
      contact.klapka,
      contact.email,
    ].join(' '),
  );
  return hay.includes(q);
}

export function contactToCsvRow(c: LinkaContact): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return [c.id, c.jmeno, c.oddeleni, c.fakulta, c.budova, c.mistnost, c.klapka, c.email]
    .map(esc)
    .join(',');
}

export const CSV_HEADER = 'id,jmeno,oddeleni,fakulta,budova,mistnost,klapka,email';

export function parseCsv(text: string): LinkaContact[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\r') {
        // ignore
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const out: LinkaContact[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !String(c || '').trim())) continue;
    const pick = (n: string) => String(row[idx(n)] ?? '').trim();
    const idRaw = pick('id');
    const idNum = Number(idRaw);
    out.push({
      id: Number.isFinite(idNum) && idNum > 0 ? Math.floor(idNum) : 0,
      jmeno: pick('jmeno'),
      oddeleni: pick('oddeleni'),
      fakulta: pick('fakulta'),
      budova: pick('budova'),
      mistnost: pick('mistnost'),
      klapka: pick('klapka'),
      email: pick('email'),
    });
  }
  return out;
}
