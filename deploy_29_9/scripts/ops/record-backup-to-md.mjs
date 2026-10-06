import fs from 'node:fs';
import path from 'node:path';

function getBackupDir() {
  return process.env.BACKUP_DIR ? String(process.env.BACKUP_DIR) : path.join('ops', 'backup-artifacts');
}

function readLastJsonlLine(filePath, predicate) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const obj = JSON.parse(lines[i]);
      if (!predicate || predicate(obj)) return obj;
    } catch {}
  }
  return null;
}

function fmtDateIsoToCz(iso) {
  const d = new Date(String(iso || ''));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function insertBeforeFirst(lines, matcher, insertLines) {
  const idx = lines.findIndex((l) => matcher(l));
  if (idx === -1) return [...lines, ...insertLines];
  return [...lines.slice(0, idx), ...insertLines, ...lines.slice(idx)];
}

function main() {
  const repoRoot = process.cwd();
  const backupDir = path.isAbsolute(getBackupDir()) ? getBackupDir() : path.join(repoRoot, getBackupDir());
  const logPath = path.join(backupDir, 'backup-log.jsonl');

  const lastDb = readLastJsonlLine(logPath, (x) => x?.type === 'db' && x?.ok === true);
  const lastStorage = readLastJsonlLine(logPath, (x) => x?.type === 'storage' && x?.ok === true);
  const lastRun = readLastJsonlLine(logPath, (x) => x?.type === 'backup_run');

  if (!lastDb && !lastStorage && !lastRun) {
    console.error('No backup entries found in backup-log.jsonl');
    process.exit(2);
  }

  const mdPath = path.join(repoRoot, 'docs', 'ops', 'zaznam-testu-obnovy.md');
  if (!fs.existsSync(mdPath)) {
    console.error(`Missing file: ${mdPath}`);
    process.exit(1);
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const lines = md.split(/\r?\n/);

  const noteRun = lastRun
    ? `backup_run ok=${String(!!lastRun.ok)}`
    : '';

  const insertDb = lastDb
    ? [
        `| ${fmtDateIsoToCz(lastDb.at)} | DB | ${lastDb.ok ? 'OK' : 'FAIL'} | ${lastDb.file || ''} |  | ${noteRun} |`,
      ]
    : [];
  const insertStorage = lastStorage
    ? [
        `| ${fmtDateIsoToCz(lastStorage.at)} | Storage | ${lastStorage.ok ? 'OK' : 'FAIL'} | ${lastStorage.runDir || ''} |  | ${noteRun} |`,
      ]
    : [];

  let out = lines;
  if (insertDb.length) {
    out = insertBeforeFirst(
      out,
      (l) => l.trim() === '|  | DB |  |  |  |  |',
      insertDb,
    );
  }
  if (insertStorage.length) {
    out = insertBeforeFirst(
      out,
      (l) => l.trim() === '|  | Storage |  |  |  |  |',
      insertStorage,
    );
  }

  fs.writeFileSync(mdPath, out.join('\n'), 'utf8');
  console.log(JSON.stringify({ ok: true, updated: mdPath }));
}

main();
