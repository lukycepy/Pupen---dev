import { z } from 'zod';

export const LinkaContactSchema = z.object({
  id: z.number().int().positive(),
  jmeno: z.string().min(1).max(200).trim(),
  oddeleni: z.string().min(1).max(200).trim(),
  fakulta: z.string().min(1).max(200).trim(),
  budova: z.string().min(1).max(200).trim(),
  mistnost: z.string().min(1).max(100).trim(),
  klapka: z.string().regex(/^\d{4}$/, 'Linka musí být přesně 4 číslice'),
  // Nepovinné přímé telefonní číslo. Aplikace Linka ho upřednostní před linkou,
  // takže u kontaktů, které mají i mobil, se uživateli nabídne volba obojího.
  telefon: z.string().max(40).trim().default(''),
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
      telefon: '',
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
      telefon: '',
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

export function normalizeImportKey(value: string) {
  return removeDiacritics(String(value || '')).replace(/[^a-z0-9]+/g, '');
}

function buildImportMap(record: Record<string, unknown>) {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeImportKey(key);
    if (normalized && !out.has(normalized)) out.set(normalized, value);
  }
  return out;
}

export function firstImportValueFromAliases(record: Record<string, unknown>, aliases: string[]) {
  const map = buildImportMap(record);
  for (const alias of aliases) {
    const value = map.get(normalizeImportKey(alias));
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function splitImportCandidates(value: string) {
  return String(value || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstImportEmail(record: Record<string, unknown>, aliases: string[]) {
  const raw = firstImportValueFromAliases(record, aliases);
  const candidates = splitImportCandidates(raw).flatMap((part) => part.split(/[,\s;]+/g).map((chunk) => chunk.trim()).filter(Boolean));
  for (const candidate of candidates) {
    const normalized = candidate.replace(/[<>]/g, '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return normalized;
  }
  return '';
}

function firstImportExtension(record: Record<string, unknown>, aliases: string[]) {
  const raw = firstImportValueFromAliases(record, aliases);
  const match = raw.match(/(?:^|\D)(\d{4})(?!\d)/);
  return match?.[1] || '';
}

function firstImportPhone(record: Record<string, unknown>, aliases: string[]) {
  const raw = firstImportValueFromAliases(record, aliases);
  const candidates = splitImportCandidates(raw);
  for (const candidate of candidates) {
    const normalized = candidate.replace(/\s+/g, ' ').trim();
    if (normalized) return normalized;
  }
  return '';
}

function pickMostSpecificImportLabel(value: string) {
  const parts = splitImportCandidates(value);
  const selected = parts.length > 0 ? parts[parts.length - 1] : String(value || '').trim();
  const hierarchy = selected
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);
  return (hierarchy.length > 0 ? hierarchy[hierarchy.length - 1] : selected).trim();
}

function scoreImportedContact(contact: LinkaContact) {
  return [
    contact.jmeno,
    contact.oddeleni,
    contact.fakulta,
    contact.budova,
    contact.mistnost,
    contact.klapka,
    contact.telefon,
    contact.email,
  ].reduce((sum, value) => sum + String(value || '').trim().length, 0);
}

export function normalizeImportedObjectContact(item: unknown): LinkaContact | null {
  const c = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const rawId = Number(firstImportValueFromAliases(c, ['id']));
  const jmeno =
    firstImportValueFromAliases(c, ['jmeno (s tituly)', 'jmeno s tituly', 'full name', 'fullname', 'name', 'jmeno']) ||
    [
      firstImportValueFromAliases(c, ['tituly pred']),
      firstImportValueFromAliases(c, ['jmeno']),
      firstImportValueFromAliases(c, ['prijmeni']),
      firstImportValueFromAliases(c, ['tituly za']),
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  const oddeleniRaw = firstImportValueFromAliases(c, ['oddeleni', 'katedra / pracoviste', 'katedra/pracoviste', 'pracoviste', 'katedra', 'department']);
  const fakultaRaw = firstImportValueFromAliases(c, ['fakulta / utvar', 'fakulta/utvar', 'fakulta', 'utvar', 'faculty']);
  const budovaRaw = firstImportValueFromAliases(c, ['budova', 'lokace', 'building']);
  const mistnostRaw = firstImportValueFromAliases(c, ['mistnost', 'cislo dveri / kancelare', 'cislo dveri/kancelare', 'kancelar', 'room']);
  const oddeleni = pickMostSpecificImportLabel(oddeleniRaw) || pickMostSpecificImportLabel(fakultaRaw);
  const fakulta = pickMostSpecificImportLabel(fakultaRaw) || pickMostSpecificImportLabel(oddeleniRaw);
  const budova = pickMostSpecificImportLabel(budovaRaw) || fakulta || oddeleni || 'CZU';
  const mistnost = pickMostSpecificImportLabel(mistnostRaw) || budova;
  const klapka = firstImportExtension(c, ['klapka', 'linka', 'extension']);
  const telefon =
    firstImportPhone(c, ['telefon', 'mobil', 'phone', 'mobile', 'tel']) ||
    firstImportPhone(c, ['pevna linka', 'pevna', 'fixed line']);
  const email = firstImportEmail(c, ['email', 'hlavni email', 'vedlejsi emaily', 'mail']);

  if (!jmeno && !oddeleni && !fakulta && !budova && !mistnost && !klapka && !telefon && !email) return null;
  if (!jmeno || !email || !/^\d{4}$/.test(klapka)) return null;

  const normalized: LinkaContact = {
    id: Number.isFinite(rawId) && rawId > 0 ? Math.floor(rawId) : 1,
    jmeno,
    oddeleni: oddeleni || fakulta || budova,
    fakulta: fakulta || oddeleni || budova,
    budova,
    mistnost,
    klapka,
    telefon,
    email,
  };

  return LinkaContactSchema.safeParse(normalized).success ? normalized : null;
}

export function normalizeImportedContacts(items: unknown[]) {
  const dedupedByExtension = new Map<string, LinkaContact>();

  for (const item of items) {
    const normalized = normalizeImportedObjectContact(item);
    if (!normalized) continue;

    const existing = dedupedByExtension.get(normalized.klapka);
    if (!existing) {
      dedupedByExtension.set(normalized.klapka, normalized);
      continue;
    }

    if (scoreImportedContact(normalized) > scoreImportedContact(existing)) {
      dedupedByExtension.set(normalized.klapka, normalized);
    }
  }

  return Array.from(dedupedByExtension.values()).map((contact, index) => ({
    ...contact,
    id: index + 1,
  }));
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
      contact.telefon,
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
  return [c.id, c.jmeno, c.oddeleni, c.fakulta, c.budova, c.mistnost, c.klapka, c.telefon, c.email]
    .map(esc)
    .join(',');
}

export const CSV_HEADER = 'id,jmeno,oddeleni,fakulta,budova,mistnost,klapka,telefon,email';

function detectCsvDelimiter(text: string) {
  const candidates = [',', ';', '\t'];
  const counts = new Map<string, number>(candidates.map((candidate) => [candidate, 0]));
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') {
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (!inQ && (ch === '\n' || ch === '\r')) break;
    if (!inQ && counts.has(ch)) counts.set(ch, Number(counts.get(ch) || 0) + 1);
  }

  let best = ',';
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = Number(counts.get(candidate) || 0);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function normalizeHeaderKey(value: string) {
  return removeDiacritics(String(value || ''))
    .replace(/[_\s-]+/g, '')
    .trim();
}

function canonicalHeaderName(value: string) {
  switch (normalizeHeaderKey(value)) {
    case 'id':
      return 'id';
    case 'jmeno':
    case 'name':
      return 'jmeno';
    case 'oddeleni':
    case 'department':
      return 'oddeleni';
    case 'fakulta':
    case 'faculty':
      return 'fakulta';
    case 'budova':
    case 'building':
      return 'budova';
    case 'mistnost':
    case 'room':
      return 'mistnost';
    case 'klapka':
    case 'linka':
    case 'extension':
      return 'klapka';
    case 'telefon':
    case 'telefonnicislo':
    case 'phone':
    case 'mobile':
    case 'tel':
      return 'telefon';
    case 'email':
    case 'mail':
    case 'eemail':
      return 'email';
    default:
      return normalizeHeaderKey(value);
  }
}

export function parseCsv(text: string): LinkaContact[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(src);
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
      else if (ch === delimiter) {
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
  const headerIndex = new Map<string, number>();
  rows[0].forEach((value, index) => {
    const canonical = canonicalHeaderName(String(value || ''));
    if (canonical && !headerIndex.has(canonical)) headerIndex.set(canonical, index);
  });

  const requiredHeaders = ['jmeno', 'oddeleni', 'fakulta', 'budova', 'mistnost', 'klapka', 'email'];
  const missingHeaders = requiredHeaders.filter((name) => !headerIndex.has(name));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV neobsahuje povinne sloupce: ${missingHeaders.join(', ')}`);
  }

  const idx = (name: string) => headerIndex.get(name) ?? -1;
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
      telefon: pick('telefon'),
      email: pick('email'),
    });
  }
  if (out.length === 0) {
    throw new Error('CSV neobsahuje zadne datove radky');
  }
  return out;
}
