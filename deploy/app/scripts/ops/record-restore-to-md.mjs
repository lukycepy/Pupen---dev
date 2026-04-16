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

function insertBeforeSectionEnd(lines, sectionHeader, row) {
  const start = lines.findIndex((l) => l.trim() === sectionHeader.trim());
  if (start === -1) return [...lines, row];
  const after = lines.slice(start + 1);
  const nextHeaderRel = after.findIndex((l) => l.startsWith('## '));
  const insertAt = nextHeaderRel === -1 ? lines.length : start + 1 + nextHeaderRel;
  return [...lines.slice(0, insertAt), row, ...lines.slice(insertAt)];
}

function main() {
  const target = getArg('--target') || 'staging / lokál';
  const dump = getArg('--dump') || '';
  const outcome = (getArg('--outcome') || 'OK').toUpperCase();
  const notes = getArg('--notes') || '';

  const repoRoot = process.cwd();
  const mdPath = path.join(repoRoot, 'docs', 'ops', 'zaznam-testu-obnovy.md');
  if (!fs.existsSync(mdPath)) {
    console.error(`Missing file: ${mdPath}`);
    process.exit(1);
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const lines = md.split(/\r?\n/);

  const row = `| ${fmtDateCzNow()} | ${target} | ${dump} | restore:db | ${outcome} | ${notes} |`;
  const out = insertBeforeSectionEnd(lines, '## 3) Poznámky', row);
  fs.writeFileSync(mdPath, out.join('\n'), 'utf8');
  console.log(JSON.stringify({ ok: true, updated: mdPath }));
}

main();
