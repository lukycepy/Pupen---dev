import fs from 'node:fs';
import path from 'node:path';

function getArg(name) {
  const i = process.argv.findIndex((x) => x === name);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function fmtDateCzNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Dokumentace podpůrných nástrojů žije v `Ostatní/docs/ops/`.
// Zkusíme ji najít tam i v kořeni, aby skript fungoval bez ohledu na to,
// odkud ho spustíme.
function resolveMdPath(repoRoot, fileName) {
  const candidates = [
    path.join(repoRoot, 'Ostatní', 'docs', 'ops', fileName),
    path.join(repoRoot, 'docs', 'ops', fileName),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

// Záznam patří do tabulky v sekci 2. Vkládáme ho před připravený prázdný
// řádek, stejně jako to dělá `record-backup-to-md.mjs`. Původní logika
// hledala konec sekce „Poznámky“ a řádek tak skončil až na konci souboru.
function insertBeforeRow(lines, matcher, row) {
  const idx = lines.findIndex(matcher);
  if (idx === -1) return [...lines, row];
  return [...lines.slice(0, idx), row, ...lines.slice(idx)];
}

function main() {
  const target = getArg('--target') || 'staging / lokál';
  const dump = getArg('--dump') || '';
  const outcome = (getArg('--outcome') || 'OK').toUpperCase();
  const notes = getArg('--notes') || '';

  const repoRoot = process.cwd();
  const mdPath = resolveMdPath(repoRoot, 'zaznam-testu-obnovy.md');
  if (!fs.existsSync(mdPath)) {
    console.error(`Missing file: ${mdPath}`);
    process.exit(1);
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const lines = md.split(/\r?\n/);

  const row = `| ${fmtDateCzNow()} | ${target} | ${dump} | restore:db | ${outcome} | ${notes} |`;
  const out = insertBeforeRow(lines, (l) => l.trim() === '|  | staging / lokál |  |  |  |  |', row);
  fs.writeFileSync(mdPath, out.join('\n'), 'utf8');
  console.log(JSON.stringify({ ok: true, updated: mdPath }));
}

main();
