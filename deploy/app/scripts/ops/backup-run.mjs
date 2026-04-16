import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('close', (code) => resolve(Number(code || 0)));
    p.on('error', () => resolve(1));
  });
}

async function main() {
  const outDir = process.env.BACKUP_DIR ? String(process.env.BACKUP_DIR) : path.join('ops', 'backup-artifacts');
  fs.mkdirSync(outDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const codes = {
    backupOffsite: await run('npm', ['run', 'backup:offsite']),
    backupVerify: await run('npm', ['run', 'backup:verify']),
  };

  const ok = Object.values(codes).every((c) => c === 0);
  const finishedAt = new Date().toISOString();

  const logPath = path.join(outDir, 'backup-log.jsonl');
  fs.appendFileSync(
    logPath,
    `${JSON.stringify({ at: finishedAt, type: 'backup_run', ok, startedAt, finishedAt, codes })}\n`,
    'utf8',
  );

  process.exit(ok ? 0 : 2);
}

main().catch(() => process.exit(1));

