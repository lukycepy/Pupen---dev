import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Regresní test: české a anglické slovníky musí mít shodnou sadu klíčů.
 * Chybějící klíč v jednom jazyce se v UI projeví prázdným nebo českým textem
 * v anglické mutaci, proto je parita hlídána automaticky.
 */

const DICT_DIR = path.resolve(__dirname, '..', '..', 'dictionaries');

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function flatten(obj: Record<string, Json>, prefix = ''): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, Json>, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const PAIRS: Array<[string, string]> = [
  ['cs.json', 'en.json'],
  ['cs.admin-dashboard.json', 'en.admin-dashboard.json'],
  ['cs.member-components.json', 'en.member-components.json'],
];

for (const [csFile, enFile] of PAIRS) {
  test(`dictionary parity: ${csFile} vs ${enFile}`, async () => {
    const cs = flatten(JSON.parse(fs.readFileSync(path.join(DICT_DIR, csFile), 'utf8')));
    const en = flatten(JSON.parse(fs.readFileSync(path.join(DICT_DIR, enFile), 'utf8')));

    const missingInEn = Object.keys(cs).filter((k) => !(k in en));
    const missingInCs = Object.keys(en).filter((k) => !(k in cs));

    expect(missingInEn, `Klíče chybějící v ${enFile}`).toEqual([]);
    expect(missingInCs, `Klíče chybějící v ${csFile}`).toEqual([]);
  });
}
